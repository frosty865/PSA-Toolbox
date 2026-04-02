#!/usr/bin/env python3
"""
Verify source_registry status for IST OFCs.

Checks that:
- source_registry rows referenced by IST OFCs exist
- If status column exists, status = 'ACTIVE'
- If no status column, existence alone is sufficient
"""
import os
from pathlib import Path

def load_env_file(filepath: str):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip().strip('"').strip("'")

def get_corpus_db():
    import psycopg2
    load_env_file('.env.local')
    dsn = os.environ.get('CORPUS_DATABASE_URL') or os.environ.get('DATABASE_URL')
    if dsn:
        return psycopg2.connect(dsn)
    raise SystemExit("Missing CORPUS_DATABASE_URL")

def main():
    conn = get_corpus_db()
    cur = conn.cursor()

    # Check if source_registry_id column exists
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'ofc_candidate_queue'
        AND column_name = 'source_registry_id'
    """)
    if not cur.fetchone():
        cur.close()
        conn.close()
        print("[SKIP] Column source_registry_id does not exist yet. Run migration first.")
        return

    # Check if source_registry has status column
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'source_registry'
        AND column_name = 'status'
    """)
    has_status = cur.fetchone() is not None

    # Get IST OFCs with source_registry_id (IST = no document_chunk_id)
    cur.execute("""
        SELECT DISTINCT q.source_registry_id
        FROM public.ofc_candidate_queue q
        WHERE q.document_chunk_id IS NULL
        AND q.source_registry_id IS NOT NULL
    """)
    ist_sr_ids = [str(r[0]) for r in cur.fetchall()]

    if not ist_sr_ids:
        print("[INFO] No IST OFCs have source_registry_id yet. Run backfill first.")
        cur.close()
        conn.close()
        return

    print(f"[INFO] Found {len(ist_sr_ids)} unique source_registry_ids from IST OFCs")

    # Check if all source_registry rows exist
    if has_status:
        cur.execute("""
            SELECT s.id, s.source_key, s.title, s.status
            FROM public.source_registry s
            WHERE s.id = ANY(%s::uuid[])
        """, (ist_sr_ids,))
    else:
        cur.execute("""
            SELECT s.id, s.source_key, s.title, NULL as status
            FROM public.source_registry s
            WHERE s.id = ANY(%s::uuid[])
        """, (ist_sr_ids,))

    found_sources = cur.fetchall()
    found_ids = set(str(r[0]) for r in found_sources)

    missing_ids = set(ist_sr_ids) - found_ids
    if missing_ids:
        print(f"\n[ERROR] {len(missing_ids)} source_registry_ids referenced by IST OFCs do not exist:")
        for sid in list(missing_ids)[:10]:
            print(f"  {sid}")
        if len(missing_ids) > 10:
            print(f"  ... and {len(missing_ids) - 10} more")
    else:
        print(f"\n[OK] All {len(found_sources)} source_registry entries exist")

    # Check status if column exists
    if has_status:
        inactive = [r for r in found_sources if r[3] != 'ACTIVE']
        if inactive:
            print(f"\n[WARN] {len(inactive)} source_registry entries are not ACTIVE:")
            for r in inactive[:10]:
                print(f"  {r[1]} ({r[2][:50]}): status={r[3]}")
            if len(inactive) > 10:
                print(f"  ... and {len(inactive) - 10} more")
        else:
            print(f"\n[OK] All {len(found_sources)} source_registry entries are ACTIVE")
    else:
        print(f"\n[OK] No status column - existence check passed for {len(found_sources)} entries")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
