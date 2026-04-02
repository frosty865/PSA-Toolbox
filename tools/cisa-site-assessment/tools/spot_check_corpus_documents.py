#!/usr/bin/env python3
"""Spot check 10 rows from corpus_documents."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from tools.backfill.backfill_document_citations import get_corpus_db_connection

conn = get_corpus_db_connection()
cur = conn.cursor()

try:
    cur.execute("""
        SELECT
          id, original_filename, file_stem, inferred_title, title_confidence,
          publisher, publication_date, citation_short, canonical_path, ingestion_warnings
        FROM public.corpus_documents
        ORDER BY title_confidence DESC NULLS LAST
        LIMIT 10
    """)
    
    rows = cur.fetchall()
    colnames = [desc[0] for desc in cur.description]
    
    print(f"\n📊 Spot check: Top 10 rows by title_confidence\n")
    print(" | ".join(f"{c:20}" for c in colnames))
    print("-" * (len(colnames) * 23))
    
    for row in rows:
        print(" | ".join(f"{str(v)[:20] if v is not None else 'NULL':20}" for v in row))
    
    if len(rows) == 0:
        print("No rows found in corpus_documents")
    
finally:
    cur.close()
    conn.close()
