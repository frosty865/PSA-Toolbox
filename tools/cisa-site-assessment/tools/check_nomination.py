#!/usr/bin/env python3
"""Quick script to check the nomination that was created."""
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
env_file = os.path.join(project_root, '.env.local')
if os.path.exists(env_file):
    load_env_file(env_file)

database_url = os.getenv('DATABASE_URL')
conn = psycopg2.connect(database_url, sslmode='require')
cur = conn.cursor()

# Find all recent nominations
cur.execute("""
    SELECT nomination_id, assessment_id, finding_id, proposed_title, status, 
           submitted_by, submitted_role, submitted_at
    FROM public.ofc_nominations
    ORDER BY submitted_at DESC
    LIMIT 10
""")

print("Nominations for BASE-022:")
for row in cur.fetchall():
    print(f"  Nomination ID: {row[0]}")
    print(f"    Assessment ID: {row[1]}")
    print(f"    Finding ID: {row[2]}")
    print(f"    Title: {row[3]}")
    print(f"    Status: {row[4]}")
    print(f"    Submitted by: {row[5]}")
    print(f"    Submitted role: {row[6]}")
    print()

cur.close()
conn.close()

