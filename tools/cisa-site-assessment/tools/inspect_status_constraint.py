#!/usr/bin/env python3
"""Inspect the status constraint on assessments table."""
import os
import psycopg2
from urllib.parse import urlparse

def load_env_file(filepath: str):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.join(script_dir, '..')
env_file = os.path.join(project_root, 'env.local')
if os.path.exists(env_file):
    load_env_file(env_file)

database_url = os.getenv('DATABASE_URL')
if database_url:
    ssl_mode = 'require' if 'supabase' in database_url.lower() else None
    conn = psycopg2.connect(database_url, sslmode=ssl_mode)
else:
    conn = psycopg2.connect(
        host=os.getenv('DATABASE_HOST', 'localhost'),
        port=os.getenv('DATABASE_PORT', '5432'),
        database=os.getenv('DATABASE_NAME', 'postgres'),
        user=os.getenv('DATABASE_USER', 'postgres'),
        password=os.getenv('DATABASE_PASSWORD', '')
    )

cur = conn.cursor()

# Get constraint definition
cur.execute("""
    SELECT 
        tc.constraint_name,
        cc.check_clause
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc 
        ON tc.constraint_name = cc.constraint_name
    WHERE tc.table_schema = 'public'
        AND tc.table_name = 'assessments'
        AND tc.constraint_type = 'CHECK'
        AND tc.constraint_name LIKE '%status%'
""")

print("Status Constraints:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

cur.close()
conn.close()

