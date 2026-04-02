#!/usr/bin/env python3
"""Quick script to check titles of Unknown publisher PDFs."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from tools.corpus.fix_pdf_publishers import get_corpus_db_connection

conn = get_corpus_db_connection()
cur = conn.cursor()
cur.execute("SELECT title FROM public.source_registry WHERE publisher = 'Unknown' AND title IS NOT NULL LIMIT 20")
rows = cur.fetchall()
for i, r in enumerate(rows, 1):
    print(f"{i}. {r[0]}")
conn.close()
