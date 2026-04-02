#!/usr/bin/env python3
"""Check schema and duplicates."""
import os, psycopg2
from collections import Counter

def load_env_file(filepath: str):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip().strip('"').strip("'")

def norm_text(s: str) -> str:
    return " ".join((s or "").split()).strip()

load_env_file('.env.local')
conn = psycopg2.connect(os.environ.get('CORPUS_DATABASE_URL') or os.environ.get('DATABASE_URL'))
cur = conn.cursor()

# Check columns
cur.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ofc_candidate_queue'
    ORDER BY ordinal_position
""")
cols = [r[0] for r in cur.fetchall()]
print("Columns:", ', '.join(cols))
print()

# Check if submitted_by exists
has_submitted_by = 'submitted_by' in cols
print(f"Has submitted_by: {has_submitted_by}")

# Check total count
cur.execute("SELECT COUNT(*) FROM ofc_candidate_queue")
total = cur.fetchone()[0]
print(f"Total candidates: {total}")

# Check MINED count if column exists
if has_submitted_by:
    cur.execute("SELECT COUNT(*) FROM ofc_candidate_queue WHERE submitted_by = 'MINED'")
    mined = cur.fetchone()[0]
    print(f"MINED candidates: {mined}")

# Check for duplicate texts (normalized)
cur.execute("SELECT snippet_text FROM ofc_candidate_queue WHERE snippet_text IS NOT NULL")
texts = [norm_text(r[0]) for r in cur.fetchall()]
text_counts = Counter(texts)
dups = {t: c for t, c in text_counts.items() if c > 1}
print(f"\nDuplicate texts (normalized): {len(dups)}")
if dups:
    for text, cnt in list(dups.items())[:5]:
        print(f"  Count: {cnt}, Text: {text[:80]}...")

cur.close()
conn.close()
