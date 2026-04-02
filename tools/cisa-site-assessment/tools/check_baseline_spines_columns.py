#!/usr/bin/env python3
import os
import psycopg2

RUNTIME_PASSWORD = os.getenv('RUNTIME_DB_PASSWORD') or os.getenv('SUPABASE_RUNTIME_DB_PASSWORD')

conn = psycopg2.connect(
    host='db.wivohgbuuwxoyfyzntsd.supabase.co',
    port='5432',
    user='postgres',
    password=RUNTIME_PASSWORD,
    database='postgres',
    sslmode='require'
)

cur = conn.cursor()
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'baseline_spines_runtime' 
    ORDER BY ordinal_position
""")

print("Columns in baseline_spines_runtime:")
for row in cur.fetchall():
    print(f"  {row[0]} ({row[1]})")

cur.close()
conn.close()
