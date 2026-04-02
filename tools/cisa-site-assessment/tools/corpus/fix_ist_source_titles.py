#!/usr/bin/env python3
"""Fix bad IST source titles in canonical_sources."""
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

# Find sources with bad "Downloading" title
cur.execute("""
    SELECT source_id, title, uri, citation_text 
    FROM canonical_sources 
    WHERE title ILIKE '%Downloading%IST%VOFC%'
""")
bad_sources = cur.fetchall()

print(f"Found {len(bad_sources)} sources with bad titles:")
for source_id, title, uri, citation_text in bad_sources:
    print(f"  {source_id}: {title}")

# Update them to proper title
if bad_sources:
    cur.execute("""
        UPDATE canonical_sources
        SET title = 'IST VOFC (Options for Consideration)',
            citation_text = 'DHS, IST VOFC (Options for Consideration)'
        WHERE title ILIKE '%Downloading%IST%VOFC%'
    """)
    conn.commit()
    print(f"\nUpdated {len(bad_sources)} sources")
else:
    print("\nNo bad sources found")

cur.close()
conn.close()
