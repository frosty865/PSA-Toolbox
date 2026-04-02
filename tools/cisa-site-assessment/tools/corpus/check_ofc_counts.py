#!/usr/bin/env python3
"""Quick check of OFC counts by submitted_by."""
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
dsn = os.environ.get('CORPUS_DATABASE_URL') or os.environ.get('DATABASE_URL')
conn = psycopg2.connect(dsn)
cur = conn.cursor()

# Check if submitted_by column exists
cur.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_candidate_queue'
    AND column_name = 'submitted_by'
""")
has_submitted_by = cur.fetchone() is not None

# Check if source_registry_id column exists
cur.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_candidate_queue'
    AND column_name = 'source_registry_id'
""")
has_sr_id = cur.fetchone() is not None

cur.execute("SELECT COUNT(*) FROM public.ofc_candidate_queue")
total = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM public.ofc_candidate_queue WHERE document_chunk_id IS NOT NULL")
with_chunk = cur.fetchone()[0]

print("=" * 60)
print("OFC Candidate Queue Status")
print("=" * 60)
print(f"Total OFCs: {total}")
print(f"With document_chunk_id (mined): {with_chunk}")
print(f"Without document_chunk_id (IST/other): {total - with_chunk}")

if has_submitted_by:
    cur.execute("""
        SELECT submitted_by, COUNT(*) as count,
               COUNT(document_chunk_id) as with_chunk_id
        FROM public.ofc_candidate_queue
        GROUP BY submitted_by
        ORDER BY submitted_by
    """)
    print("\nBreakdown by submitted_by:")
    for row in cur.fetchall():
        print(f"  {row[0] or 'NULL'}: {row[1]} total, {row[2]} with chunk_id")
else:
    print("\n[INFO] submitted_by column does not exist")

if has_sr_id:
    cur.execute("SELECT COUNT(*) FROM public.ofc_candidate_queue WHERE source_registry_id IS NOT NULL")
    with_sr_id = cur.fetchone()[0]
    print(f"\nWith source_registry_id: {with_sr_id}")
else:
    print("\n[INFO] source_registry_id column does not exist (migration not applied)")

cur.close()
conn.close()
