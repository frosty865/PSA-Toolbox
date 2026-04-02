#!/usr/bin/env python3
"""Check corpus_documents status and source documents."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from tools.backfill.backfill_document_citations import get_corpus_db_connection

conn = get_corpus_db_connection()
cur = conn.cursor()

try:
    # Check corpus_documents
    cur.execute("SELECT COUNT(*) FROM public.corpus_documents")
    corpus_count = cur.fetchone()[0]
    print(f"📊 corpus_documents: {corpus_count} rows")
    
    # Check source documents
    cur.execute("SELECT COUNT(*) FROM public.documents WHERE file_hash IS NOT NULL AND file_hash != ''")
    source_count = cur.fetchone()[0]
    print(f"📊 source documents (with file_hash): {source_count} rows")
    
    # Check if corpus_documents has any rows with file paths
    cur.execute("""
        SELECT COUNT(*) 
        FROM public.corpus_documents 
        WHERE canonical_path IS NOT NULL OR original_filename IS NOT NULL
    """)
    corpus_with_paths = cur.fetchone()[0]
    print(f"📊 corpus_documents with paths: {corpus_with_paths} rows")
    
    # Sample from source documents
    if source_count > 0:
        cur.execute("""
            SELECT file_hash, file_path, original_filename, inferred_title, title_confidence
            FROM public.documents
            WHERE file_hash IS NOT NULL AND file_hash != ''
            LIMIT 5
        """)
        print("\n📋 Sample source documents:")
        for row in cur.fetchall():
            print(f"  - file_hash: {row[0][:20]}..., path: {row[1]}, title: {row[3]}")
    
finally:
    cur.close()
    conn.close()
