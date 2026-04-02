#!/usr/bin/env python3
import os
import psycopg2
from pathlib import Path

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
dsn = os.environ.get("CORPUS_DATABASE_URL") or os.environ.get("DATABASE_URL")
conn = psycopg2.connect(dsn)
cur = conn.cursor()

cur.execute("SELECT document_role, COUNT(*) FROM public.corpus_documents GROUP BY document_role")
print("Document roles:")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]}")

cur.close()
conn.close()
