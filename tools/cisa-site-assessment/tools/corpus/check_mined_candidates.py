#!/usr/bin/env python3
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

# Check all candidates
cur.execute("""
    SELECT COUNT(*) as total,
           COUNT(document_chunk_id) as with_chunk_id,
           COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending,
           COUNT(source_id) as with_source_id
    FROM ofc_candidate_queue
""")
row = cur.fetchone()
print(f"All candidates: {row[0]} total")
print(f"  With document_chunk_id: {row[1]}")
print(f"  With source_id: {row[3]}")
print(f"  PENDING status: {row[2]}")

# Check candidates with chunk citations (mined)
cur.execute("""
    SELECT COUNT(*) 
    FROM ofc_candidate_queue
    WHERE document_chunk_id IS NOT NULL
""")
mined_count = cur.fetchone()[0]
print(f"\nMined candidates (with document_chunk_id): {mined_count}")

cur.close()
conn.close()
