#!/usr/bin/env python3
import os, psycopg2
from urllib.parse import urlparse

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

# Check what columns exist
cur.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ofc_candidate_queue'
    ORDER BY ordinal_position
""")
cols = [r[0] for r in cur.fetchall()]
print('Available columns:', cols)

# Check IST OFCs (by checking if they have the IST source_id)
cur.execute("""
    SELECT source_id FROM canonical_sources 
    WHERE title ILIKE '%IST%VOFC%' 
    LIMIT 1
""")
ist_source = cur.fetchone()
if ist_source:
    ist_source_id = ist_source[0]
    print(f'\nIST source_id: {ist_source_id}')
    
    # Check OFCs with this source_id
    cur.execute("""
        SELECT candidate_id, snippet_text, source_id, document_chunk_id, title
        FROM ofc_candidate_queue 
        WHERE source_id = %s
        LIMIT 5
    """, (ist_source_id,))
    rows = cur.fetchall()
    print(f'\nOFCs with IST source_id ({len(rows)} found):')
    for r in rows:
        print(f'  ID: {r[0]}, source_id: {r[2]}, chunk_id: {r[3]}, title: {r[4]}')
else:
    print('\nNo IST source found')

# Check if source exists
cur.execute("SELECT source_id, title, citation_text FROM canonical_sources WHERE title ILIKE '%IST%VOFC%' LIMIT 1")
source_row = cur.fetchone()
if source_row:
    print(f'\nIST Source found:')
    print(f'  source_id: {source_row[0]}')
    print(f'  title: {source_row[1]}')
    print(f'  citation_text: {source_row[2]}')
else:
    print('\nNo IST source found in canonical_sources')

# Test the JOIN
cur.execute("""
    SELECT 
        ocq.candidate_id,
        ocq.source_id,
        cs.title as source_title,
        cs.citation_text,
        cs.publisher,
        cs.published_date
    FROM ofc_candidate_queue ocq
    LEFT JOIN canonical_sources cs ON ocq.source_id = cs.source_id
    WHERE ocq.source_id = %s
    LIMIT 5
""", (ist_source_id,))
join_rows = cur.fetchall()
print('\nJOIN test results:')
for r in join_rows:
    print(f'  candidate_id: {r[0]}, source_id: {r[1]}')
    print(f'    source_title: {r[2]}')
    print(f'    citation_text: {r[3]}')
    print(f'    publisher: {r[4]}, published_date: {r[5]}')
    print()

cur.close()
conn.close()
