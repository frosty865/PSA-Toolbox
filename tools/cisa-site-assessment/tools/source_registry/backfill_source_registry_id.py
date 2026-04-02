#!/usr/bin/env python3
"""
Backfill source_registry_id for existing documents using explicit mappings.

This script is deterministic: it only applies explicit mappings you provide.
It will not infer publishers/titles.

Expected mapping file format (JSON):
{
  "document_table": "public.corpus_documents",
  "match_field": "id" | "file_hash" | "title" | "sha256",
  "mappings": [
    { "match_value": "<value>", "source_registry_id": "<uuid>" },
    ...
  ]
}
"""

import json
import os
import sys
from typing import Dict, Any, List, Optional
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import psycopg2
from urllib.parse import urlparse
from model.db.db_config import load_env_file

# Load .env.local
_env_path = Path(__file__).parent.parent.parent / '.env.local'
if _env_path.exists():
    load_env_file(str(_env_path))

def get_corpus_db_connection():
    """Get CORPUS database connection."""
    corpus_url = os.getenv('SUPABASE_CORPUS_URL')
    corpus_password = os.getenv('SUPABASE_CORPUS_DB_PASSWORD')
    
    # Also try CORPUS_DATABASE_URL
    corpus_db_url = os.getenv('CORPUS_DATABASE_URL')
    if corpus_db_url:
        corpus_db_url = corpus_db_url.strip().strip('\\').strip()
        if 'sslmode=' not in corpus_db_url:
            if '?' in corpus_db_url:
                corpus_db_url += '&sslmode=require&connect_timeout=10'
            else:
                corpus_db_url += '?sslmode=require&connect_timeout=10'
        try:
            return psycopg2.connect(corpus_db_url)
        except Exception as e:
            print(f"[WARN] CORPUS_DATABASE_URL connection failed: {e}")
    
    if not corpus_url or not corpus_password:
        raise ValueError('SUPABASE_CORPUS_URL and SUPABASE_CORPUS_DB_PASSWORD (or CORPUS_DATABASE_URL) must be set')
    
    # Clean password
    clean_password = corpus_password.strip().strip('"').strip("'").replace('\\', '')
    
    url = urlparse(corpus_url)
    project_ref = url.hostname.split('.')[0] if url.hostname else corpus_url.split('.')[0]
    
    # Extract database name from CORPUS_DATABASE_URL if available
    dbname = 'psa_corpus'  # Default
    if corpus_db_url:
        try:
            parsed = urlparse(corpus_db_url)
            dbname = parsed.path.replace('/', '') or 'psa_corpus'
        except:
            pass
    
    # Try transaction pooler port 6543 first, then direct port 5432
    connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/{dbname}?sslmode=require&connect_timeout=10'
    
    try:
        return psycopg2.connect(connection_string)
    except psycopg2.OperationalError as e:
        # If pooler fails, try direct connection on port 5432
        if '6543' in connection_string:
            print(f"[WARN] Connection to port 6543 failed, trying direct port 5432...")
            connection_string_direct = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/{dbname}?sslmode=require&connect_timeout=10'
            return psycopg2.connect(connection_string_direct)
        raise

def die(msg: str) -> None:
    print(f"[FAIL] {msg}", file=sys.stderr)
    sys.exit(1)

def main() -> None:
    if len(sys.argv) != 2:
        die("Usage: backfill_source_registry_id.py <mapping.json>")

    mapping_path = sys.argv[1]
    if not os.path.exists(mapping_path):
        die(f"Mapping file not found: {mapping_path}")

    with open(mapping_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    document_table = cfg.get("document_table")
    match_field = cfg.get("match_field")
    mappings = cfg.get("mappings", [])

    if not document_table or not match_field or not isinstance(mappings, list):
        die("Invalid mapping file. Requires: document_table, match_field, mappings[]")

    if not mappings:
        die("No mappings provided in mapping file")

    # Connect to CORPUS database
    try:
        conn = get_corpus_db_connection()
        cur = conn.cursor()
    except Exception as e:
        die(f"Failed to connect to database: {e}")

    table_name = document_table.split(".", 1)[1] if "." in document_table else document_table

    # Verify table exists
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = %s
        )
    """, (table_name,))
    if not cur.fetchone()[0]:
        die(f"Table {document_table} not found")

    # Verify source_registry_id column exists
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s AND column_name = 'source_registry_id'
        )
    """, (table_name,))
    if not cur.fetchone()[0]:
        die(f"Column source_registry_id not found in {document_table}")

    # Verify match_field exists
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s AND column_name = %s
        )
    """, (table_name, match_field))
    if not cur.fetchone()[0]:
        die(f"Match field '{match_field}' not found in {document_table}")

    # Pre-validate each source_registry_id exists
    unique_source_ids = sorted({m.get("source_registry_id") for m in mappings if m.get("source_registry_id")})
    
    # Check if status column exists
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'source_registry' AND column_name = 'status'
        )
    """)
    has_status_column = cur.fetchone()[0]

    for sid in unique_source_ids:
        if has_status_column:
            cur.execute("""
                SELECT id, status FROM public.source_registry WHERE id = %s
            """, (sid,))
        else:
            cur.execute("""
                SELECT id, source_type FROM public.source_registry WHERE id = %s
            """, (sid,))
        
        row = cur.fetchone()
        if not row:
            die(f"source_registry_id not found: {sid}")
        
        # Check if ACTIVE (status='ACTIVE' or source_type='web')
        if has_status_column:
            if row[1] != 'ACTIVE':
                die(f"source_registry_id is not ACTIVE: {sid} (status: {row[1]})")
        else:
            if row[1] != 'web':
                die(f"source_registry_id is not ACTIVE: {sid} (source_type: {row[1]})")

    print(f"[INFO] Validated {len(unique_source_ids)} unique source_registry_id values")
    print(f"[INFO] Applying {len(mappings)} mappings to {document_table} using match_field='{match_field}'")
    print()

    # Apply updates
    updated = 0
    skipped = 0
    errors = []

    for i, m in enumerate(mappings, 1):
        mv = m.get("match_value")
        sid = m.get("source_registry_id")
        
        if mv is None or not sid:
            errors.append(f"Mapping {i}: missing match_value or source_registry_id")
            continue

        try:
            # Update only rows where source_registry_id IS NULL
            cur.execute(f"""
                UPDATE {document_table}
                SET source_registry_id = %s
                WHERE {match_field} = %s
                  AND source_registry_id IS NULL
            """, (sid, mv))
            
            rows_updated = cur.rowcount
            if rows_updated > 0:
                updated += rows_updated
                print(f"[OK] Updated {rows_updated} row(s) where {match_field}='{mv}' -> source_registry_id={sid}")
            else:
                # Check if row exists but already has source_registry_id
                cur.execute(f"""
                    SELECT COUNT(*) FROM {document_table} WHERE {match_field} = %s
                """, (mv,))
                exists = cur.fetchone()[0] > 0
                if exists:
                    skipped += 1
                    print(f"[SKIP] Row with {match_field}='{mv}' already has source_registry_id or doesn't exist")
                else:
                    errors.append(f"Mapping {i}: No row found with {match_field}='{mv}'")
        except Exception as e:
            errors.append(f"Mapping {i}: Error updating {match_field}='{mv}': {e}")

    # Commit transaction
    try:
        conn.commit()
        print()
        print(f"[DONE] Applied {updated} updates, skipped {skipped}, errors: {len(errors)}")
        if errors:
            print("\n[ERRORS]")
            for err in errors:
                print(f"  - {err}")
            sys.exit(1)
    except Exception as e:
        conn.rollback()
        die(f"Failed to commit: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
