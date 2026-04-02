#!/usr/bin/env python3
"""Quick script to check assessment table schema."""
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

load_env_file('env.local')
database_url = os.getenv('DATABASE_URL')
conn = psycopg2.connect(database_url, sslmode='require' if 'supabase' in database_url.lower() else None)
cur = conn.cursor()

# Get columns
cur.execute("""
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'assessments'
    ORDER BY ordinal_position
""")
print("Columns:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]} (nullable: {row[2]}, default: {row[3]})")

# Get constraints
cur.execute("""
    SELECT constraint_name, check_clause
    FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%assessment%status%'
""")
print("\nStatus Constraints:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

cur.close()
conn.close()

