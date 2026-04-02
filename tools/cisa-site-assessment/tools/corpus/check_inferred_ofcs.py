#!/usr/bin/env python3
"""Check inferred OFCs."""
import os, psycopg2

def load_env_file(filepath: str):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip().strip('"').strip("'")

load_env_file('.env.local')
dsn = os.environ.get('CORPUS_DATABASE_URL') or os.environ.get('DATABASE_URL')
conn = psycopg2.connect(dsn)
cur = conn.cursor()

cur.execute("""
    SELECT candidate_id, snippet_text, submitted_by, status, discipline_subtype_id, document_chunk_id
    FROM ofc_candidate_queue 
    WHERE submitted_by = 'INFERRED' 
    ORDER BY created_at DESC
""")
rows = cur.fetchall()

print(f"Found {len(rows)} inferred OFCs:\n")
for r in rows:
    print(f"ID: {r[0]}")
    print(f"Text: {r[1][:100]}...")
    print(f"Submitted by: {r[2]} | Status: {r[3]}")
    print(f"Subtype ID: {r[4]}")
    print(f"Chunk ID: {r[5]}")
    print("-" * 80)

cur.close()
conn.close()
