#!/usr/bin/env python3
"""
Load module VOFCs from JSON into module_ofc_library and module_ofc_citations.

IMPORTANT: This script must be run in a virtual environment (venv).
  Activate venv first:
    Windows: .venv\Scripts\activate
    Linux/Mac: source .venv/bin/activate
"""
import os
import json
import sys
from pathlib import Path

# Check if running in a virtual environment
if not hasattr(sys, 'real_prefix') and not (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
    print("ERROR: This script must be run in a virtual environment (venv)")
    print("\nTo activate venv:")
    print("  Windows: .venv\\Scripts\\activate")
    print("  Linux/Mac: source .venv/bin/activate")
    print("\nOr create a venv if it doesn't exist:")
    print("  python -m venv .venv")
    sys.exit(1)

import psycopg2

def require_env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        raise SystemExit(f"Missing required env var: {name}")
    return v

def main():
    # Need RUNTIME for module_ofc_library, and either RUNTIME or CORPUS for source_registry
    runtime_db_url = os.environ.get("RUNTIME_DATABASE_URL") or os.environ.get("DATABASE_URL")
    corpus_db_url = os.environ.get("CORPUS_DATABASE_URL")
    
    if not runtime_db_url:
        raise SystemExit("Set RUNTIME_DATABASE_URL (preferred) or DATABASE_URL")

    json_path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if not json_path:
        raise SystemExit("Usage: python tools/module_seed/load_module_vofcs.py <module_vofcs.json>")
    if not json_path.exists():
        raise SystemExit(f"Seed JSON not found: {json_path}")

    payload = json.loads(json_path.read_text(encoding="utf-8"))

    module_code = payload.get("module_code")
    if not module_code:
        raise SystemExit("JSON missing module_code")

    source = payload.get("source") or {}
    source_path = source.get("source_path")
    source_sha256 = source.get("source_sha256")
    source_title = source.get("title") or (Path(source_path).name if source_path else "Module VOFC Source")

    if not source_path or not source_sha256:
        raise SystemExit("JSON missing source.source_path or source.source_sha256")

    items = payload.get("items") or []
    if not isinstance(items, list):
        raise SystemExit("JSON items must be a list")

    # Connect to RUNTIME for module_ofc_library
    runtime_conn = psycopg2.connect(runtime_db_url)
    runtime_conn.autocommit = False
    runtime_cur = runtime_conn.cursor()

    # Determine which database has source_registry
    # Try RUNTIME first (user said it might be accessible there)
    source_registry_conn = None
    source_registry_cur = None
    source_registry_db_name = None
    
    try:
        # Check if source_registry exists in RUNTIME
        runtime_cur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'source_registry'
            )
        """)
        has_sr_in_runtime = runtime_cur.fetchone()[0]
        
        if has_sr_in_runtime:
            source_registry_conn = runtime_conn
            source_registry_cur = runtime_cur
            source_registry_db_name = "RUNTIME"
            print("[INFO] Using source_registry from RUNTIME database")
        elif corpus_db_url:
            # Fall back to CORPUS
            source_registry_conn = psycopg2.connect(corpus_db_url)
            source_registry_conn.autocommit = False
            source_registry_cur = source_registry_conn.cursor()
            source_registry_db_name = "CORPUS"
            print("[INFO] Using source_registry from CORPUS database")
        else:
            raise SystemExit("source_registry not found in RUNTIME and CORPUS_DATABASE_URL not set")
    except Exception as e:
        if corpus_db_url:
            # Try CORPUS as fallback
            try:
                source_registry_conn = psycopg2.connect(corpus_db_url)
                source_registry_conn.autocommit = False
                source_registry_cur = source_registry_conn.cursor()
                source_registry_db_name = "CORPUS"
                print("[INFO] Using source_registry from CORPUS database (fallback)")
            except Exception as e2:
                raise SystemExit(f"Failed to connect to CORPUS: {e2}. Set CORPUS_DATABASE_URL or ensure source_registry exists in RUNTIME.")
        else:
            raise SystemExit(f"source_registry check failed: {e}. Set CORPUS_DATABASE_URL or ensure source_registry exists in RUNTIME.")

    try:
        # 1) Ensure source_registry row exists for the XLSX source
        # Deterministic source_key: local:<filename>:<hashprefix>
        source_key = f"local:{Path(source_path).name}:{source_sha256[:8]}"

        source_registry_cur.execute(
            """
            INSERT INTO public.source_registry
              (source_key, source_type, title, local_path, doc_sha256, scope_tags, notes, retrieved_at)
            VALUES
              (%s, 'LOCAL_FILE', %s, %s, %s, %s::jsonb, %s, now())
            ON CONFLICT (doc_sha256) DO UPDATE
              SET local_path = EXCLUDED.local_path,
                  title = COALESCE(public.source_registry.title, EXCLUDED.title),
                  scope_tags = COALESCE(public.source_registry.scope_tags, '{}'::jsonb) || EXCLUDED.scope_tags,
                  notes = COALESCE(public.source_registry.notes, ''),
                  updated_at = now()
            RETURNING id
            """,
            (
                source_key,
                source_title,
                source_path,
                source_sha256,
                json.dumps({"source_type": "XLSX", "module_code": module_code}),
                "module_vofc_loader: VOFC seed import"
            )
        )
        source_registry_id = source_registry_cur.fetchone()[0]
        if source_registry_conn != runtime_conn:
            source_registry_conn.commit()

        inserted = 0

        for it in items:
            title = (it.get("title") or "").strip()
            vofc_text = (it.get("vofc_text") or "").strip()
            tags = it.get("tags") or []
            citation = it.get("citation") or {}

            if not title:
                title = (vofc_text[:140] if vofc_text else "Module VOFC")  # deterministic fallback
            if not vofc_text:
                # skip empty entries
                continue

            locator_type = citation.get("locator_type") or "XLSX_SHEET_ROW"
            locator_json = citation.get("locator_json") or {}

            # 2) Insert module VOFC in RUNTIME
            runtime_cur.execute(
                """
                INSERT INTO public.module_ofc_library (module_code, title, vofc_text, tags, status)
                VALUES (%s, %s, %s, %s::jsonb, 'ACTIVE')
                RETURNING id
                """,
                (module_code, title, vofc_text, json.dumps(tags))
            )
            module_ofc_id = runtime_cur.fetchone()[0]

            # 3) Citation row in RUNTIME (references source_registry_id from CORPUS)
            runtime_cur.execute(
                """
                INSERT INTO public.module_ofc_citations
                  (module_ofc_id, source_registry_id, locator_type, locator_json, quote)
                VALUES
                  (%s, %s, %s, %s::jsonb, NULL)
                """,
                (module_ofc_id, source_registry_id, locator_type, json.dumps(locator_json))
            )

            inserted += 1

        runtime_conn.commit()
        print(f"✓ Loaded {inserted} module VOFC(s) into module_ofc_library for {module_code}")
        print(f"✓ Source Registry (XLSX) id: {source_registry_id} (in {source_registry_db_name})")

    except Exception as e:
        if source_registry_conn and source_registry_conn != runtime_conn:
            source_registry_conn.rollback()
        runtime_conn.rollback()
        raise
    finally:
        if source_registry_cur and source_registry_conn != runtime_conn:
            source_registry_cur.close()
            source_registry_conn.close()
        runtime_cur.close()
        runtime_conn.close()

if __name__ == "__main__":
    main()
