#!/usr/bin/env python3
"""
Run forensic SQL to diagnose why module_chunk_comprehension is empty.
Uses same CORPUS_* and RUNTIME_* env as extract_module_comprehension_from_corpus.py.
"""

import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
from pathlib import Path

# Load .env.local
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent.parent / '.env.local'
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    env_path = Path(__file__).parent.parent.parent / '.env.local'
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip().strip('"').strip("'")


def main():
    corpus_url = (
        os.environ.get("CORPUS_DATABASE_URL")
        or os.environ.get("CORPUS_DB_URL")
        or os.environ.get("DATABASE_URL_CORPUS")
        or ""
    )
    runtime_url = (
        os.environ.get("RUNTIME_DATABASE_URL")
        or os.environ.get("RUNTIME_DB_URL")
        or os.environ.get("DATABASE_URL_RUNTIME")
        or ""
    )
    if not corpus_url or not runtime_url:
        print("Missing CORPUS_DATABASE_URL or RUNTIME_DATABASE_URL. Set both.", file=sys.stderr)
        sys.exit(1)

    # E1-style: log DB (hide password)
    def safe_host(url: str) -> str:
        try:
            from urllib.parse import urlparse
            p = urlparse(url)
            return p.hostname or p.path or "?"
        except Exception:
            return "?"

    print("[FORENSIC] RUNTIME host:", safe_host(runtime_url))
    print("[FORENSIC] CORPUS host:", safe_host(corpus_url))

    with psycopg2.connect(runtime_url) as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT current_database() AS db, current_schema() AS schema")
            row = cur.fetchone()
            print("[FORENSIC] RUNTIME db/schema:", row["db"], row["schema"])

            # A1
            cur.execute("SELECT COUNT(*) AS n FROM public.module_chunk_comprehension")
            a1 = cur.fetchone()["n"]
            print("\nA1) comprehension_rows (RUNTIME):", a1)

            cur.execute(
                "SELECT module_code, COUNT(*) AS n FROM public.module_chunk_comprehension GROUP BY module_code ORDER BY n DESC LIMIT 10"
            )
            for r in cur.fetchall():
                print(f"    module_code={r['module_code']} n={r['n']}")

    with psycopg2.connect(corpus_url) as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # A2
            cur.execute("""
                SELECT
                  (sr.scope_tags->>'module_code') AS module_code,
                  COUNT(dc.chunk_id) AS chunk_rows,
                  COUNT(DISTINCT dc.document_id) AS docs
                FROM public.document_chunks dc
                JOIN public.corpus_documents cd ON cd.id = dc.document_id
                JOIN public.source_registry sr ON sr.id = cd.source_registry_id
                WHERE (sr.scope_tags->>'module_code') IS NOT NULL
                  AND (sr.scope_tags->>'module_code') LIKE 'MODULE_%%'
                GROUP BY (sr.scope_tags->>'module_code')
                ORDER BY chunk_rows DESC
                LIMIT 20
            """)
            rows = cur.fetchall()
            print("\nA2) Eligible chunks per module (CORPUS):")
            if not rows:
                print("    (no rows: no source_registry.scope_tags.module_code or no document_chunks)")
            for r in rows:
                print(f"    module_code={r['module_code']} chunk_rows={r['chunk_rows']} docs={r['docs']}")

            # A4
            cur.execute("""
                SELECT
                  (sr.scope_tags->>'module_code') AS module_code,
                  COUNT(*) AS zero_chunk_sources
                FROM public.source_registry sr
                LEFT JOIN public.corpus_documents cd ON cd.source_registry_id = sr.id
                LEFT JOIN public.document_chunks dc ON dc.document_id = cd.id
                WHERE (sr.scope_tags->>'module_code') LIKE 'MODULE_%%'
                GROUP BY sr.id, (sr.scope_tags->>'module_code')
                HAVING COUNT(dc.chunk_id) = 0
            """)
            a4 = cur.fetchall()
            print("\nA4) Sources with zero chunks (CORPUS):", len(a4))
            for r in a4[:5]:
                print(f"    module_code={r['module_code']}")

            # B) Debug: per source_registry (module-tagged) show docs and chunks so we can see why "ingested" but 0 chunks
            cur.execute("""
                SELECT
                  sr.id AS source_registry_id,
                  sr.source_key,
                  sr.title,
                  (sr.scope_tags->>'module_code') AS module_code,
                  COUNT(DISTINCT cd.id) AS corpus_docs,
                  COUNT(dc.chunk_id) AS chunk_count
                FROM public.source_registry sr
                LEFT JOIN public.corpus_documents cd ON cd.source_registry_id = sr.id
                LEFT JOIN public.document_chunks dc ON dc.document_id = cd.id
                WHERE (sr.scope_tags->>'module_code') IS NOT NULL
                  AND (sr.scope_tags->>'module_code') LIKE 'MODULE_%%'
                GROUP BY sr.id, sr.source_key, sr.title, (sr.scope_tags->>'module_code')
                ORDER BY (sr.scope_tags->>'module_code'), sr.source_key
            """)
            b_rows = cur.fetchall()
            print("\nB) Module-tagged sources: corpus_docs and chunk_count (CORPUS):")
            if not b_rows:
                print("    (no module-tagged sources)")
            for r in b_rows:
                print(f"    source_registry_id={r['source_registry_id']} source_key={r['source_key']!r} module_code={r['module_code']} corpus_docs={r['corpus_docs']} chunk_count={r['chunk_count']}")

            # B2) If any have corpus_docs > 0 but chunk_count = 0, show corpus_documents processing_status
            cur.execute("""
                SELECT
                  cd.id AS corpus_document_id,
                  cd.source_registry_id,
                  cd.inferred_title,
                  cd.processing_status,
                  COALESCE(cd.chunk_count, 0) AS doc_chunk_count,
                  cd.last_error
                FROM public.corpus_documents cd
                JOIN public.source_registry sr ON sr.id = cd.source_registry_id
                WHERE (sr.scope_tags->>'module_code') IS NOT NULL
                  AND (sr.scope_tags->>'module_code') LIKE 'MODULE_%%'
                ORDER BY cd.source_registry_id, cd.id
            """)
            b2_rows = cur.fetchall()
            # Only show if we have docs with 0 chunks (processing_status / last_error explain why)
            zero_chunk_docs = [x for x in b2_rows if (x.get('doc_chunk_count') or 0) == 0]
            if zero_chunk_docs:
                print("\nB2) corpus_documents with 0 chunks (processing_status / last_error):")
                for r in zero_chunk_docs[:15]:
                    err = (r.get('last_error') or "")[:80]
                    print(f"    doc_id={r['corpus_document_id']} source_registry_id={r['source_registry_id']} status={r.get('processing_status')} chunk_count={r.get('doc_chunk_count')} last_error={err!r}")
            elif b2_rows:
                print("\nB2) All module-tagged corpus_documents have chunk_count > 0 (no 0-chunk docs to show).")

    print("\nInterpretation:")
    if a1 == 0 and rows:
        total_chunks = sum(r["chunk_rows"] for r in rows)
        if total_chunks > 0:
            print("  -> A2 > 0 but comprehension_rows = 0: persistence path missing/disabled/failing.")
            print("     Run: python tools/module_crawler/extract_module_comprehension_from_corpus.py --module-code <MODULE> --model <MODEL> --apply")
        else:
            print("  -> No chunks in CORPUS for MODULE_* modules. Fix tagging/ingestion (scope_tags.module_code).")
    elif a1 == 0 and not rows:
        print("  -> No eligible chunks (A2 empty). Fix source_registry.scope_tags.module_code and document_chunks.")
        if b_rows and all((r.get("corpus_docs") or 0) == 0 for r in b_rows):
            print("  -> B shows corpus_docs=0 for all module-tagged sources: no corpus_documents linked.")
            print("     'Ingested' in UI may mean RUNTIME/module_sources only. Run CORPUS ingestion for these")
            print("     source_registry rows (ingest API or download-to-incoming + ingest) so corpus_documents")
            print("     and document_chunks are created in CORPUS.")
    else:
        print("  -> Comprehension table has rows. Check per-module counts above.")


if __name__ == "__main__":
    main()
