#!/usr/bin/env python3
"""Debug IST backfill - check join path."""
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

# Check canonical_sources.source_key population
cur.execute("""
    SELECT COUNT(*) FROM public.canonical_sources WHERE source_key IS NOT NULL
""")
cs_with_key = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM public.canonical_sources")
cs_total = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM public.source_registry")
sr_total = cur.fetchone()[0]

# Check IST OFCs (no document_chunk_id)
cur.execute("""
    SELECT COUNT(*) FROM public.ofc_candidate_queue
    WHERE document_chunk_id IS NULL AND source_id IS NOT NULL
""")
ist_total = cur.fetchone()[0]

# Check IST OFCs that have canonical_sources with source_key
cur.execute("""
    SELECT COUNT(*) FROM public.ofc_candidate_queue q
    JOIN public.canonical_sources cs ON q.source_id = cs.source_id
    WHERE q.document_chunk_id IS NULL
    AND cs.source_key IS NOT NULL
""")
ist_with_key = cur.fetchone()[0]

# Check if any source_keys match
cur.execute("""
    SELECT COUNT(*) FROM public.ofc_candidate_queue q
    JOIN public.canonical_sources cs ON q.source_id = cs.source_id
    JOIN public.source_registry s ON cs.source_key = s.source_key
    WHERE q.document_chunk_id IS NULL
""")
ist_matchable = cur.fetchone()[0]

print("=" * 60)
print("IST Backfill Debug")
print("=" * 60)
print(f"canonical_sources total: {cs_total}")
print(f"canonical_sources with source_key: {cs_with_key}")
print(f"source_registry total: {sr_total}")
print(f"\nIST OFCs (no document_chunk_id): {ist_total}")
print(f"IST OFCs with canonical_sources.source_key: {ist_with_key}")
print(f"IST OFCs matchable to source_registry: {ist_matchable}")

# Sample IST OFCs
cur.execute("""
    SELECT q.candidate_id, q.source_id, cs.source_key, s.id as sr_id
    FROM public.ofc_candidate_queue q
    LEFT JOIN public.canonical_sources cs ON q.source_id = cs.source_id
    LEFT JOIN public.source_registry s ON cs.source_key = s.source_key
    WHERE q.document_chunk_id IS NULL
    LIMIT 5
""")
print("\nSample IST OFCs:")
for row in cur.fetchall():
    print(f"  candidate_id={row[0]}, source_id={row[1]}, source_key={row[2]}, sr_id={row[3]}")

cur.close()
conn.close()
