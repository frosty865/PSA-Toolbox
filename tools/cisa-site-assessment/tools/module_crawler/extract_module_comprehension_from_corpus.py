#!/usr/bin/env python3
"""
Extract Module Comprehension from Corpus

Performs a COMPREHENSION PASS on chunks before vulnerability extraction.
Creates structured, source-anchored meaning labels (domains, salience, site-observable, etc.)
Guarantees persistence to module_chunk_comprehension with hard logging and failure rows.
"""

import os
import json
import argparse
import psycopg2
from psycopg2.extras import RealDictCursor
from pathlib import Path
from typing import Optional

# Load .env.local if it exists
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
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    os.environ[key] = value

from llm.ollama_json import ollama_chat_json, load_schema, validate_json

SYSTEM_PROMPT_PATH = Path(__file__).parent / "llm" / "system_prompt_module_chunk_to_comprehension.txt"
SCHEMA_PATH = Path(__file__).parent / "llm" / "module_chunk_to_comprehension.schema.json"

CYBER_TECHNICAL_FORBIDDEN = [
    "segmentation", "firewall", "ids", "ips", "siem",
    "encryption", "tls", "certificate", "firmware", "patch",
    "ocpp", "protocol", "api", "oauth",
    "credential", "network architecture", "zero trust"
]


def contains_any(text: str, terms: list[str]) -> Optional[str]:
    """Check if text contains any forbidden cyber technical terms."""
    t = (text or "").lower()
    for term in terms:
        if term in t:
            return term
    return None


def safe_host(url: str) -> str:
    try:
        from urllib.parse import urlparse
        p = urlparse(url)
        return p.hostname or p.path or "?"
    except Exception:
        return "?"


def ensure_table_exists(runtime_cur) -> None:
    """E1: Refuse to run if module_chunk_comprehension is not found on this connection."""
    runtime_cur.execute("""
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'module_chunk_comprehension'
    """)
    if not runtime_cur.fetchone():
        raise RuntimeError(
            "module_chunk_comprehension table not found on RUNTIME connection. "
            "Run migration: db/migrations/runtime/20260127_add_module_chunk_comprehension.sql "
            "and 20260208_module_chunk_comprehension_upsert.sql"
        )


def ensure_upsert_support(runtime_cur) -> None:
    """Ensure unique constraint and comprehension_error column exist for idempotent upsert and failure rows."""
    runtime_cur.execute("""
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'module_chunk_comprehension' AND column_name = 'comprehension_error'
    """)
    if not runtime_cur.fetchone():
        raise RuntimeError(
            "module_chunk_comprehension.comprehension_error column missing. "
            "Run migration: db/migrations/runtime/20260208_module_chunk_comprehension_upsert.sql"
        )
    runtime_cur.execute("""
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'module_chunk_comprehension'
          AND indexdef LIKE '%%UNIQUE%%' AND indexdef LIKE '%%module_code%%' AND indexdef LIKE '%%chunk_id%%'
    """)
    if not runtime_cur.fetchone():
        raise RuntimeError(
            "module_chunk_comprehension unique (module_code, chunk_id) missing. "
            "Run migration: db/migrations/runtime/20260208_module_chunk_comprehension_upsert.sql"
        )


def write_module_chunk_comprehension(
    rcur,
    module_code: str,
    source_registry_id: str,
    doc_id: str,
    chunk_id: str,
    locator: str,
    *,
    comprehension_out: Optional[dict] = None,
    comprehension_error: Optional[str] = None,
    llm_model: str,
    llm_run_id: str,
) -> int:
    """
    Idempotent upsert one row. Uses ON CONFLICT (module_code, chunk_id) DO UPDATE.
    If comprehension_error is set, write a failure row (defaults for comprehension columns).
    Returns 1 on success.
    """
    if comprehension_error:
        primary_domains = secondary_domains = explicit_topics = implied_risks = "[]"
        site_observable = supports_question_generation = False
        generation_priority = "ERROR"
        life_safety_signal = ops_signal = cyber_awareness_signal = False
        llm_confidence = None
    else:
        out = comprehension_out
        primary_domains = json.dumps(out.get("primary_domains", []) or [])
        secondary_domains = json.dumps(out.get("secondary_domains", []) or [])
        explicit_topics = json.dumps(out.get("explicit_topics", []) or [])
        implied_risks = json.dumps(out.get("implied_risks", []) or [])
        site_observable = bool(out.get("site_observable", False))
        supports_question_generation = bool(out.get("supports_question_generation", False))
        generation_priority = str(out.get("generation_priority", "LOW"))
        life_safety_signal = bool(out.get("life_safety_signal", False))
        ops_signal = bool(out.get("ops_signal", False))
        cyber_awareness_signal = bool(out.get("cyber_awareness_signal", False))
        llm_confidence = float(out["confidence"]) if out.get("confidence") is not None else None
        comprehension_error = None

    rcur.execute("""
        INSERT INTO public.module_chunk_comprehension (
          module_code, source_registry_id, doc_id, chunk_id, locator,
          primary_domains, secondary_domains, explicit_topics, implied_risks,
          site_observable, supports_question_generation, generation_priority,
          life_safety_signal, ops_signal, cyber_awareness_signal,
          llm_model, llm_run_id, llm_confidence, comprehension_error
        ) VALUES (
          %s, %s::uuid, %s::uuid, %s::uuid, %s,
          %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb,
          %s, %s, %s,
          %s, %s, %s,
          %s, %s, %s, %s
        )
        ON CONFLICT (module_code, chunk_id)
        DO UPDATE SET
          source_registry_id = EXCLUDED.source_registry_id,
          doc_id = EXCLUDED.doc_id,
          locator = EXCLUDED.locator,
          primary_domains = EXCLUDED.primary_domains,
          secondary_domains = EXCLUDED.secondary_domains,
          explicit_topics = EXCLUDED.explicit_topics,
          implied_risks = EXCLUDED.implied_risks,
          site_observable = EXCLUDED.site_observable,
          supports_question_generation = EXCLUDED.supports_question_generation,
          generation_priority = EXCLUDED.generation_priority,
          life_safety_signal = EXCLUDED.life_safety_signal,
          ops_signal = EXCLUDED.ops_signal,
          cyber_awareness_signal = EXCLUDED.cyber_awareness_signal,
          llm_model = EXCLUDED.llm_model,
          llm_run_id = EXCLUDED.llm_run_id,
          llm_confidence = EXCLUDED.llm_confidence,
          comprehension_error = EXCLUDED.comprehension_error,
          updated_at = now()
    """, (
        module_code, source_registry_id, doc_id, chunk_id, locator,
        primary_domains, secondary_domains, explicit_topics, implied_risks,
        site_observable, supports_question_generation, generation_priority,
        life_safety_signal, ops_signal, cyber_awareness_signal,
        llm_model, llm_run_id, llm_confidence, comprehension_error
    ))
    return 1


def main():
    ap = argparse.ArgumentParser(
        description="Extract comprehension from corpus chunks for a module"
    )
    ap.add_argument("--module-code", required=True, help="Module code (e.g., MODULE_EV_PARKING)")
    ap.add_argument("--model", required=True, help="Ollama model name (e.g., llama3.1:8b-instruct)")
    ap.add_argument("--max-chunks", type=int, default=160, help="Maximum chunks to process")
    ap.add_argument("--min-chunk-len", type=int, default=400, help="Minimum chunk length in characters")
    ap.add_argument("--apply", action="store_true", help="Actually insert into database (dry-run by default)")
    args = ap.parse_args()

    # E2: Feature flag
    enabled = os.environ.get("ENABLE_COMPREHENSION", os.environ.get("MODULE_COMPREHENSION_ENABLED", "1"))
    if enabled.lower() in ("0", "false", "no", "off"):
        raise RuntimeError("Comprehension disabled by config (ENABLE_COMPREHENSION or MODULE_COMPREHENSION_ENABLED).")

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
        raise SystemExit(
            "Missing DB URLs. Set CORPUS_DATABASE_URL and RUNTIME_DATABASE_URL (or CORPUS_DB_URL / RUNTIME_DB_URL)."
        )

    # E1: Log DB host + schema; refuse if table missing
    print(f"[comprehension] RUNTIME host={safe_host(runtime_url)} CORPUS host={safe_host(corpus_url)}")
    schema = load_schema(str(SCHEMA_PATH))
    system = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")

    corpus = psycopg2.connect(corpus_url)
    runtime = psycopg2.connect(runtime_url)

    try:
        with runtime.cursor() as rcur:
            rcur.execute("SELECT current_database() AS db, current_schema() AS schema")
            row = rcur.fetchone()
            print(f"[comprehension] RUNTIME db={row[0]} schema={row[1]}")
            ensure_table_exists(rcur)
            if args.apply:
                ensure_upsert_support(rcur)

        with corpus.cursor(cursor_factory=RealDictCursor) as ccur:
            ccur.execute("""
              SELECT
                dc.chunk_id AS chunk_id,
                dc.document_id AS doc_id,
                dc.chunk_text AS content,
                sr.id AS source_registry_id,
                COALESCE(dc.locator, '') AS locator
              FROM public.document_chunks dc
              JOIN public.corpus_documents cd ON cd.id = dc.document_id
              JOIN public.source_registry sr ON sr.id = cd.source_registry_id
              WHERE (sr.scope_tags->>'module_code') = %s
                AND length(dc.chunk_text) >= %s
              ORDER BY dc.chunk_id
              LIMIT %s
            """, (args.module_code, args.min_chunk_len, args.max_chunks))
            chunks = ccur.fetchall()
    finally:
        corpus.close()

    # B1) After chunk retrieval
    n_chunks = len(chunks)
    n_docs = len({c["doc_id"] for c in chunks}) if chunks else 0
    print(f"[comprehension] module={args.module_code} chunks={n_chunks} docs={n_docs}")
    if n_chunks == 0:
        raise RuntimeError(
            "0 chunks: no inputs. Fix CORPUS tagging/ingestion: source_registry.scope_tags.module_code and document_chunks."
        )

    # B4) Before LLM loop (packets = chunks in this script)
    print(f"[comprehension] module={args.module_code} packets={n_chunks} model={args.model}")

    run_id = f"{args.module_code}:{args.model}:comprehension"
    inserted_or_updated = 0
    to_upsert = []  # (chunk, out_or_error_dict, is_error)

    for i, ch in enumerate(chunks):
        user = {
            "module_code": args.module_code,
            "chunk": {
                "chunk_id": str(ch["chunk_id"]),
                "doc_id": str(ch["doc_id"]),
                "source_registry_id": str(ch["source_registry_id"]),
                "locator": ch["locator"],
                "text": ch["content"]
            }
        }

        try:
            out = ollama_chat_json(args.model, system, json.dumps(user))
            validate_json(out, schema)

            # Cyber technical gate
            joined = "\n".join([
                "\n".join(out.get("primary_domains", []) or []),
                "\n".join(out.get("secondary_domains", []) or []),
                "\n".join(out.get("explicit_topics", []) or []),
                "\n".join(out.get("implied_risks", []) or []),
            ])
            bad = contains_any(joined, CYBER_TECHNICAL_FORBIDDEN)
            if bad:
                print(f"[comprehension] module={args.module_code} packet={ch['chunk_id']} ok=false reason=cyber_term term={bad}")
                to_upsert.append((ch, None, "cyber_blocked"))
                continue

            to_upsert.append((ch, out, None))
            print(f"[comprehension] module={args.module_code} packet={ch['chunk_id']} ok=true chars={len(json.dumps(out))}")
        except Exception as e:
            raw_snippet = ""
            if hasattr(e, "doc") and e.doc:
                raw_snippet = (e.doc or "")[:500]
            print(f"[comprehension] module={args.module_code} packet={ch['chunk_id']} ok=false error={e!r}")
            to_upsert.append((ch, {"error": "INVALID_JSON", "raw_snippet": raw_snippet}, "parse_error"))

    # B6) Before DB write
    n_to_upsert = len(to_upsert)
    print(f"[comprehension] module={args.module_code} upserting={n_to_upsert} rows -> module_chunk_comprehension")

    if args.apply and n_to_upsert > 0:
        with runtime.cursor() as rcur:
            for ch, out, err_kind in to_upsert:
                try:
                    if err_kind == "parse_error" and isinstance(out, dict):
                        write_module_chunk_comprehension(
                            rcur, args.module_code,
                            str(ch["source_registry_id"]), str(ch["doc_id"]), str(ch["chunk_id"]), ch["locator"],
                            comprehension_error=out.get("error", "INVALID_JSON") + " " + (out.get("raw_snippet", "")[:200] or ""),
                            llm_model=args.model, llm_run_id=run_id
                        )
                    elif err_kind == "cyber_blocked":
                        write_module_chunk_comprehension(
                            rcur, args.module_code,
                            str(ch["source_registry_id"]), str(ch["doc_id"]), str(ch["chunk_id"]), ch["locator"],
                            comprehension_error="cyber_blocked",
                            llm_model=args.model, llm_run_id=run_id
                        )
                    else:
                        write_module_chunk_comprehension(
                            rcur, args.module_code,
                            str(ch["source_registry_id"]), str(ch["doc_id"]), str(ch["chunk_id"]), ch["locator"],
                            comprehension_out=out,
                            llm_model=args.model, llm_run_id=run_id
                        )
                    inserted_or_updated += 1
                except Exception as db_err:
                    print(f"[comprehension] DB write failed chunk={ch['chunk_id']} error={db_err!r}")
                    raise

        runtime.commit()

    # B7) After DB write
    print(f"[comprehension] module={args.module_code} inserted_or_updated={inserted_or_updated}")

    if args.apply and n_chunks > 0 and inserted_or_updated == 0:
        raise RuntimeError(
            f"0 rows written but chunks={n_chunks}. Persistence path failed (check RUNTIME connection and table module_chunk_comprehension)."
        )

    print(f"[OK] chunks={n_chunks} comprehension_rows_inserted={inserted_or_updated} apply={args.apply}")
    runtime.close()


if __name__ == "__main__":
    main()
