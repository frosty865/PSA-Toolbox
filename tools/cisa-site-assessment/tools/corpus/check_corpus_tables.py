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
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' 
    AND (table_name ILIKE '%ofc%' OR table_name ILIKE '%candidate%')
    ORDER BY table_name
""")
print('CORPUS OFC tables:')
for row in cur.fetchall():
    print(f"  {row[0]}")

cur.close()
conn.close()
