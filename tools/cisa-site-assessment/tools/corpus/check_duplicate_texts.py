#!/usr/bin/env python3
"""Quick check for duplicate texts in MINED candidates."""
import os, psycopg2, hashlib

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

def hash_text(s: str) -> str:
    normalized = norm_text(s)
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()

load_env_file('.env.local')
conn = psycopg2.connect(os.environ.get('CORPUS_DATABASE_URL') or os.environ.get('DATABASE_URL'))
cur = conn.cursor()

cur.execute("""
    SELECT snippet_text, COUNT(*) as cnt
    FROM ofc_candidate_queue
    WHERE submitted_by = 'MINED'
    GROUP BY snippet_text
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 10
""")

dups = cur.fetchall()
print(f"Found {len(dups)} duplicate text groups")
for text, cnt in dups:
    print(f"  Count: {cnt}, Text: {text[:80]}...")

cur.close()
conn.close()
