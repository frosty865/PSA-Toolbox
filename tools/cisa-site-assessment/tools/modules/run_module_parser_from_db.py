#!/usr/bin/env python3
"""
Run the module parser (Ollama Phase-1) on chunks from a module in the database.

Consolidated flow: loads ALL chunks from data/module_chunks/<module_code>.json,
sends them in ONE prompt so the model understands all sources, then chooses the
best chunk per item. Writes result to tools/outputs/module_parser_test_<module_code>.json.

Context: one call with many chunks. Default max_chunks=80 to stay within context;
each chunk is truncated to 2000 chars. Increase --max-chunks if your model has large context.

Usage:
  python tools/modules/run_module_parser_from_db.py [--module-code MODULE_EV_PARKING] [--model llama3.2:1b]
  python tools/modules/run_module_parser_from_db.py --module-code MODULE_EV_PARKING --diagnose
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    requests = None  # type: ignore[assignment]

# Project root = psa_rebuild (parent of tools)
_script_dir = Path(__file__).resolve().parent
_project_root = _script_dir.parents[1]
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

# Load .env.local
for env_file in (_project_root / ".env.local", _project_root / ".local.env"):
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    os.environ[k.strip()] = v.strip().strip('"').strip("'")
        break


def _ollama_base_url() -> str:
    host = (os.getenv("OLLAMA_HOST") or "").strip()
    if not host:
        return "http://127.0.0.1:11434"
    if host.startswith("http://") or host.startswith("https://"):
        return host.rstrip("/")
    return ("http://" + host).rstrip("/")


def _ensure_no_proxy_for_localhost() -> None:
    cur = (os.getenv("NO_PROXY") or os.getenv("no_proxy") or "").strip()
    parts = [p.strip() for p in cur.split(",") if p.strip()]
    for needed in ("127.0.0.1", "localhost"):
        if needed not in parts:
            parts.append(needed)
    val = ",".join(parts)
    os.environ["NO_PROXY"] = val
    os.environ["no_proxy"] = val


_ensure_no_proxy_for_localhost()

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None

from services.processor.pipeline import (
    generate_module_items_from_chunks,
    generate_module_from_chunks,
)

SCO_PROMPT_PLAN_GUARD_MSG = "STANDARD_PROMPT_CONTAINS_PLAN_FOR_OBJECT_MODULE"


def _post_ollama_json(session: "requests.Session", base: str, path: str, payload: dict):
    """POST to Ollama with connect 5s, read 600s, retry once on connection errors. Raises on final failure."""
    url = f"{base.rstrip('/')}{path}"
    timeout = (5, 600)
    last = None
    for attempt in range(2):
        try:
            r = session.post(url, json=payload, timeout=timeout)
            r.raise_for_status()
            return r.json()
        except requests.exceptions.RequestException as e:
            last = e
            if attempt == 0:
                time.sleep(0.5)
                continue
            msg = str(e)
            if len(msg) > 900:
                msg = msg[:900]
            print("[module_parser] ERROR: Ollama request failed", file=sys.stderr)
            print(f"[module_parser] base_url={base}", file=sys.stderr)
            print(f"[module_parser] url={url}", file=sys.stderr)
            print(f"[module_parser] error={type(e).__name__}: {msg}", file=sys.stderr)
            print("[module_parser] Likely causes: wrong OLLAMA_HOST/port, proxy intercepting localhost, firewall, or Ollama bound to a different interface.", file=sys.stderr)
            print("[module_parser] Quick check (PowerShell): Invoke-WebRequest http://127.0.0.1:11434/api/tags", file=sys.stderr)
            raise


def _print_ollama_error(exc: BaseException) -> None:
    base_url = _ollama_base_url()
    endpoint = "/api/chat"
    msg = (getattr(exc, "message", None) or str(exc))[:500]
    print("", file=sys.stderr)
    print("[module_parser] --- Ollama connection error ---", file=sys.stderr)
    print(f"[module_parser] base_url={base_url}", file=sys.stderr)
    print(f"[module_parser] endpoint={endpoint}", file=sys.stderr)
    print(f"[module_parser] error={type(exc).__name__}: {msg}", file=sys.stderr)
    print("[module_parser] Likely causes: wrong OLLAMA_HOST/port, proxy intercepting localhost, firewall, or Ollama bound to a different interface.", file=sys.stderr)
    print("[module_parser] Quick check (PowerShell): Invoke-WebRequest http://127.0.0.1:11434/api/tags", file=sys.stderr)
    print("---", file=sys.stderr)


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


def pick_module_with_chunks(conn, module_code: str | None):
    """Return (module_code, module_name) for a module that has sources and chunks."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        if module_code:
            cur.execute(
                """
                SELECT am.module_code, am.module_name
                FROM public.assessment_modules am
                WHERE am.module_code = %s
                  AND EXISTS (SELECT 1 FROM public.module_sources ms WHERE ms.module_code = am.module_code)
                  AND EXISTS (
                    SELECT 1 FROM public.module_chunks mc
                    JOIN public.module_documents md ON md.id = mc.module_document_id
                    WHERE md.module_code = am.module_code AND md.status = 'INGESTED'
                  )
                """,
                (module_code,),
            )
        else:
            cur.execute(
                """
                SELECT am.module_code, am.module_name
                FROM public.assessment_modules am
                WHERE EXISTS (SELECT 1 FROM public.module_sources ms WHERE ms.module_code = am.module_code)
                  AND EXISTS (
                    SELECT 1 FROM public.module_chunks mc
                    JOIN public.module_documents md ON md.id = mc.module_document_id
                    WHERE md.module_code = am.module_code AND md.status = 'INGESTED'
                  )
                ORDER BY am.module_code
                LIMIT 1
                """
            )
        row = cur.fetchone()
    if not row:
        return None, None
    return row.get("module_code"), row.get("module_name")


def _map_raw_chunks_to_processor_format(chunks_raw: list, source_index: dict) -> tuple[list, dict]:
    """Map raw chunk dicts (from JSON or stdin) to processor format. Chunks missing text, locator, or source label are excluded.
    Returns (usable_chunks, stats) with stats: total_retrieved, missing_text_count, missing_locator_count, missing_source_label_count,
    missing_text_chunk_ids, missing_locator_chunk_ids, missing_source_label_chunk_ids (max 5 each)."""
    out = []
    total = len(chunks_raw)
    missing_text_ids = []
    missing_locator_ids = []
    missing_source_label_ids = []
    max_examples = 5
    missing_text_count = 0
    missing_locator_count = 0
    missing_source_label_count = 0

    for c in chunks_raw:
        chunk_id = str(c.get("chunk_id", ""))
        sid = c.get("source_registry_id") or c.get("doc_id")
        source_file = (c.get("source_label") or (source_index.get(str(sid)) if sid else None) or "").strip()
        if not source_file:
            source_file = "unknown"
        if isinstance(source_file, str) and len(source_file) > 120:
            source_file = source_file[:117] + "..."
        page = (c.get("page_range") or c.get("locator_value") or "").strip()
        text = (c.get("text") or c.get("chunk_text") or "").strip()

        missing_text = not text
        missing_locator = not page or page == "?"
        missing_source_label = not source_file or source_file == "unknown"

        if missing_text:
            missing_text_count += 1
            if len(missing_text_ids) < max_examples:
                missing_text_ids.append(chunk_id)
        if missing_locator:
            missing_locator_count += 1
            if len(missing_locator_ids) < max_examples:
                missing_locator_ids.append(chunk_id)
        if missing_source_label:
            missing_source_label_count += 1
            if len(missing_source_label_ids) < max_examples:
                missing_source_label_ids.append(chunk_id)

        if missing_text or missing_locator or missing_source_label:
            continue

        doc_id = str(c.get("doc_id") or c.get("source_registry_id") or "")
        out.append({
            "chunk_id": chunk_id,
            "chunk_text": text,
            "page_range": page,
            "source_file": source_file,
            "doc_id": doc_id,
        })

    stats = {
        "total_retrieved": total,
        "missing_text_count": missing_text_count,
        "missing_locator_count": missing_locator_count,
        "missing_source_label_count": missing_source_label_count,
        "missing_text_chunk_ids": missing_text_ids,
        "missing_locator_chunk_ids": missing_locator_ids,
        "missing_source_label_chunk_ids": missing_source_label_ids,
    }
    return out, stats


def load_chunks_from_json(module_code: str, max_chunks: int):
    """Load chunks from data/module_chunks/<module_code>.json and map to processor format. Returns (chunks, stats) or (None, None) if file missing."""
    path = _project_root / "data" / "module_chunks" / f"{module_code}.json"
    if not path.exists():
        return None, None
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    source_index = data.get("source_index") or {}
    chunks_raw = data.get("chunks") or []
    return _map_raw_chunks_to_processor_format(chunks_raw[:max_chunks], source_index)


def load_chunks_from_stdin(module_code: str):
    """Read JSON from stdin: { chunks, source_index }. Return (chunks in processor format, stats)."""
    try:
        payload = json.load(sys.stdin)
    except Exception as e:
        print(f"Stdin JSON error: {e}", file=sys.stderr)
        raise SystemExit(1)
    chunks_raw = payload.get("chunks") or []
    source_index = payload.get("source_index") or {}
    return _map_raw_chunks_to_processor_format(chunks_raw, source_index)


def main():
    ap = argparse.ArgumentParser(description="Run module parser on DB module chunks")
    ap.add_argument("--module-code", default=None, help="Module code (default: first with sources and chunks)")
    ap.add_argument("--max-chunks", type=int, default=None, help="Max chunks in one consolidated call (default 80; lower if context overflows)")
    ap.add_argument("--model", default="llama3.2:1b", help="Ollama model (default llama3.2:1b)")
    ap.add_argument("--module-kind", default="OBJECT", choices=["OBJECT", "PLAN"], help="OBJECT or PLAN (default OBJECT)")
    ap.add_argument("--timeout", type=int, default=1200, help="Ollama read timeout per chunk in seconds (default 1200 = 20 min for large runs)")
    ap.add_argument("--out-dir", default=None, help="Output directory (default tools/outputs)")
    ap.add_argument("--diagnose", action="store_true", help="Print chunk counts and recommended batch size, then exit")
    ap.add_argument("--stdin", action="store_true", help="Read chunks JSON from stdin (chunks + source_index); requires --module-code")
    ap.add_argument(
        "--use-packet-pipeline",
        action="store_true",
        help="Use deterministic router+packetizer+combined-packet prompts (OBJECT/PLAN gates, multi-citation).",
    )
    ap.add_argument("--model-plan", default=None, help="Ollama model for PLAN packets (default: same as --model)")
    ap.add_argument(
        "--use-analyst-prompt",
        action="store_true",
        help="OBJECT only: use Physical Security Vulnerability Analyst prompt (vulnerability -> question -> OFCs).",
    )
    ap.add_argument(
        "--standard-key",
        default=None,
        help="Standard key (e.g. PHYSICAL_SECURITY_MEASURES) for LLM router + quota when using packet pipeline.",
    )
    ap.add_argument(
        "--diagnose-router",
        action="store_true",
        help="Run router + quota only; print router stats JSON to stdout and exit (requires --stdin, --module-code, --standard-key).",
    )
    args = ap.parse_args()

    print(f"[module_parser] python={sys.executable}")
    print(f"[module_parser] OLLAMA_HOST={os.getenv('OLLAMA_HOST')}")
    print(f"[module_parser] NO_PROXY={os.getenv('NO_PROXY') or os.getenv('no_proxy')}")

    module_code = None
    module_name = None
    module_description = None

    if psycopg2 is None:
        print("pip install psycopg2-binary", file=sys.stderr)
        raise SystemExit(1)

    if args.stdin:
        if not args.module_code:
            print("--stdin requires --module-code", file=sys.stderr)
            raise SystemExit(1)
        module_code = args.module_code
        chunks, packet_stats = load_chunks_from_stdin(module_code)
        if getattr(args, "diagnose_router", False):
            # Router diagnostic: build windows, run router + quota, print JSON to stdout, exit
            standard_key = getattr(args, "standard_key", None) or "PHYSICAL_SECURITY_MEASURES"
            from services.processor.pipeline.module_generate_from_db_chunks import (
                _assign_handles_and_filter,
                _lexical_decisions_for_windows,
                select_by_quota,
                router_stats_from_decisions,
            )
            from services.processor.pipeline.module_chunk_router import build_windows_from_chunks
            from services.processor.model.module_router_llm import route_windows_with_llm
            chunks_with_handles = _assign_handles_and_filter(chunks)
            N = len(chunks_with_handles)
            if N == 0:
                diag = {"chunks_usable": 0, "windows_count": 0, "router": {"total": 0, "keep": 0, "maybe": 0, "ignore": 0, "examples": {"ignore": [], "maybe": [], "keep": []}}, "selected_handles": []}
                print(json.dumps(diag, indent=2))
            else:
                windows = build_windows_from_chunks(chunks_with_handles)
                handles_in_order = [w["primary_handle"] for w in windows]
                use_llm = (standard_key or "").strip().upper() == "PHYSICAL_SECURITY_MEASURES"
                if use_llm:
                    router_out = route_windows_with_llm(windows, standard_key, timeout=300)
                    decisions = router_out.get("decisions") or []
                else:
                    in_scope = getattr(args, "in_scope_terms", None) or []
                    out_scope = getattr(args, "out_scope_terms", None) or []
                    decisions = _lexical_decisions_for_windows(windows, in_scope, out_scope)
                quota = select_by_quota(decisions, handles_in_order)
                selected_handles = quota.get("selected_handles") or []
                router_stats = router_stats_from_decisions(decisions)
                router_stats["selected_count"] = len(selected_handles)
                router_stats["forced_count"] = quota.get("forced_count") or 0
                router_stats["used_maybe_fallback"] = quota.get("used_maybe_fallback") or False
                diag = {"chunks_usable": N, "windows_count": len(windows), "router": router_stats, "selected_handles": selected_handles}
                print(json.dumps(diag, indent=2))
            return 0
        if not chunks:
            out_dir = Path(args.out_dir or _project_root / "tools" / "outputs")
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / f"module_parser_test_{module_code}.json"
            result = {
                "items": [],
                "items_empty_reason": "PACKET_PIPELINE_NO_USABLE_CHUNKS",
                "total_retrieved": packet_stats.get("total_retrieved", 0),
                "missing_text_count": packet_stats.get("missing_text_count", 0),
                "missing_locator_count": packet_stats.get("missing_locator_count", 0),
                "missing_source_label_count": packet_stats.get("missing_source_label_count", 0),
                "missing_text_chunk_ids": packet_stats.get("missing_text_chunk_ids", [])[:5],
                "missing_locator_chunk_ids": packet_stats.get("missing_locator_chunk_ids", [])[:5],
                "missing_source_label_chunk_ids": packet_stats.get("missing_source_label_chunk_ids", [])[:5],
            }
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            print(f"PACKET_PIPELINE_NO_USABLE_CHUNKS: {result}", file=sys.stderr)
            print(f"Wrote {out_path}")
            return 0
        print(f"Module: {module_code} (from stdin, {len(chunks)} chunks)")
    else:
        runtime_url = get_runtime_url()
        conn = psycopg2.connect(runtime_url)
        try:
            fetched_code, fetched_name = pick_module_with_chunks(conn, args.module_code)
            if fetched_code is not None:
                module_code = fetched_code
                if fetched_name is not None:
                    module_name = fetched_name
            if not module_code:
                print("No module found with assigned sources and ingested chunks.", file=sys.stderr)
                raise SystemExit(1)
            if args.diagnose:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        "SELECT COUNT(*) AS n FROM public.module_documents WHERE module_code = %s AND status = 'INGESTED'",
                        (module_code,),
                    )
                    n_docs = (cur.fetchone() or {}).get("n", 0) or 0
                    cur.execute(
                        """SELECT COUNT(*) AS n FROM public.module_chunks mc
                           JOIN public.module_documents md ON md.id = mc.module_document_id
                           WHERE md.module_code = %s AND md.status = 'INGESTED'""",
                        (module_code,),
                    )
                    n_chunks = (cur.fetchone() or {}).get("n", 0) or 0
                json_path = _project_root / "data" / "module_chunks" / f"{module_code}.json"
                n_in_json = 0
                if json_path.exists():
                    with open(json_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    n_in_json = len(data.get("chunks") or [])
                recommended = 80  # consolidated: one call with all chunks; stay within context
                runs_to_complete = (n_chunks + recommended - 1) // recommended if n_chunks else 0
                print(f"Module: {module_code} — {module_name}")
                print(f"  module_documents (INGESTED): {n_docs}")
                print(f"  module_chunks (DB):          {n_chunks}")
                print(f"  chunks in JSON export:      {n_in_json}")
                print(f"  recommended max_chunks:     {recommended} (consolidated call; one run)")
                print(f"  runs to complete all:      {runs_to_complete} (at {recommended} chunks/run)")
                print(f"  estimated time:            ~{runs_to_complete * 5}–{runs_to_complete * 15} min per run")
                return 0
            print(f"Module: {module_code} — {module_name}")
        finally:
            conn.close()

        max_chunks = args.max_chunks if args.max_chunks is not None else 80
        chunks, packet_stats = load_chunks_from_json(module_code, max_chunks)
        if chunks is None:
            print(
                f"No chunks in data/module_chunks/{module_code}.json. Run extract first: python tools/modules/extract_module_pdfs_to_chunks.py {module_code}",
                file=sys.stderr,
            )
            raise SystemExit(1)
        if not chunks:
            out_dir = Path(args.out_dir or _project_root / "tools" / "outputs")
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / f"module_parser_test_{module_code}.json"
            result = {
                "items": [],
                "items_empty_reason": "PACKET_PIPELINE_NO_USABLE_CHUNKS",
                "total_retrieved": packet_stats.get("total_retrieved", 0),
                "missing_text_count": packet_stats.get("missing_text_count", 0),
                "missing_locator_count": packet_stats.get("missing_locator_count", 0),
                "missing_source_label_count": packet_stats.get("missing_source_label_count", 0),
                "missing_text_chunk_ids": packet_stats.get("missing_text_chunk_ids", [])[:5],
                "missing_locator_chunk_ids": packet_stats.get("missing_locator_chunk_ids", [])[:5],
                "missing_source_label_chunk_ids": packet_stats.get("missing_source_label_chunk_ids", [])[:5],
            }
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            print(f"PACKET_PIPELINE_NO_USABLE_CHUNKS: {result}", file=sys.stderr)
            print(f"Wrote {out_path}")
            return 0

    # Optional scope terms for automated scope enforcement (OBJECT modules)
    in_scope = getattr(args, "in_scope_terms", None)
    out_scope = getattr(args, "out_scope_terms", None)
    if in_scope is None and module_code == "MODULE_EV_PARKING":
        in_scope = ["EV parking", "EV charging", "electric vehicle", "charging", "charging station", "EV", "parking", "fire", "egress", "separation", "wayfinding", "suppression", "inspection", "maintenance"]
        out_scope = ["cyber", "software", "network", "ransomware", "malware", "API", "IoT"]
    if in_scope is None:
        in_scope = []
    if out_scope is None:
        out_scope = []

    base = _ollama_base_url()
    _ensure_no_proxy_for_localhost()
    os.environ["OLLAMA_HOST"] = base
    print(f"[module_parser] ollama_base_url={base}")

    try:
        if getattr(args, "use_packet_pipeline", False):
            model_object = args.model
            model_plan = getattr(args, "model_plan", None) or args.model
            module_kind = getattr(args, "module_kind", "OBJECT") or "OBJECT"
            print(f"Using packet pipeline: kind={module_kind}, OBJECT={model_object}, PLAN={model_plan}")
            print(f"Sending {len(chunks)} chunks (router+packetizer then combined-packet prompts)...")
            result = generate_module_from_chunks(
                model_object=model_object,
                model_plan=model_plan,
                module_code=module_code,
                module_title=module_name or module_code,
                module_kind=module_kind,
                in_scope_terms=in_scope,
                out_of_scope_terms=out_scope,
                chunks=chunks,
                timeout=args.timeout,
                use_analyst_prompt=getattr(args, "use_analyst_prompt", False),
                standard_key=getattr(args, "standard_key", None),
            )
            # Pipeline now always sets a stage-specific items_empty_reason when items are empty
        else:
            print(f"Sending {len(chunks)} chunks to Ollama ({args.model})...")
            result = generate_module_items_from_chunks(
                model=args.model,
                module_code=module_code,
                module_title=module_name or module_code,
                module_kind=args.module_kind,
                chunks=chunks,
                in_scope_terms=in_scope,
                out_of_scope_terms=out_scope,
                timeout=args.timeout,
            )
    except Exception as e:
        if SCO_PROMPT_PLAN_GUARD_MSG in str(e):
            print(SCO_PROMPT_PLAN_GUARD_MSG, file=sys.stderr)
            raise SystemExit(2)
        if requests and isinstance(e, requests.exceptions.RequestException):
            _print_ollama_error(e)
            raise SystemExit(1)
        raise

    out_dir = Path(args.out_dir or _project_root / "tools" / "outputs")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"module_parser_test_{module_code}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Wrote {out_path}")
    print(f"Items: {len(result.get('items', []))}")
    for i, it in enumerate(result.get("items", [])[:5]):
        print(f"  {i+1}. {it.get('question', '')[:60]}...")
    if len(result.get("items", [])) > 5:
        print(f"  ... and {len(result['items']) - 5} more")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
