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

# Check available source_sets
cur.execute("""
    SELECT DISTINCT source_set, COUNT(*) as count
    FROM document_chunks
    WHERE source_set IS NOT NULL
    GROUP BY source_set
    ORDER BY count DESC
""")
rows = cur.fetchall()
print('Available source_sets:')
for row in rows:
    print(f"  {row[0]}: {row[1]} chunks")

# Check total chunks
cur.execute("SELECT COUNT(*) FROM document_chunks")
total = cur.fetchone()[0]
print(f"\nTotal chunks: {total}")

cur.close()
conn.close()
