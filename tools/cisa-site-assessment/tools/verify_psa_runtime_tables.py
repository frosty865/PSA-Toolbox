#!/usr/bin/env python3
"""Verify critical tables exist in psa_runtime"""

import os
import sys
import psycopg2

RUNTIME_HOST = os.getenv('RUNTIME_DB_HOST', 'db.wivohgbuuwxoyfyzntsd.supabase.co')
RUNTIME_PORT = os.getenv('RUNTIME_DB_PORT', '5432')
RUNTIME_USER = os.getenv('RUNTIME_DB_USER', 'postgres')
RUNTIME_PASSWORD = os.getenv('RUNTIME_DB_PASSWORD') or os.getenv('SUPABASE_RUNTIME_DB_PASSWORD')

if not RUNTIME_PASSWORD:
    print("Error: RUNTIME_DB_PASSWORD or SUPABASE_RUNTIME_DB_PASSWORD environment variable not set")
    sys.exit(1)

conn = psycopg2.connect(
    host=RUNTIME_HOST,
    port=RUNTIME_PORT,
    user=RUNTIME_USER,
    password=RUNTIME_PASSWORD,
    database='psa_runtime',
    sslmode='require'
)

cur = conn.cursor()

# Check critical tables
critical_tables = ['assessments', 'ofc_library_citations', 'assessment_definitions', 'facilities']

print("Verifying critical tables in psa_runtime:")
for table in critical_tables:
    cur.execute("""
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = %s
    """, (table,))
    exists = cur.fetchone()[0] > 0
    status = "✓" if exists else "✗"
    print(f"  {status} {table}")

# Get total table count
cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
total = cur.fetchone()[0]
print(f"\nTotal tables in psa_runtime: {total}")

cur.close()
conn.close()
