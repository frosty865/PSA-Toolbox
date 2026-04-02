"""
Purge all module-related data for a clean start.

Safety:
- DRY RUN by default (no deletes).
- Set ALLOW_MODULE_PURGE=YES to execute deletes.
- Set ALLOW_MODULE_PURGE_FS=YES to delete module source files under MODULE_SOURCES_ROOT.
- Set ALLOW_MODULE_PURGE_SOURCE_REGISTRY=YES to delete module-tagged source_registry rows in CORPUS.

Required env vars (either set):
- PSA_RUNTIME_DB_URL or RUNTIME_DATABASE_URL
- PSA_CORPUS_DB_URL or CORPUS_DATABASE_URL

Optional env vars:
- MODULE_SOURCES_ROOT (defaults to psa_rebuild/storage/module_sources)
"""

from __future__ import annotations

import os
import sys
import shutil
from pathlib import Path
from typing import Dict, List, Tuple

# Load .env then .env.local from psa_rebuild so RUNTIME_DATABASE_URL / CORPUS_DATABASE_URL are available when run directly
def _load_env() -> None:
    root = Path(__file__).resolve().parent.parent.parent
    for name in (".env", ".env.local"):
        p = root / name
        if p.exists():
            with open(p, encoding="utf-8", errors="replace") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        v = v.strip().strip('"').strip("'").strip()
                        os.environ[k.strip()] = v

def _die(msg: str) -> None:
    print(f"[FATAL] {msg}", file=sys.stderr)
    sys.exit(1)

def _get_env(name: str, required: bool = False, default: str | None = None) -> str | None:
    v = os.getenv(name)
    if v is None:
        if required and default is None:
            _die(f"Missing required env var: {name}")
        return default
    return v

def _truthy_yes(v: str | None) -> bool:
    return (v or "").strip().upper() == "YES"

def _connect(db_url: str):
    # Try psycopg (v3) then psycopg2
    try:
        import psycopg  # type: ignore
        conn = psycopg.connect(db_url)
        return conn, "psycopg"
    except Exception:
        pass
    try:
        import psycopg2  # type: ignore
        conn = psycopg2.connect(db_url)
        return conn, "psycopg2"
    except Exception as e:
        _die(f"Could not connect using psycopg/psycopg2. Install one of them. Error: {e}")

def _table_exists(conn, table: str) -> bool:
    schema, _, name = table.partition(".")
    if not name:
        schema, name = "public", schema
    q = """
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = %s AND table_name = %s
    LIMIT 1
    """
    with conn.cursor() as cur:
        cur.execute(q, (schema, name))
        return cur.fetchone() is not None

def _count_rows(conn, table: str) -> int:
    with conn.cursor() as cur:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        return int(cur.fetchone()[0])

def _exec(conn, sql: str, params: Tuple = ()) -> None:
    with conn.cursor() as cur:
        cur.execute(sql, params)

def _purge_tables(conn, db_label: str, ordered_tables: List[str], do_delete: bool) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    existing = [t for t in ordered_tables if _table_exists(conn, t)]
    missing = [t for t in ordered_tables if t not in existing]

    print(f"\n[{db_label}] Tables present: {len(existing)} / {len(ordered_tables)}")
    if missing:
        print(f"[{db_label}] Tables missing (skipped): {', '.join(missing)}")

    for t in existing:
        try:
            c = _count_rows(conn, t)
        except Exception as e:
            print(f"[{db_label}] WARN: could not count {t}: {e}")
            c = -1
        counts[t] = c

    print(f"\n[{db_label}] Row counts (pre):")
    for t in existing:
        print(f"  - {t}: {counts[t]}")

    if not do_delete:
        print(f"\n[{db_label}] DRY RUN: no deletes executed.")
        return counts

    print(f"\n[{db_label}] Deleting rows in FK-safe order...")
    # Do it inside a transaction
    try:
        for t in existing:
            _exec(conn, f"DELETE FROM {t}")
        conn.commit()
        print(f"[{db_label}] ✓ Deletes committed.")
    except Exception as e:
        conn.rollback()
        _die(f"[{db_label}] Delete failed; rolled back. Error: {e}")

    print(f"\n[{db_label}] Row counts (post):")
    for t in existing:
        try:
            c2 = _count_rows(conn, t)
        except Exception:
            c2 = -1
        print(f"  - {t}: {c2}")

    return counts

def _purge_corpus_module_linked_data(conn, do_delete: bool) -> None:
    """Delete CORPUS corpus_documents (and chunks, reprocess_queue) that are linked to module-tagged source_registry."""
    if not _table_exists(conn, "public.source_registry"):
        return
    # Get module-tagged source_registry ids
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id FROM public.source_registry
            WHERE (scope_tags ? 'module_code') OR (scope_tags->>'source_type' ILIKE 'MODULE%%')
        """)
        sr_ids = [r[0] for r in cur.fetchall()]
    if not sr_ids:
        print("[CORPUS] No module-tagged source_registry rows; skipping linked corpus_documents.")
        return
    id_list = ",".join(["%s"] * len(sr_ids))
    # Get corpus_document ids for those sources
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT id FROM public.corpus_documents WHERE source_registry_id IN ({id_list})",
            tuple(sr_ids),
        )
        doc_ids = [r[0] for r in cur.fetchall()]
    if not doc_ids:
        print("[CORPUS] No corpus_documents linked to module sources.")
        return
    doc_id_list = ",".join(["%s"] * len(doc_ids))
    print(f"[CORPUS] Module-linked: {len(doc_ids)} corpus_documents, {len(sr_ids)} source_registry rows")
    if not do_delete:
        print("[CORPUS] DRY RUN: linked corpus_documents/chunks/reprocess not deleted.")
        return
    try:
        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM public.document_chunks WHERE document_id IN ({doc_id_list})", tuple(doc_ids))
            print(f"  document_chunks: {cur.rowcount}")
            if _table_exists(conn, "public.corpus_reprocess_queue"):
                cur.execute(
                    f"DELETE FROM public.corpus_reprocess_queue WHERE corpus_document_id IN ({doc_id_list})",
                    tuple(doc_ids),
                )
                print(f"  corpus_reprocess_queue: {cur.rowcount}")
            cur.execute(
                f"DELETE FROM public.corpus_documents WHERE source_registry_id IN ({id_list})",
                tuple(sr_ids),
            )
            print(f"  corpus_documents: {cur.rowcount}")
        conn.commit()
    except Exception as e:
        conn.rollback()
        _die(f"[CORPUS] Module-linked purge failed: {e}")

def _purge_corpus_module_standards(conn, do_delete: bool) -> None:
    """Delete CORPUS module_standard_* tables (FK order)."""
    tables = [
        "public.module_standard_citations",
        "public.module_standard_criterion_ofc_templates",
        "public.module_standard_criteria",
        "public.module_standard_references",
        "public.module_standard_attributes",
        "public.module_standards",
    ]
    existing = [t for t in tables if _table_exists(conn, t)]
    if not existing:
        return
    print(f"[CORPUS] module_standard_* tables: {len(existing)}")
    if not do_delete:
        return
    try:
        with conn.cursor() as cur:
            for t in existing:
                cur.execute(f"DELETE FROM {t}")
                print(f"  {t}: {cur.rowcount}")
        conn.commit()
    except Exception as e:
        conn.rollback()
        _die(f"[CORPUS] module_standard purge failed: {e}")

def _purge_source_registry_modules(conn, do_delete: bool) -> None:
    # Best-effort cleanup of module-tagged sources in CORPUS:
    # Deletes rows where scope_tags contains module_code OR source_type indicates module research.
    # This is intentionally conservative and only runs when explicitly enabled.
    q_count = """
    SELECT COUNT(*)
    FROM public.source_registry
    WHERE
      (scope_tags ? 'module_code')
      OR (scope_tags ? 'moduleCode')
      OR (scope_tags->>'source_type' ILIKE 'MODULE%')
      OR (scope_tags->>'source_type' ILIKE '%MODULE%')
    """
    q_delete = """
    DELETE FROM public.source_registry
    WHERE
      (scope_tags ? 'module_code')
      OR (scope_tags ? 'moduleCode')
      OR (scope_tags->>'source_type' ILIKE 'MODULE%')
      OR (scope_tags->>'source_type' ILIKE '%MODULE%')
    """
    if not _table_exists(conn, "public.source_registry"):
        print("[CORPUS] source_registry not present; skipping source_registry cleanup.")
        return

    with conn.cursor() as cur:
        cur.execute(q_count)
        n = int(cur.fetchone()[0])

    print(f"\n[CORPUS] source_registry module-tagged rows: {n}")

    if not do_delete:
        print("[CORPUS] DRY RUN: source_registry deletes not executed.")
        return

    try:
        with conn.cursor() as cur:
            cur.execute(q_delete)
        conn.commit()
        print("[CORPUS] ✓ source_registry module-tagged rows deleted.")
    except Exception as e:
        conn.rollback()
        _die(f"[CORPUS] source_registry delete failed; rolled back. Error: {e}")

def _purge_module_files(root: Path, do_delete: bool) -> None:
    print(f"\n[FS] MODULE_SOURCES_ROOT = {root}")
    if not root.exists():
        print("[FS] Root does not exist; nothing to delete.")
        return

    # Show what would be deleted
    items = list(root.iterdir())
    print(f"[FS] Items under root: {len(items)}")
    for p in items[:50]:
        print(f"  - {p}")
    if len(items) > 50:
        print("  ... (truncated)")

    if not do_delete:
        print("[FS] DRY RUN: filesystem deletes not executed.")
        return

    # Delete everything under root but keep the root folder
    try:
        for child in root.iterdir():
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()
        print("[FS] ✓ Deleted all contents under module_sources root (root preserved).")
    except Exception as e:
        _die(f"[FS] Filesystem purge failed. Error: {e}")

def _get_db_urls() -> tuple[str | None, str | None]:
    """Return (runtime_url, corpus_url). Tries env vars then check_db_env constructors."""
    runtime_url = _get_env("PSA_RUNTIME_DB_URL") or _get_env("RUNTIME_DATABASE_URL")
    corpus_url = _get_env("PSA_CORPUS_DB_URL") or _get_env("CORPUS_DATABASE_URL")
    if runtime_url and corpus_url:
        return runtime_url, corpus_url
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from check_db_env import construct_runtime_url, construct_corpus_url
        runtime_url = runtime_url or construct_runtime_url()
        corpus_url = corpus_url or construct_corpus_url()
    except Exception:
        pass
    return runtime_url, corpus_url

def main() -> None:
    _load_env()
    runtime_url, corpus_url = _get_db_urls()
    if not runtime_url:
        _die("Missing PSA_RUNTIME_DB_URL, RUNTIME_DATABASE_URL, or SUPABASE_RUNTIME_URL + SUPABASE_RUNTIME_DB_PASSWORD")
    if not corpus_url:
        _die("Missing PSA_CORPUS_DB_URL, CORPUS_DATABASE_URL, or SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD")

    do_delete = _truthy_yes(_get_env("ALLOW_MODULE_PURGE", default="NO"))
    do_fs = _truthy_yes(_get_env("ALLOW_MODULE_PURGE_FS", default="NO"))
    do_sr = _truthy_yes(_get_env("ALLOW_MODULE_PURGE_SOURCE_REGISTRY", default="NO"))

    _default_root = Path(__file__).resolve().parent.parent.parent / "storage" / "module_sources"
    module_sources_root = Path(_get_env("MODULE_SOURCES_ROOT", default=str(_default_root)))

    print("=== MODULE CLEAN SLATE PURGE ===")
    print(f"Deletes enabled: {do_delete} (set ALLOW_MODULE_PURGE=YES)")
    print(f"Filesystem purge enabled: {do_fs} (set ALLOW_MODULE_PURGE_FS=YES)")
    print(f"CORPUS source_registry purge enabled: {do_sr} (set ALLOW_MODULE_PURGE_SOURCE_REGISTRY=YES)")

    # RUNTIME — delete in FK-safe order (children -> parents). Keeps assessment_modules so you can re-ingest.
    runtime_tables = [
        "public.assessment_module_question_responses",
        "public.assessment_module_instances",
        "public.module_instance_criterion_responses",
        "public.module_instance_ofcs",
        "public.module_instance_criteria",
        "public.module_instance_citations",
        "public.module_instances",
        "public.module_ofc_citations",
        "public.module_ofc_sources",
        "public.module_ofcs",
        "public.module_questions",
        "public.module_risk_drivers",
        "public.module_import_batches",
        "public.module_vofc_library",
        "public.module_draft_questions",
        "public.module_draft_sources",
        "public.module_drafts",
        "public.module_chunk_comprehension",
        "public.module_chunks",
        "public.module_doc_source_link",
        "public.module_documents",
        "public.document_blobs",
        "public.module_sources",
        "public.module_corpus_links",
    ]

    # CORPUS — tables we can DELETE FROM entirely (no conditional filter)
    corpus_tables_simple = [
        "public.module_chunk_links",
        "public.module_source_documents",
    ]

    # Connect + purge RUNTIME
    runtime_conn, runtime_driver = _connect(runtime_url)
    print(f"\n[RUNTIME] Connected ({runtime_driver}).")
    _purge_tables(runtime_conn, "RUNTIME", runtime_tables, do_delete)
    runtime_conn.close()

    # Connect + purge CORPUS
    corpus_conn, corpus_driver = _connect(corpus_url)
    print(f"\n[CORPUS] Connected ({corpus_driver}).")
    _purge_tables(corpus_conn, "CORPUS", corpus_tables_simple, do_delete)
    _purge_corpus_module_linked_data(corpus_conn, do_delete)
    _purge_corpus_module_standards(corpus_conn, do_delete)

    # Optional: purge module-tagged source_registry rows (CORPUS)
    if do_delete and do_sr:
        _purge_source_registry_modules(corpus_conn, do_delete=True)
    else:
        _purge_source_registry_modules(corpus_conn, do_delete=False)

    corpus_conn.close()

    # Optional: filesystem purge
    if do_fs and do_delete:
        _purge_module_files(module_sources_root, do_delete=True)
    else:
        _purge_module_files(module_sources_root, do_delete=False)

    print("\n=== DONE ===")

if __name__ == "__main__":
    main()
