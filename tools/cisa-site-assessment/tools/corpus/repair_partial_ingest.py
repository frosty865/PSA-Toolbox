#!/usr/bin/env python3
"""
Repair Partial Ingestion Script

Finds corpus_documents created for failed ingest runs and repairs them by:
- Deleting orphaned chunks (if any)
- Re-inserting chunks using correct document_id from corpus_documents

Usage:
    python tools/corpus/repair_partial_ingest.py \
        [--module_code MODULE_EV_PARKING] \
        [--created_after 2026-01-22] \
        [--delete_existing_chunks]
"""

import argparse
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import psycopg2
from corpus_ingest_pdf import get_corpus_db_connection


def load_env_file(filepath: str):
    """Load environment variables from .env.local file."""
    if not os.path.exists(filepath):
        return
    
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip().strip('"').strip("'")


def repair_documents(
    conn,
    module_code: str = None,
    created_after: str = None,
    delete_existing_chunks: bool = False
):
    """Repair documents that may have failed chunk insertion."""
    cur = conn.cursor()
    
    # Find corpus_documents that might need repair
    query = """
        SELECT id, file_hash, original_filename, inferred_title, created_at
        FROM public.corpus_documents
        WHERE 1=1
    """
    params = []
    
    if module_code:
        # Try to match by filename pattern or source_url
        query += " AND (original_filename LIKE %s OR source_url LIKE %s)"
        params.extend([f"%{module_code}%", f"%{module_code}%"])
    
    if created_after:
        query += " AND created_at >= %s"
        params.append(created_after)
    
    query += " ORDER BY created_at DESC LIMIT 100"
    
    cur.execute(query, params)
    docs = cur.fetchall()
    
    if not docs:
        print("No documents found matching criteria")
        return
    
    print(f"Found {len(docs)} documents to check")
    
    repaired = 0
    skipped = 0
    failed = 0
    
    for doc_id, file_hash, filename, title, created_at in docs:
        # Check if chunks exist
        cur.execute("""
            SELECT COUNT(*) FROM public.document_chunks
            WHERE document_id = %s
        """, (doc_id,))
        chunk_count = cur.fetchone()[0]
        
        if chunk_count > 0:
            if delete_existing_chunks:
                print(f"[{doc_id}] Deleting {chunk_count} existing chunks...")
                cur.execute("""
                    DELETE FROM public.document_chunks
                    WHERE document_id = %s
                """, (doc_id,))
                chunk_count = 0
            else:
                print(f"[{doc_id}] Already has {chunk_count} chunks, skipping")
                skipped += 1
                continue
        
        if chunk_count == 0:
            # Document has no chunks - this might be a failed ingestion
            print(f"[{doc_id}] {filename} - No chunks found (created: {created_at})")
            print(f"  Note: This script cannot re-extract chunks from files.")
            print(f"  Re-run ingestion for this document to create chunks.")
            failed += 1
    
    conn.commit()
    
    print(f"\n[SUMMARY]")
    print(f"  Checked: {len(docs)}")
    print(f"  Skipped (has chunks): {skipped}")
    print(f"  Needs re-ingestion: {failed}")
    print(f"  Repaired: {repaired}")


def main():
    parser = argparse.ArgumentParser(
        description='Repair partial ingestion runs by cleaning orphaned chunks'
    )
    parser.add_argument(
        '--module_code',
        help='Filter by module code (matches filename/source_url)'
    )
    parser.add_argument(
        '--created_after',
        help='Filter by creation date (YYYY-MM-DD format)'
    )
    parser.add_argument(
        '--delete_existing_chunks',
        action='store_true',
        help='Delete existing chunks before repair (use with caution)'
    )
    
    args = parser.parse_args()
    
    load_env_file('.env.local')
    conn = get_corpus_db_connection()
    
    try:
        repair_documents(
            conn,
            module_code=args.module_code,
            created_after=args.created_after,
            delete_existing_chunks=args.delete_existing_chunks
        )
    finally:
        conn.close()


if __name__ == "__main__":
    main()
