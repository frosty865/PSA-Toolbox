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

cur.execute("""
    SELECT source_id, title, citation_text, uri, publisher
    FROM canonical_sources 
    WHERE publisher = 'NIST' OR citation_text LIKE '%NIST%' OR uri LIKE '%nist.gov%'
    ORDER BY created_at DESC
    LIMIT 20
""")
rows = cur.fetchall()

print('NIST sources:')
print('=' * 80)
for r in rows:
    source_id, title, citation_text, uri, publisher = r
    print(f"\nSource ID: {source_id}")
    print(f"  Title: {title}")
    print(f"  Publisher: {publisher}")
    print(f"  URI: {uri}")
    print(f"  Citation: {citation_text}")

cur.close()
conn.close()
