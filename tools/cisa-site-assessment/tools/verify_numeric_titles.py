#!/usr/bin/env python3
"""Verify no numeric inferred_titles exist."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from tools.backfill.backfill_document_citations import get_corpus_db_connection

conn = get_corpus_db_connection()
cur = conn.cursor()

try:
    cur.execute("SELECT count(*) FROM public.corpus_documents WHERE inferred_title ~ '^[0-9]+$'")
    count = cur.fetchone()[0]
    
    print(f"Numeric inferred_title count: {count}")
    
    if count == 0:
        print("✅ PASS: No numeric inferred_titles found")
        sys.exit(0)
    else:
        print("❌ FAIL: Found numeric inferred_titles")
        # Show offenders
        cur.execute("""
            SELECT id, inferred_title, file_stem, canonical_path
            FROM public.corpus_documents
            WHERE inferred_title ~ '^[0-9]+$'
        """)
        for row in cur.fetchall():
            print(f"  - ID: {row[0]}, title: {row[1]}, stem: {row[2]}")
        sys.exit(1)
    
finally:
    cur.close()
    conn.close()
