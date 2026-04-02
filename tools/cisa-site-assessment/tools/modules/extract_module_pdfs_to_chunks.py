#!/usr/bin/env python3
"""
Extract module PDF chunks from RUNTIME for use by generate_module_questions_ofcs.py.

Module data stays in RUNTIME only (never CORPUS). Reads module_chunks + module_documents
(+ module_sources when matched by module_code + sha256), writes
data/module_chunks/<module_code>.json with citation-ready chunk records.
Run this before generate_module_questions_ofcs.py so the generator has an evidence package.
"""

import os
import json
import argparse
import sys
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None  # type: ignore[assignment]

# Load .env.local if it exists
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parents[2] / ".env.local"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    env_path = Path(__file__).resolve().parents[2] / ".env.local"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    os.environ[key.strip()] = value.strip().strip('"').strip("'")

def get_runtime_url() -> str:
    url = (
        os.environ.get("RUNTIME_DATABASE_URL")
        or os.environ.get("RUNTIME_DB_URL")
        or os.environ.get("DATABASE_URL_RUNTIME")
        or os.environ.get("DATABASE_URL")
        or ""
    )
    if not url:
        raise SystemExit(
            "Missing RUNTIME DB URL. Set RUNTIME_DATABASE_URL or RUNTIME_DB_URL."
        )
    return url


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Extract module chunks from RUNTIME (module_chunks) to data/module_chunks/<module_code>.json"
    )
    ap.add_argument("module_code", help="Module code (e.g., MODULE_EV_PARKING)")
    ap.add_argument("--max-chunks", type=int, default=500, help="Max chunks to export (default 500)")
    ap.add_argument("--min-length", type=int, default=200, help="Min chunk length in chars (default 200)")
    ap.add_argument("--out", help="Output path (default: data/module_chunks/<module_code>.json)")
    ap.add_argument("--diagnose", action="store_true", help="Print RUNTIME counts and exit (no export)")
    args = ap.parse_args()

    if psycopg2 is None:
        print("pip install psycopg2-binary", file=sys.stderr)
        raise SystemExit(1)

    module_code = args.module_code.strip()
    if not module_code:
        raise SystemExit("module_code is required")

    runtime_url = get_runtime_url()
    conn = psycopg2.connect(runtime_url)

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if args.diagnose:
                cur.execute(
                    "SELECT COUNT(*) AS n FROM public.module_documents WHERE module_code = %s AND status = 'INGESTED'",
                    (module_code,),
                )
                r1 = cur.fetchone()
                n_docs = r1["n"] if isinstance(r1, dict) else r1[0]
                cur.execute(
                    """SELECT COUNT(*) AS n FROM public.module_chunks mc
                       JOIN public.module_documents md ON md.id = mc.module_document_id
                       WHERE md.module_code = %s AND md.status = 'INGESTED'""",
                    (module_code,),
                )
                r2 = cur.fetchone()
                n_chunks = r2["n"] if isinstance(r2, dict) else r2[0]
                print("Diagnostics for module_code =", repr(module_code))
                print("  module_documents (INGESTED):", n_docs)
                print("  module_chunks (from those docs):", n_chunks)
                if n_docs == 0:
                    print("  Ingest PDFs into RUNTIME first (e.g. tools/corpus/process_module_pdfs_from_incoming.py or ingest_module_pdf_to_runtime.py).")
                return

            # RUNTIME: module_chunks JOIN module_documents, optional module_sources (for source label/url)
            # Use module_sources.id as source_registry_id when doc matches a source (module_code + sha256); else module_documents.id
            cur.execute("""
                SELECT
                    mc.id AS chunk_id,
                    mc.module_document_id AS doc_id,
                    mc.chunk_index,
                    mc.text,
                    mc.locator,
                    md.label AS doc_label,
                    md.url AS doc_url,
                    md.sha256,
                    ms.id AS source_id
                FROM public.module_chunks mc
                JOIN public.module_documents md ON md.id = mc.module_document_id
                LEFT JOIN public.module_sources ms ON ms.module_code = md.module_code AND ms.sha256 = md.sha256 AND ms.source_type = 'MODULE_UPLOAD'
                WHERE md.module_code = %s AND md.status = 'INGESTED'
                  AND length(mc.text) >= %s
                ORDER BY md.id, mc.chunk_index
                LIMIT %s
            """, (module_code, args.min_length, args.max_chunks))
            rows = cur.fetchall()

        if not rows:
            print("[0] No chunks found for module_code. Ingest PDFs into RUNTIME (module_documents + module_chunks) first.", file=sys.stderr)
            raise SystemExit(1)

        chunks_out = []
        for r in rows:
            text = (r.get("text") or "").strip()
            if len(text) < args.min_length:
                continue
            # source_registry_id in payload = source id for citation (module_sources.id or module_documents.id)
            source_id = r.get("source_id")
            doc_id = r.get("doc_id")
            if source_id is not None:
                source_registry_id = str(source_id)
            else:
                source_registry_id = str(doc_id)
            loc = r.get("locator")
            if isinstance(loc, dict):
                loc_type = (loc.get("type") or "page").lower().replace("pdf_page", "page")
                loc_val = str(loc.get("page") or loc.get("page_start") or loc.get("chunk_index", r.get("chunk_index")) or "1")
            else:
                loc_type = "page"
                loc_val = str(r.get("chunk_index") or "1")
            if loc_type == "pdf":
                loc_type = "page"
            chunks_out.append({
                "source_registry_id": source_registry_id,
                "doc_id": str(doc_id),
                "chunk_id": str(r.get("chunk_id")),
                "locator_type": loc_type,
                "locator_value": loc_val,
                "text": text,
            })

        if not chunks_out:
            print("[0] No chunks met min_length.", file=sys.stderr)
            raise SystemExit(1)

        # Source index: for each source_registry_id get a title (from module_sources or module_documents)
        source_ids = list({c["source_registry_id"] for c in chunks_out})
        titles = {}
        with conn.cursor(cursor_factory=RealDictCursor) as cur2:
            cur2.execute(
                "SELECT id, COALESCE(source_label, '') AS title FROM public.module_sources WHERE id = ANY(%s::uuid[])",
                (source_ids,),
            )
            for row in cur2.fetchall():
                titles[str(row["id"])] = (row.get("title") or "")[:500]
            # Fill from module_documents for ids that are document ids (not in module_sources)
            doc_ids = [i for i in source_ids if i not in titles]
            if doc_ids:
                cur2.execute(
                    "SELECT id, COALESCE(label, '') AS title FROM public.module_documents WHERE id = ANY(%s::uuid[])",
                    (doc_ids,),
                )
                for row in cur2.fetchall():
                    titles[str(row["id"])] = (row.get("title") or "")[:500]

        out_path = args.out
        if not out_path:
            base = Path(__file__).resolve().parents[2] / "data" / "module_chunks"
            base.mkdir(parents=True, exist_ok=True)
            out_path = base / f"{module_code}.json"

        payload = {
            "module_code": module_code,
            "source_index": {sid: titles.get(sid, "") for sid in source_ids},
            "chunks": chunks_out,
        }
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)

        print(f"[OK] Wrote {len(chunks_out)} chunks to {out_path}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
