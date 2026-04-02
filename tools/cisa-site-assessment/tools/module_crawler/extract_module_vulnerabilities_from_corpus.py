#!/usr/bin/env python3
"""
Extract Module Vulnerabilities from Corpus

Consumes comprehension signals to extract vulnerabilities from chunks.
Only processes chunks marked supports_question_generation=true.
Uses life_safety_signal/ops_signal to force inclusion when present.
"""

import os
import json
import argparse
import psycopg2
from psycopg2.extras import RealDictCursor
from pathlib import Path

# Load .env.local if it exists
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent.parent / '.env.local'
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    # dotenv not installed, try to manually parse .env.local
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

# Import from llm subdirectory
from llm.ollama_json import ollama_chat_json, load_schema, validate_json

# Schema and prompt paths
SCHEMA_PATH = Path(__file__).parent / "llm" / "module_chunk_to_vulnerability.schema.json"
SYSTEM_PROMPT_PATH = Path(__file__).parent / "llm" / "system_prompt_module_chunk_to_vulnerability.txt"

CYBER_TECHNICAL_FORBIDDEN = [
    "segmentation", "firewall", "ids", "ips", "siem",
    "encryption", "tls", "certificate", "firmware", "patch",
    "ocpp", "protocol", "api", "oauth",
    "credential", "network architecture", "zero trust"
]


def contains_any(text: str, terms: list[str]) -> str | None:
    """Check if text contains any forbidden cyber technical terms."""
    t = (text or "").lower()
    for term in terms:
        if term in t:
            return term
    return None


def main():
    ap = argparse.ArgumentParser(
        description="Extract vulnerabilities from corpus chunks using comprehension signals"
    )
    ap.add_argument("--module-code", required=True, help="Module code (e.g., MODULE_EV_PARKING)")
    ap.add_argument("--model", required=True, help="Ollama model name (e.g., llama3.1:8b-instruct)")
    ap.add_argument("--max-chunks", type=int, default=140, help="Maximum chunks to process")
    ap.add_argument("--min-chunk-len", type=int, default=400, help="Minimum chunk length in characters")
    ap.add_argument("--apply", action="store_true", help="Actually insert into database (dry-run by default)")
    args = ap.parse_args()

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

    schema = load_schema(str(SCHEMA_PATH))
    system = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")

    corpus = psycopg2.connect(corpus_url)
    runtime = psycopg2.connect(runtime_url)

    # Ensure target table exists (if migration not yet run)
    with runtime, runtime.cursor() as cur:
        cur.execute("""
          CREATE TABLE IF NOT EXISTS public.module_vulnerability_candidates (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            module_code text NOT NULL,
            discipline_subtype_id uuid NULL,
            vulnerability_title text NOT NULL,
            vulnerability_text text NOT NULL,
            impact_text text NOT NULL,
            ofc_options jsonb NOT NULL DEFAULT '[]'::jsonb,
            evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
            llm_model text NOT NULL,
            llm_run_id text NOT NULL,
            llm_confidence numeric NULL,
            created_at timestamptz NOT NULL DEFAULT now()
          );
          CREATE INDEX IF NOT EXISTS idx_module_vuln_module_code ON public.module_vulnerability_candidates(module_code);
        """)

    # Pull comprehension rows to select chunks (this is where "comprehension" is used)
    with runtime, runtime.cursor(cursor_factory=RealDictCursor) as rcur:
        rcur.execute("""
          SELECT source_registry_id, doc_id, chunk_id, locator,
                 life_safety_signal, ops_signal, cyber_awareness_signal,
                 generation_priority
          FROM public.module_chunk_comprehension
          WHERE module_code = %s
            AND supports_question_generation = true
          ORDER BY
            CASE generation_priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
            created_at ASC
          LIMIT %s
        """, (args.module_code, args.max_chunks))
        comp_rows = rcur.fetchall()

    if not comp_rows:
        print("[0] No comprehension rows found. Run extract_module_comprehension_from_corpus.py --apply first.")
        return

    run_id = f"{args.module_code}:{args.model}:vulns"
    inserts = 0

    with corpus, corpus.cursor(cursor_factory=RealDictCursor) as ccur, runtime, runtime.cursor() as wcur:
        for cr in comp_rows:
            # fetch chunk content from CORPUS
            ccur.execute("""
              SELECT content
              FROM public.document_chunks
              WHERE id = %s
            """, (str(cr["chunk_id"]),))
            row = ccur.fetchone()
            if not row or not row.get("content"):
                continue
            text = row["content"]
            if len(text) < args.min_chunk_len:
                continue

            user = {
                "module_code": args.module_code,
                "comprehension": {
                    "life_safety_signal": bool(cr["life_safety_signal"]),
                    "ops_signal": bool(cr["ops_signal"]),
                    "cyber_awareness_signal": bool(cr["cyber_awareness_signal"]),
                    "generation_priority": cr["generation_priority"]
                },
                "chunk": {
                    "chunk_id": str(cr["chunk_id"]),
                    "doc_id": str(cr["doc_id"]),
                    "source_registry_id": str(cr["source_registry_id"]),
                    "locator": cr["locator"] or "",
                    "text": text
                }
            }

            try:
                out = ollama_chat_json(args.model, system, json.dumps(user))
                validate_json(out, schema)

                for v in out.get("vulnerabilities", []):
                    joined = "\n".join([
                        v.get("category_hint", ""),
                        v.get("discipline_subtype_code_hint", ""),
                        v.get("vulnerability_title", ""),
                        v.get("vulnerability_text", ""),
                        v.get("impact_text", ""),
                        "\n".join(v.get("ofc_options", []) or [])
                    ])
                    bad = contains_any(joined, CYBER_TECHNICAL_FORBIDDEN)
                    if bad:
                        print(f"[DROP] chunk={cr['chunk_id']} vuln blocked (cyber technical): term='{bad}'")
                        continue

                    ofcs = [s.strip() for s in (v.get("ofc_options") or []) if isinstance(s, str) and s.strip()]
                    if len(ofcs) < 2:
                        # enforce >=2 options
                        continue
                    ofcs = ofcs[:4]

                    evidence = [{
                        "source_registry_id": str(cr["source_registry_id"]),
                        "doc_id": str(cr["doc_id"]),
                        "chunk_id": str(cr["chunk_id"]),
                        "locator": cr["locator"] or ""
                    }]

                    if args.apply:
                        wcur.execute("""
                          INSERT INTO public.module_vulnerability_candidates
                            (module_code, discipline_subtype_id,
                             vulnerability_title, vulnerability_text, impact_text,
                             ofc_options, evidence,
                             llm_model, llm_run_id, llm_confidence)
                          VALUES
                            (%s, NULL, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s)
                        """, (
                            args.module_code,
                            (v.get("vulnerability_title") or "").strip()[:200] or "Untitled vulnerability",
                            (v.get("vulnerability_text") or "").strip(),
                            (v.get("impact_text") or "").strip(),
                            json.dumps(ofcs),
                            json.dumps(evidence),
                            args.model,
                            run_id,
                            float(v.get("confidence") or 0)
                        ))
                        inserts += 1
            except Exception as e:
                print(f"[ERROR] chunk_id={cr['chunk_id']} failed: {e}")
                continue

    print(f"[OK] comprehension_rows={len(comp_rows)} vulnerability_rows_inserted={inserts} apply={args.apply}")


if __name__ == "__main__":
    main()
