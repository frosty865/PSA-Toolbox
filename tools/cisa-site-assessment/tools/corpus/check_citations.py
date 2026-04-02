#!/usr/bin/env python3
"""Quick diagnostic to check citation status."""
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
conn = psycopg2.connect(os.environ.get('CORPUS_DATABASE_URL') or os.environ.get('DATABASE_URL'))
cur = conn.cursor()

# Check total OFCs
cur.execute('SELECT COUNT(*) FROM ofc_candidate_queue')
total = cur.fetchone()[0]
print(f"Total OFCs: {total}")

# Check if submitted_by column exists
cur.execute("""
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='ofc_candidate_queue' AND column_name='submitted_by'
    )
""")
has_submitted_by = cur.fetchone()[0]
print(f"Has submitted_by column: {has_submitted_by}")

if has_submitted_by:
    # Check MINED OFCs
    cur.execute("SELECT COUNT(*) FROM ofc_candidate_queue WHERE submitted_by = 'MINED'")
    mined_total = cur.fetchone()[0]
    print(f"MINED OFCs: {mined_total}")

# Check OFCs with document_chunk_id
cur.execute('SELECT COUNT(*) FROM ofc_candidate_queue WHERE document_chunk_id IS NOT NULL')
with_chunk = cur.fetchone()[0]
print(f"OFCs with document_chunk_id: {with_chunk}")

# Check OFCs with subtype
cur.execute('SELECT COUNT(*) FROM ofc_candidate_queue WHERE discipline_subtype_id IS NOT NULL')
with_subtype = cur.fetchone()[0]
print(f"OFCs with discipline_subtype_id: {with_subtype}")

# Check OFCs with BOTH chunk and subtype
cur.execute("""
    SELECT COUNT(*) FROM ofc_candidate_queue 
    WHERE document_chunk_id IS NOT NULL 
    AND discipline_subtype_id IS NOT NULL
""")
with_both = cur.fetchone()[0]
print(f"OFCs with BOTH chunk_id AND subtype_id: {with_both}")

if has_submitted_by:
    # Check MINED OFCs with document_chunk_id
    cur.execute("SELECT COUNT(*) FROM ofc_candidate_queue WHERE submitted_by = 'MINED' AND document_chunk_id IS NOT NULL")
    mined_with_chunk = cur.fetchone()[0]
    print(f"MINED OFCs with document_chunk_id: {mined_with_chunk}")

    # Check MINED OFCs with subtype
    cur.execute("SELECT COUNT(*) FROM ofc_candidate_queue WHERE submitted_by = 'MINED' AND discipline_subtype_id IS NOT NULL")
    mined_with_subtype = cur.fetchone()[0]
    print(f"MINED OFCs with discipline_subtype_id: {mined_with_subtype}")

    # Check MINED OFCs with BOTH chunk and subtype
    cur.execute("""
        SELECT COUNT(*) FROM ofc_candidate_queue 
        WHERE submitted_by = 'MINED' 
        AND document_chunk_id IS NOT NULL 
        AND discipline_subtype_id IS NOT NULL
    """)
    mined_with_both = cur.fetchone()[0]
    print(f"MINED OFCs with BOTH chunk_id AND subtype_id: {mined_with_both}")

cur.close()
conn.close()
