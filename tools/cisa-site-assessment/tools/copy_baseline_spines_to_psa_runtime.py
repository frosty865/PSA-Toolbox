#!/usr/bin/env python3
"""
Copy baseline_spines_runtime data from postgres to psa_runtime database
"""

import os
import sys
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Get connection details
RUNTIME_HOST = os.getenv('RUNTIME_DB_HOST', 'db.wivohgbuuwxoyfyzntsd.supabase.co')
RUNTIME_PORT = os.getenv('RUNTIME_DB_PORT', '5432')
RUNTIME_USER = os.getenv('RUNTIME_DB_USER', 'postgres')
RUNTIME_PASSWORD = os.getenv('RUNTIME_DB_PASSWORD') or os.getenv('SUPABASE_RUNTIME_DB_PASSWORD')

if not RUNTIME_PASSWORD:
    print("Error: RUNTIME_DB_PASSWORD or SUPABASE_RUNTIME_DB_PASSWORD environment variable not set")
    sys.exit(1)

# Connect to postgres database
print("Step 1: Connecting to postgres database...")
conn_postgres = psycopg2.connect(
    host=RUNTIME_HOST,
    port=RUNTIME_PORT,
    user=RUNTIME_USER,
    password=RUNTIME_PASSWORD,
    database='postgres',
    sslmode='require'
)

# Get data from postgres
cur_postgres = conn_postgres.cursor()
cur_postgres.execute("""
    SELECT 
        canon_id,
        discipline_code,
        subtype_code,
        question_text,
        response_enum,
        canon_version,
        canon_hash,
        active,
        loaded_at
    FROM baseline_spines_runtime
    ORDER BY canon_id
""")

rows = cur_postgres.fetchall()
column_names = [desc[0] for desc in cur_postgres.description]
cur_postgres.close()
conn_postgres.close()

print(f"Found {len(rows)} rows to copy")

if len(rows) == 0:
    print("⚠️  No data found in postgres.baseline_spines_runtime")
    print("You may need to seed the baseline spines data first.")
    sys.exit(0)

# Connect to psa_runtime database
print("Step 2: Connecting to psa_runtime database...")
conn_psa_runtime = psycopg2.connect(
    host=RUNTIME_HOST,
    port=RUNTIME_PORT,
    user=RUNTIME_USER,
    password=RUNTIME_PASSWORD,
    database='psa_runtime',
    sslmode='require'
)
conn_psa_runtime.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)

cur_runtime = conn_psa_runtime.cursor()

# Insert data
print("Step 3: Copying data to psa_runtime...")
insert_query = """
    INSERT INTO baseline_spines_runtime (
        canon_id,
        discipline_code,
        subtype_code,
        question_text,
        response_enum,
        canon_version,
        canon_hash,
        active,
        loaded_at
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (canon_id) DO UPDATE SET
        discipline_code = EXCLUDED.discipline_code,
        subtype_code = EXCLUDED.subtype_code,
        question_text = EXCLUDED.question_text,
        response_enum = EXCLUDED.response_enum,
        canon_version = EXCLUDED.canon_version,
        canon_hash = EXCLUDED.canon_hash,
        active = EXCLUDED.active,
        loaded_at = EXCLUDED.loaded_at
"""

success_count = 0
error_count = 0

import json

for row in rows:
    try:
        # Convert response_enum from array to JSONB if needed
        row_list = list(row)
        if isinstance(row_list[4], list):
            # Convert Python list to JSON string for JSONB
            row_list[4] = json.dumps(row_list[4])
        elif isinstance(row_list[4], str) and row_list[4].startswith('{'):
            # Already JSON string, keep as is
            pass
        else:
            # Try to convert array literal to JSON
            row_list[4] = json.dumps(row_list[4])
        
        cur_runtime.execute(insert_query, tuple(row_list))
        success_count += 1
    except Exception as e:
        error_count += 1
        print(f"  ✗ Error inserting {row[0]}: {e}")

cur_runtime.close()
conn_psa_runtime.close()

print(f"\n✓ Data copy complete! ({success_count} succeeded, {error_count} errors)")

# Verify
print("\nStep 4: Verifying data in psa_runtime...")
conn_verify = psycopg2.connect(
    host=RUNTIME_HOST,
    port=RUNTIME_PORT,
    user=RUNTIME_USER,
    password=RUNTIME_PASSWORD,
    database='psa_runtime',
    sslmode='require'
)
cur_verify = conn_verify.cursor()
cur_verify.execute("SELECT COUNT(*) FROM baseline_spines_runtime WHERE active = true")
active_count = cur_verify.fetchone()[0]
cur_verify.execute("SELECT COUNT(*) FROM baseline_spines_runtime")
total_count = cur_verify.fetchone()[0]
cur_verify.close()
conn_verify.close()

print(f"  Active spines: {active_count}")
print(f"  Total spines: {total_count}")
