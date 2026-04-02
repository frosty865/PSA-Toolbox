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
    SELECT ocq.candidate_id, ocq.title, cs.citation_text, cs.title as source_title, cs.publisher
    FROM ofc_candidate_queue ocq
    LEFT JOIN canonical_sources cs ON ocq.source_id = cs.source_id
    WHERE ocq.title LIKE 'IST OFC%'
    ORDER BY ocq.created_at DESC
    LIMIT 10
""")
rows = cur.fetchall()

print('Sample IST OFCs with citations:')
print('=' * 80)
for r in rows:
    candidate_id, title, citation_text, source_title, publisher = r
    print(f"\n{title}:")
    print(f"  Source Title: {source_title}")
    print(f"  Publisher: {publisher}")
    if citation_text:
        print(f"  Citation: {citation_text[:150]}...")
    else:
        print(f"  Citation: No citation")

cur.close()
conn.close()
