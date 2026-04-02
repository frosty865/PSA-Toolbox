"""
Database Configuration Module
Single source of truth for DB connection configuration
Supports Postgres (preferred) and Supabase REST (fallback)
"""

import os
from typing import Dict, Optional, Literal
from urllib.parse import urlparse


def load_env_file(filepath: str) -> None:
    """Load environment variables from a file."""
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                # Clean up value: remove backslashes, extra spaces, quotes
                value = value.strip().strip('\\').strip().strip('"').strip("'")
                os.environ[key.strip()] = value


# Load .env.local if it exists
_env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env.local')
if os.path.exists(_env_path):
    load_env_file(_env_path)


def get_db_mode() -> Literal["postgres", "supabase_rest"]:
    """
    Determine which DB mode to use.
    Returns "postgres" if DATABASE_URL is set, else "supabase_rest" if Supabase vars exist.
    
    NOTE: For corpus_documents queries, prefers CORPUS database over RUNTIME.
    """
    # Prefer DATABASE_URL (direct Postgres) - check if it points to CORPUS
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        # If DATABASE_URL points to CORPUS project, use it
        if 'yylslokiaovdythzrbgt' in database_url or 'corpus' in database_url.lower():
            return "postgres"
        # Otherwise check for CORPUS-specific vars
        if os.getenv('SUPABASE_CORPUS_URL') and os.getenv('SUPABASE_CORPUS_DB_PASSWORD'):
            return "postgres"
    
    # Check for SUPABASE_CORPUS_URL + password (CORPUS database - preferred for corpus_documents)
    if os.getenv('SUPABASE_CORPUS_URL') and os.getenv('SUPABASE_CORPUS_DB_PASSWORD'):
        return "postgres"
    
    # Fallback to SUPABASE_RUNTIME_URL + password (RUNTIME database)
    if os.getenv('SUPABASE_RUNTIME_URL') and os.getenv('SUPABASE_RUNTIME_DB_PASSWORD'):
        return "postgres"
    
    # Fallback to Supabase REST API (CORPUS first, then RUNTIME)
    if os.getenv('SUPABASE_CORPUS_URL') and os.getenv('SUPABASE_CORPUS_SERVICE_ROLE_KEY'):
        return "supabase_rest"
    
    if os.getenv('SUPABASE_URL') and os.getenv('SUPABASE_SERVICE_ROLE_KEY'):
        return "supabase_rest"
    
    # Fallback: SUPABASE_RUNTIME_URL + SERVICE_ROLE_KEY (REST)
    if os.getenv('SUPABASE_RUNTIME_URL') and os.getenv('SUPABASE_RUNTIME_SERVICE_ROLE_KEY'):
        return "supabase_rest"
    
    # Default to postgres, will fail with clear error if not configured
    return "postgres"


def get_postgres_dsn() -> str:
    """
    Get Postgres DSN connection string.
    Prefers CORPUS database for corpus_documents queries, falls back to RUNTIME.
    """
    # Try DATABASE_URL first
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        # Clean up URL
        database_url = database_url.strip().strip('\\').strip()
        # If it points to CORPUS, use it
        if 'yylslokiaovdythzrbgt' in database_url or 'corpus' in database_url.lower():
            if 'supabase' in database_url and '?sslmode=' not in database_url:
                database_url += '?sslmode=require'
            return database_url
        # If DATABASE_URL points to RUNTIME but we need CORPUS, check for CORPUS vars
        if os.getenv('SUPABASE_CORPUS_URL') and os.getenv('SUPABASE_CORPUS_DB_PASSWORD'):
            # Use CORPUS instead
            pass  # Fall through to CORPUS check
        elif 'supabase' in database_url and '?sslmode=' not in database_url:
            database_url += '?sslmode=require'
            return database_url
    
    # Prefer SUPABASE_CORPUS_URL + password (CORPUS database - for corpus_documents)
    corpus_url = os.getenv('SUPABASE_CORPUS_URL')
    corpus_password = os.getenv('SUPABASE_CORPUS_DB_PASSWORD')
    
    if corpus_url and corpus_password:
        # Parse URL
        corpus_url = corpus_url.strip().strip('\\').strip()
        parsed = urlparse(corpus_url)
        hostname = parsed.hostname
        
        # Extract hostname if None
        if not hostname:
            if 'supabase.co' in corpus_url:
                if '://' in corpus_url:
                    hostname = corpus_url.split('://')[1].split('/')[0].split(':')[0]
                else:
                    hostname = corpus_url.split('/')[0].split(':')[0]
            elif '.' in corpus_url:
                project_ref = corpus_url.split('.')[0]
                hostname = f"db.{project_ref}.supabase.co"
            else:
                hostname = f"db.{corpus_url}.supabase.co"
        
        # Clean hostname
        if hostname:
            hostname = hostname.split(':')[0].strip()
        
        port = parsed.port or 6543
        
        # Extract database name from CORPUS_DATABASE_URL if available, otherwise default to psa_corpus
        dbname = 'psa_corpus'  # Default
        corpus_db_url = os.getenv('CORPUS_DATABASE_URL')
        if corpus_db_url:
            try:
                corpus_parsed = urlparse(corpus_db_url)
                dbname = corpus_parsed.path.replace('/', '') or 'psa_corpus'
            except:
                pass
        
        # Build DSN
        dsn = (
            f"host={hostname} "
            f"port={port} "
            f"dbname={dbname} "
            f"user=postgres "
            f"password={corpus_password} "
            f"sslmode=require"
        )
        return dsn
    
    # Fallback to SUPABASE_RUNTIME_URL + password (RUNTIME database)
    runtime_url = os.getenv('SUPABASE_RUNTIME_URL')
    password = os.getenv('SUPABASE_RUNTIME_DB_PASSWORD')
    
    if runtime_url and password:
        # Parse URL
        runtime_url = runtime_url.strip().strip('\\').strip()
        parsed = urlparse(runtime_url)
        hostname = parsed.hostname
        
        # Extract hostname if None
        if not hostname:
            if 'supabase.co' in runtime_url:
                if '://' in runtime_url:
                    hostname = runtime_url.split('://')[1].split('/')[0].split(':')[0]
                else:
                    hostname = runtime_url.split('/')[0].split(':')[0]
            elif '.' in runtime_url:
                project_ref = runtime_url.split('.')[0]
                hostname = f"db.{project_ref}.supabase.co"
            else:
                hostname = f"db.{runtime_url}.supabase.co"
        
        # Clean hostname
        if hostname:
            hostname = hostname.split(':')[0].strip()
        
        port = parsed.port or 6543
        
        # Extract database name from RUNTIME_DATABASE_URL if available, otherwise default to psa_runtime
        dbname = 'psa_runtime'  # Default
        runtime_db_url = os.getenv('RUNTIME_DATABASE_URL')
        if runtime_db_url:
            try:
                runtime_parsed = urlparse(runtime_db_url)
                dbname = runtime_parsed.path.replace('/', '') or 'psa_runtime'
            except:
                pass
        
        # Build DSN
        dsn = (
            f"host={hostname} "
            f"port={port} "
            f"dbname={dbname} "
            f"user=postgres "
            f"password={password} "
            f"sslmode=require"
        )
        return dsn
    
    # No configuration found
    missing_vars = []
    if not database_url and not corpus_url and not runtime_url:
        missing_vars.append("DATABASE_URL, SUPABASE_CORPUS_URL, or SUPABASE_RUNTIME_URL")
    if corpus_url and not corpus_password:
        missing_vars.append("SUPABASE_CORPUS_DB_PASSWORD")
    if runtime_url and not password:
        missing_vars.append("SUPABASE_RUNTIME_DB_PASSWORD")
    
    raise ValueError(
        f"Postgres connection not configured. Missing environment variables: {', '.join(missing_vars)}. "
        f"For corpus_documents queries, set SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD. "
        f"Otherwise set DATABASE_URL or SUPABASE_RUNTIME_URL + SUPABASE_RUNTIME_DB_PASSWORD"
    )


def get_supabase_creds() -> Dict[str, str]:
    """
    Get Supabase REST API credentials.
    Returns dict with 'url' and 'service_role_key'.
    Prefers CORPUS credentials for corpus_documents queries.
    """
    # Prefer CORPUS credentials for corpus queries
    url = os.getenv('SUPABASE_CORPUS_URL')
    service_role_key = os.getenv('SUPABASE_CORPUS_SERVICE_ROLE_KEY')
    
    # Fallback to generic SUPABASE_URL
    if not url:
        url = os.getenv('SUPABASE_URL') or os.getenv('SUPABASE_RUNTIME_URL')
    
    if not service_role_key:
        service_role_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_RUNTIME_SERVICE_ROLE_KEY')
    
    if not url:
        raise ValueError(
            "Supabase REST connection not configured. Missing SUPABASE_CORPUS_URL, SUPABASE_URL, or SUPABASE_RUNTIME_URL. "
            "For corpus_documents queries, set SUPABASE_CORPUS_URL + SUPABASE_CORPUS_SERVICE_ROLE_KEY. "
            "Otherwise set SUPABASE_URL (or SUPABASE_RUNTIME_URL) + SUPABASE_SERVICE_ROLE_KEY"
        )
    
    if not service_role_key:
        raise ValueError(
            "Supabase REST connection not configured. Missing SUPABASE_CORPUS_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY. "
            "For corpus_documents queries, set SUPABASE_CORPUS_SERVICE_ROLE_KEY. "
            "Otherwise set SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_RUNTIME_SERVICE_ROLE_KEY)"
        )
    
    # Clean up URL
    url = url.strip().strip('\\').strip()
    service_role_key = service_role_key.strip().strip('\\').strip()
    
    return {
        'url': url,
        'service_role_key': service_role_key
    }


def get_db_info() -> Dict[str, str]:
    """
    Get database connection info for logging (no secrets).
    Returns dict with mode, host, database name, and which database (CORPUS vs RUNTIME).
    """
    mode = get_db_mode()
    info = {'mode': mode}
    
    # Determine which database we're connecting to
    if os.getenv('SUPABASE_CORPUS_URL'):
        info['database_type'] = 'CORPUS'
    elif os.getenv('SUPABASE_RUNTIME_URL'):
        info['database_type'] = 'RUNTIME'
    else:
        info['database_type'] = 'unknown'
    
    if mode == "postgres":
        try:
            dsn = get_postgres_dsn()
            # Parse DSN to extract host/dbname (no password)
            if 'host=' in dsn:
                host_part = [p for p in dsn.split() if p.startswith('host=')][0]
                info['host'] = host_part.split('=')[1]
            if 'dbname=' in dsn:
                db_part = [p for p in dsn.split() if p.startswith('dbname=')][0]
                info['database'] = db_part.split('=')[1]
        except ValueError as e:
            info['error'] = str(e)
    else:
        try:
            creds = get_supabase_creds()
            parsed = urlparse(creds['url'])
            info['host'] = parsed.hostname or 'unknown'
            info['database'] = 'postgres (via REST)'
        except ValueError as e:
            info['error'] = str(e)
    
    return info
