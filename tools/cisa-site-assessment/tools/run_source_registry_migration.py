#!/usr/bin/env python3
"""
Run Source Registry Migration

Executes the source registry migration SQL file against the CORPUS database.

This script should be run with the project's virtual environment activated:
  Windows: venv\Scripts\activate
  Unix/Mac: source venv/bin/activate
"""

import os
import sys
from pathlib import Path

# Check if we're in a venv
if not hasattr(sys, 'real_prefix') and not (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
    venv_path = Path(__file__).parent.parent / 'venv'
    if venv_path.exists():
        print("⚠️  WARNING: Virtual environment not detected!")
        print(f"   Please activate venv first:")
        if sys.platform == 'win32':
            print(f"   venv\\Scripts\\activate")
        else:
            print(f"   source venv/bin/activate")
        print()
        # Don't exit - allow user to proceed if they know what they're doing

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Use new DB adapter system
from model.db.pg_client import PostgresClient
from model.db.db_config import get_postgres_dsn, get_db_mode, load_env_file
import psycopg2
from urllib.parse import urlparse

# Load .env.local
_env_path = Path(__file__).parent.parent / '.env.local'
if _env_path.exists():
    load_env_file(str(_env_path))

def get_corpus_db_connection():
    """Get CORPUS DB connection using new DB adapter with hard timeouts."""
    # Force CORPUS database (not RUNTIME)
    corpus_url = os.getenv('SUPABASE_CORPUS_URL')
    corpus_password = os.getenv('SUPABASE_CORPUS_DB_PASSWORD')
    
    # Also try DATABASE_URL if it points to CORPUS
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        database_url = database_url.strip().strip('\\').strip()
        if 'yylslokiaovdythzrbgt' in database_url:
            try:
                print(f"  Attempting connection via DATABASE_URL...")
                # Ensure sslmode and timeout
                if 'sslmode=' not in database_url:
                    if '?' in database_url:
                        database_url += '&sslmode=require&connect_timeout=5'
                    else:
                        database_url += '?sslmode=require&connect_timeout=5'
                elif 'connect_timeout' not in database_url:
                    database_url += '&connect_timeout=5'
                conn = psycopg2.connect(database_url)
                print(f"  ✓ Connected via DATABASE_URL")
                return conn
            except Exception as e:
                print(f"  ✗ DATABASE_URL connection failed: {type(e).__name__}")
    
    if corpus_url and corpus_password:
        # Parse URL to get hostname
        parsed = urlparse(corpus_url)
        hostname = parsed.hostname
        
        if not hostname:
            if 'supabase.co' in corpus_url:
                if '://' in corpus_url:
                    hostname = corpus_url.split('://')[1].split('/')[0].split(':')[0]
                else:
                    hostname = corpus_url.split('/')[0].split(':')[0]
        
        if hostname:
            hostname = hostname.split(':')[0].strip()
        
        # Extract database name from CORPUS_DATABASE_URL if available, otherwise default to psa_corpus
        dbname = 'psa_corpus'  # Default
        corpus_db_url = os.getenv('CORPUS_DATABASE_URL')
        if corpus_db_url:
            try:
                corpus_parsed = urlparse(corpus_db_url)
                dbname = corpus_parsed.path.replace('/', '') or 'psa_corpus'
            except:
                pass
        
        # Try both ports with timeout
        ports = [6543, 5432]
        last_error = None
        
        for port in ports:
            dsn = (
                f"host={hostname} "
                f"port={port} "
                f"dbname={dbname} "
                f"user=postgres "
                f"password={corpus_password} "
                f"sslmode=require "
                f"connect_timeout=5"
            )
            
            try:
                print(f"  Attempting CORPUS connection on port {port}...")
                conn = psycopg2.connect(dsn)
                print(f"  ✓ Connected to CORPUS on port {port}")
                return conn
            except Exception as e:
                last_error = e
                if port == 6543:
                    print(f"  ✗ Port {port} failed: {type(e).__name__}")
                continue
        
        # Both ports failed
        if last_error:
            error_msg = str(last_error)
            if 'timeout' in error_msg.lower():
                raise ValueError(
                    f"CORPUS database connection TIMEOUT (exceeded 5s).\n"
                    f"  Host: {hostname}\n"
                    f"  Tried ports: 6543, 5432\n"
                    f"  Env vars: SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD\n"
                    f"  Next steps: Check network/VPN/firewall; verify direct database access is enabled for CORPUS project"
                ) from last_error
            raise ValueError(
                f"CORPUS database connection failed.\n"
                f"  Host: {hostname}\n"
                f"  Error: {error_msg}\n"
                f"  Next steps: Verify SUPABASE_CORPUS_URL and SUPABASE_CORPUS_DB_PASSWORD"
            ) from last_error
    
    raise ValueError(
        "CORPUS database connection not configured. "
        "Set SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD or DATABASE_URL pointing to CORPUS project."
    )

def run_migration():
    """Run source registry migration."""
    migration_file = Path(__file__).parent.parent / 'db' / 'migrations' / '20260116_create_source_registry.sql'
    
    if not migration_file.exists():
        raise FileNotFoundError(f"Migration file not found: {migration_file}")
    
    print(f"Reading migration file: {migration_file}")
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    print("Connecting to CORPUS database...")
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        print("Executing migration...")
        cur.execute(sql_content)
        conn.commit()
        
        print("✅ Migration executed successfully!")
        print("\nVerification:")
        
        # Verify source_registry table exists
        cur.execute("""
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'source_registry'
        """)
        if cur.fetchone()[0] > 0:
            print("  ✓ source_registry table exists")
        else:
            print("  ✗ source_registry table not found")
        
        # Verify citation columns exist
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'ofc_library_citations' 
            AND column_name IN ('source_key', 'locator_type', 'locator', 'retrieved_at')
        """)
        columns = [row[0] for row in cur.fetchall()]
        expected = ['source_key', 'locator_type', 'locator', 'retrieved_at']
        for col in expected:
            if col in columns:
                print(f"  ✓ Column {col} exists")
            else:
                print(f"  ✗ Column {col} not found")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}", file=sys.stderr)
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    try:
        run_migration()
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
