#!/usr/bin/env python3
"""Quick script to mark a document as OFC_SOURCE for testing."""
import os, psycopg2, sys

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

# Get first document with source_registry_id
cur.execute("SELECT id, inferred_title, source_registry_id FROM corpus_documents WHERE source_registry_id IS NOT NULL ORDER BY created_at DESC LIMIT 1")
row = cur.fetchone()
if not row:
    print("No documents with source_registry_id found")
    sys.exit(1)

doc_id, title, sr_id = row
print(f"Marking document as OFC_SOURCE: {doc_id}")
print(f"Title: {title[:60] if title else '(no title)'}")
print(f"Source Registry ID: {sr_id}")

cur.execute("UPDATE corpus_documents SET document_role = 'OFC_SOURCE' WHERE id = %s", (doc_id,))
conn.commit()
print("Done!")

cur.close()
conn.close()
