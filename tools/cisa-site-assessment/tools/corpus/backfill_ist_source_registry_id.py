#!/usr/bin/env python3
"""
Backfill source_registry_id for IST-imported OFCs.

Deterministic: Only updates rows where submitted_by = 'IST_IMPORT' and source_id exists.
Uses explicit join through canonical_sources.source_key -> source_registry.source_key.
"""
import argparse, os, sys
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
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Apply updates (default: dry run)")
    args = ap.parse_args()

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
        raise SystemExit("Column source_registry_id does not exist. Run migration 20260202_add_source_registry_id_to_ofc_candidates.sql first.")

    # Check if submitted_by column exists
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'ofc_candidate_queue'
        AND column_name = 'submitted_by'
    """)
    has_submitted_by = cur.fetchone() is not None

    # Identify IST OFCs: have source_id but NO document_chunk_id (IST imports don't have chunk citations)
    # MINED OFCs have document_chunk_id, IST OFCs don't
    if has_submitted_by:
        ist_filter_base = "submitted_by = 'IST_IMPORT' AND source_id IS NOT NULL"
        ist_filter_with_q = "q.submitted_by = 'IST_IMPORT' AND q.source_id IS NOT NULL"
        mined_filter_base = "submitted_by = 'MINED'"
        mined_filter_with_q = "q.submitted_by = 'MINED'"
    else:
        # Fallback: IST OFCs = have source_id but NO document_chunk_id
        ist_filter_base = "source_id IS NOT NULL AND document_chunk_id IS NULL"
        ist_filter_with_q = "q.source_id IS NOT NULL AND q.document_chunk_id IS NULL"
        mined_filter_base = "document_chunk_id IS NOT NULL"
        mined_filter_with_q = "q.document_chunk_id IS NOT NULL"

    # Count IST OFCs before update
    cur.execute(f"""
        SELECT COUNT(*) FROM public.ofc_candidate_queue
        WHERE {ist_filter_base}
    """)
    ist_total = cur.fetchone()[0]

    # Count IST OFCs that already have source_registry_id
    cur.execute(f"""
        SELECT COUNT(*) FROM public.ofc_candidate_queue
        WHERE {ist_filter_base}
        AND source_registry_id IS NOT NULL
    """)
    ist_with_sr_id = cur.fetchone()[0]

    # Count IST OFCs that can be updated
    # Try source_key match first, then URI match if source_key is NULL
    cur.execute(f"""
        SELECT COUNT(*) FROM public.ofc_candidate_queue q
        WHERE {ist_filter_with_q}
        AND q.source_registry_id IS NULL
        AND EXISTS (
            SELECT 1 FROM public.canonical_sources cs
            LEFT JOIN public.source_registry s1 ON cs.source_key = s1.source_key AND cs.source_key IS NOT NULL
            LEFT JOIN public.source_registry s2 ON cs.uri = s2.canonical_url AND cs.uri IS NOT NULL AND cs.source_key IS NULL
            WHERE cs.source_id = q.source_id
            AND (s1.id IS NOT NULL OR s2.id IS NOT NULL)
        )
    """)
    eligible_count = cur.fetchone()[0]

    # Count MINED OFCs (should NOT get source_registry_id)
    cur.execute(f"""
        SELECT COUNT(*) FROM public.ofc_candidate_queue
        WHERE {mined_filter_base}
        AND source_registry_id IS NOT NULL
    """)
    mined_with_sr_id = cur.fetchone()[0]

    print("=" * 70)
    print("IST OFC Source Registry Backfill")
    print("=" * 70)
    print(f"\nIST OFCs total: {ist_total}")
    print(f"IST OFCs with source_registry_id: {ist_with_sr_id}")
    print(f"IST OFCs eligible for update: {eligible_count}")
    print(f"\nMINED OFCs with source_registry_id (should be 0): {mined_with_sr_id}")

    if mined_with_sr_id > 0:
        print("\n[WARN] MINED OFCs have source_registry_id - this should not happen!")
        print("        Review data before proceeding.")

    if eligible_count == 0:
        print("\n[OK] No IST OFCs need updating.")
        cur.close()
        conn.close()
        return

    # Preview what will be updated
    cur.execute(f"""
        SELECT q.candidate_id, q.source_id, cs.source_key, cs.uri,
               COALESCE(s1.id, s2.id)::text as source_registry_id,
               COALESCE(s1.title, s2.title) as title
        FROM public.ofc_candidate_queue q
        JOIN public.canonical_sources cs ON q.source_id = cs.source_id
        LEFT JOIN public.source_registry s1 ON cs.source_key = s1.source_key AND cs.source_key IS NOT NULL
        LEFT JOIN public.source_registry s2 ON cs.uri = s2.canonical_url AND cs.uri IS NOT NULL AND cs.source_key IS NULL
        WHERE {ist_filter_with_q}
        AND q.source_registry_id IS NULL
        AND (s1.id IS NOT NULL OR s2.id IS NOT NULL)
        LIMIT 10
    """)
    preview = cur.fetchall()
    
    if preview:
        print("\nPreview (first 10 rows to be updated):")
        for row in preview:
            print(f"  candidate_id={row[0]}, source_id={row[1]}, source_key={row[2] or 'NULL'}, uri={row[3] or 'NULL'}, source_registry_id={row[4]}, title={row[5][:50] if row[5] else 'NULL'}")

    if not args.apply:
        print(f"\n[DRY RUN] Would update {eligible_count} IST OFCs with source_registry_id")
        print("          Run with --apply to execute updates")
        cur.close()
        conn.close()
        return

    # Apply updates - use source_key match if available, else URI match
    cur.execute(f"""
        UPDATE public.ofc_candidate_queue q
        SET source_registry_id = COALESCE(s1.id, s2.id)
        FROM public.canonical_sources cs
        LEFT JOIN public.source_registry s1 ON cs.source_key = s1.source_key AND cs.source_key IS NOT NULL
        LEFT JOIN public.source_registry s2 ON cs.uri = s2.canonical_url AND cs.uri IS NOT NULL AND cs.source_key IS NULL
        WHERE {ist_filter_with_q}
        AND q.source_registry_id IS NULL
        AND q.source_id = cs.source_id
        AND (s1.id IS NOT NULL OR s2.id IS NOT NULL)
    """)
    updated = cur.rowcount
    conn.commit()

    # Verify no MINED rows got updated
    cur.execute(f"""
        SELECT COUNT(*) FROM public.ofc_candidate_queue
        WHERE {mined_filter_base}
        AND source_registry_id IS NOT NULL
    """)
    mined_with_sr_id_after = cur.fetchone()[0]

    print(f"\n[OK] Updated {updated} IST OFCs with source_registry_id")
    print(f"[VERIFY] MINED OFCs with source_registry_id: {mined_with_sr_id_after} (should be 0)")

    if mined_with_sr_id_after > 0:
        print("[ERROR] MINED OFCs have source_registry_id after update - this is a bug!")
        sys.exit(1)

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
