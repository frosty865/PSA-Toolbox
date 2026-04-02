#!/usr/bin/env python3
"""Check source_id availability paths."""
import os
import psycopg2

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
conn = psycopg2.connect(os.environ.get('CORPUS_DATABASE_URL') or os.environ.get('DATABASE_URL'))
cur = conn.cursor()

# Check corpus_documents columns
cur.execute("""
    SELECT column_name FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='corpus_documents' 
    AND column_name IN ('source_id', 'source_registry_id')
""")
cols = [r[0] for r in cur.fetchall()]
print(f"corpus_documents columns: {cols}")

# Check if we can get source_id via source_registry
cur.execute("""
    SELECT COUNT(*) FROM document_chunks dc
    JOIN corpus_documents cd ON dc.document_id = cd.id
    LEFT JOIN source_registry sr ON cd.source_registry_id = sr.id
    LEFT JOIN canonical_sources cs ON sr.source_key = cs.source_key
    WHERE cs.source_id IS NOT NULL
    LIMIT 10
""")
via_registry = cur.fetchone()[0]
print(f"Chunks with source_id via source_registry: {via_registry}")

# Check if we can get source_id via documents table
cur.execute("""
    SELECT COUNT(*) FROM document_chunks dc
    LEFT JOIN documents d ON dc.document_id = d.document_id
    WHERE d.source_id IS NOT NULL
    LIMIT 10
""")
via_documents = cur.fetchone()[0]
print(f"Chunks with source_id via documents table: {via_documents}")

# Check total chunks
cur.execute("SELECT COUNT(*) FROM document_chunks")
total = cur.fetchone()[0]
print(f"Total chunks: {total}")

cur.close()
conn.close()
