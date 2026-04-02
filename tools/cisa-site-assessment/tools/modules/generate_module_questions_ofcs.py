#!/usr/bin/env python3
"""
Generate analyst-grade module questions and OFCs from evidence chunks.

- 2-pass: Pass A produces up to 24 candidates with value_score; Pass B is a
  deterministic reducer to 12 by coverage diversity (Jaccard >= 0.5 clustering).
- Every OFC must have >=1 citation (source_registry_id = RUNTIME source id: module_sources.id or module_documents.id; + locator_type + locator_value).
- Optional --persist writes to RUNTIME only (module_instances, criteria, OFCs, citations; source metadata from module_sources/module_documents).

Requires: data/module_chunks/<module_code>.json from extract_module_pdfs_to_chunks.py (RUNTIME-only extract).
"""

import os
import json
import argparse
import sys
import time
import threading
from pathlib import Path
from typing import Any

# Allow import of module_crawler from any cwd: add project root and tools dir
_ollama_import_error = None
_script_dir = Path(__file__).resolve().parent  # .../tools/modules
_ROOT = _script_dir.parents[1]   # psa_rebuild (parent of tools)
_TOOLS = _script_dir.parent      # tools
for _p in (_ROOT, _TOOLS):
    _s = str(_p)
    if _s not in sys.path:
        sys.path.insert(0, _s)
try:
    from tools.module_crawler.llm.ollama_json import ollama_chat_json
except ImportError:
    try:
        from module_crawler.llm.ollama_json import ollama_chat_json
    except ImportError as _e:
        ollama_chat_json = None  # type: ignore[assignment]
        _ollama_import_error = _e

# Load .env.local
try:
    from dotenv import load_dotenv
    _env = Path(__file__).resolve().parents[2] / ".env.local"
    if _env.exists():
        load_dotenv(_env)
except ImportError:
    _env = Path(__file__).resolve().parents[2] / ".env.local"
    if _env.exists():
        with open(_env, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    os.environ[k.strip()] = v.strip().strip('"').strip("'")

SYSTEM_RULES = """
You are producing a module-specific assessment set for a Protective Security Advisor (PSA).

REQUIRED OUTPUT SHAPE (non-negotiable)
- Your response MUST be a single JSON object with exactly two top-level keys: "module_code" (string) and "questions" (array). No other keys. Do NOT return a glossary, acronym list, summary, or any other structure—only the assessment JSON below.

TASK: CREATE (author) new assessment questions and mitigation measures (OFCs). Do NOT search for or extract pre-existing questions from the evidence. Do NOT extract glossaries or acronyms from the evidence. Use the evidence only to ground and cite what you create—you are writing new criteria and OFCs that the evidence supports, not finding questions or definitions that already appear in the text.

OUTPUT TARGET
- Analyst-grade, comprehensive, cognizant criteria and OFCs.
- Tone: authoritative, concise, technical-but-readable. Not conversational. Not "friendly." No filler.
- Questions must be existence/coverage checks with YES/NO/N/A answers.
- Each question must be meaningfully distinct (no near-duplicates) and collectively comprehensive for the module topic.

SCOPE LOCK (PSA)
- Physical security, governance, planning, operations only.
- No cyber technical controls (no network defenses, IAM, patching, monitoring tools, EDR, etc.).
- No regulatory/compliance language (no "must comply with", no citations as mandates).
- OFCs describe WHAT capability should exist, not HOW to implement it. Avoid naming products/technologies.

EVIDENCE AND CITATIONS (NON-NEGOTIABLE)
- Use ONLY the provided evidence chunks to inform and support what you CREATE. Do not look for questions in the text—create questions and OFCs, then cite chunks that support them.
- Every OFC MUST include >=1 citation with:
  source_registry_id, locator_type, locator_value.
- Citations must be plausible support for the OFC (no mismatches).
- Prefer authoritative sources and the most specific locator available.

STRUCTURE REQUIREMENTS
- Max 24 candidate questions (you will output up to 24; a later step selects 12).
- Each question: 2–4 OFCs.
- Each question includes a short "assessment_intent" (1 sentence) describing what the assessor is determining.
- Each question includes "risk_rationale" (1 sentence) stating the operational consequence if absent.
- Each question includes "coverage_tags" (array of 2–5 concise tags) for later de-duplication (e.g., ["zoning","separation","egress"]).
- Each question includes "value_score" (integer 1–5): 5 = highest value for coverage/assessability, 1 = lowest.

OUTPUT FORMAT
Return strict JSON only. No markdown. No commentary. Only the object with "module_code" and "questions"—no glossary, no other keys.

JSON SCHEMA (Pass A – candidates with value_score)
{
  "module_code": "MODULE_X",
  "questions": [
    {
      "key": "MOD_001",
      "question": "…",
      "assessment_intent": "…",
      "risk_rationale": "…",
      "applicability": "APPLIES",
      "coverage_tags": ["…","…"],
      "value_score": 4,
      "subtype_code": null,
      "ofcs": [
        {
          "ofc_code": "OFC_MOD_001A",
          "text": "…",
          "citations": [
            {"source_registry_id":"uuid","locator_type":"PAGE","locator_value":"3","note":null}
          ]
        }
      ]
    }
  ]
}

QUALITY BAR
- Questions: concrete, assessable, unambiguous, and scoped to facility capabilities.
- OFCs: capability-level options for consideration; not restatements of the question.
- Prefer phrasing that supports field verification (observable policy, process, layout, coordination, readiness).
""".strip()


def load_chunks_payload(module_code: str, data_dir: Path) -> dict[str, Any]:
    path = data_dir / "module_chunks" / f"{module_code}.json"
    if not path.exists():
        raise FileNotFoundError(
            f"Chunks file not found: {path}. Run: python tools/modules/extract_module_pdfs_to_chunks.py {module_code}"
        )
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_evidence_text(payload: dict[str, Any]) -> str:
    """Format chunks as citation-ready cards and include source index."""
    source_index = payload.get("source_index") or {}
    chunks = payload.get("chunks") or []
    lines = ["# SOURCE INDEX (source_registry_id -> title)", ""]
    for sid, title in source_index.items():
        lines.append(f"  {sid}: {title}")
    lines.append("")
    lines.append("# EVIDENCE CHUNKS (use these for citations only)")
    lines.append("")
    for c in chunks:
        sid = c.get("source_registry_id", "")
        loc_type = (c.get("locator_type") or "page").upper()
        loc_val = c.get("locator_value") or ""
        text = (c.get("text") or "").strip()
        lines.append("[CHUNK]")
        lines.append(f"source_registry_id: {sid}")
        lines.append(f"locator: {loc_type}:{loc_val}")
        lines.append(f"text: {text}")
        lines.append("")
    return "\n".join(lines)


def jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def reduce_to_12_by_coverage(questions: list[dict], threshold: float = 0.5) -> list[dict]:
    """Group by coverage_tags overlap (Jaccard >= threshold), keep highest value_score per cluster, return up to 12."""
    if len(questions) <= 12:
        return questions[:12]
    # Normalize tags to sets
    for q in questions:
        q["_tags_set"] = set((q.get("coverage_tags") or []))
        q["_value_score"] = int(q.get("value_score") or 1)
    # Greedy clustering: assign each question to a cluster (first question starts cluster; others join if Jaccard >= threshold with any in cluster)
    clusters: list[list[dict]] = []
    for q in questions:
        placed = False
        for cl in clusters:
            for existing in cl:
                if jaccard(q["_tags_set"], existing["_tags_set"]) >= threshold:
                    cl.append(q)
                    placed = True
                    break
            if placed:
                break
        if not placed:
            clusters.append([q])
    # From each cluster take the one with highest value_score; sort by that score desc, take 12
    representatives = []
    for cl in clusters:
        best = max(cl, key=lambda x: (x["_value_score"], -len(x.get("key", ""))))
        representatives.append(best)
    representatives.sort(key=lambda x: (x["_value_score"], x.get("key", "")), reverse=True)
    out = representatives[:12]
    # Drop internal keys
    for q in out:
        q.pop("_tags_set", None)
        q.pop("_value_score", None)
    for q in questions:
        q.pop("_tags_set", None)
        q.pop("_value_score", None)
    return out


def validate_output(data: dict, allowed_source_ids: set[str]) -> list[str]:
    """Returns list of validation error messages. Empty if valid."""
    errs = []
    qs = data.get("questions") or []
    if len(qs) > 12:
        errs.append(f"questions count {len(qs)} > 12")
    for i, q in enumerate(qs):
        ofcs = q.get("ofcs") or []
        if len(ofcs) < 2 or len(ofcs) > 4:
            errs.append(f"question[{i}] key={q.get('key')} has ofcs count {len(ofcs)} (required 2-4)")
        for j, ofc in enumerate(ofcs):
            cits = ofc.get("citations") or []
            if not cits:
                errs.append(f"question[{i}] ofc[{j}] ofc_code={ofc.get('ofc_code')} has no citations")
            for k, c in enumerate(cits):
                sid = c.get("source_registry_id")
                lt = c.get("locator_type")
                lv = c.get("locator_value")
                if not sid or not lt or lv is None:
                    errs.append(f"question[{i}] ofc[{j}] citation[{k}] missing source_registry_id/locator_type/locator_value")
                elif sid not in allowed_source_ids:
                    errs.append(f"question[{i}] ofc[{j}] citation[{k}] source_registry_id {sid} not in evidence")
    return errs


def normalize_locator_type(lt: str) -> str:
    t = (lt or "page").lower()
    if t == "pdf":
        return "page"
    if t in ("page", "section", "paragraph", "url_fragment", "other"):
        return t
    return "other"


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Generate module questions and OFCs from evidence chunks (2-pass, citations required)"
    )
    ap.add_argument("module_code", help="Module code (e.g., MODULE_EV_PARKING)")
    ap.add_argument("model", help="Ollama model (e.g., llama3.1:8b-instruct)")
    ap.add_argument("--persist", action="store_true", help="Write to RUNTIME (module_instances, criteria, OFCs, citations)")
    ap.add_argument("--data-dir", default=None, help="Data directory (default: psa_rebuild/data)")
    ap.add_argument("--dry-run", action="store_true", help="Only validate and print; do not persist (default if not --persist)")
    ap.add_argument("--ollama-timeout", type=int, default=900, help="Ollama API read timeout in seconds (default: 900)")
    ap.add_argument("--max-chunks", type=int, default=None, metavar="N", help="Max chunks to send to LLM (default: all). Use e.g. 150 for smaller models.")
    ap.add_argument("--debug", action="store_true", help="Print raw LLM response keys and question count to stderr.")
    ap.add_argument("--require-gpu", action="store_true", help="Fail fast unless OLLAMA_GPU_PROVEN=1 (run tools/ollama/prove_gpu.ps1 first)")
    args = ap.parse_args()

    # Force local Ollama only: default to localhost and log (no silent remote)
    url = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
    os.environ["OLLAMA_HOST"] = url  # ollama_json uses OLLAMA_HOST
    print(f"[LLM] Using OLLAMA_URL={url}", file=sys.stderr)

    if args.require_gpu and os.environ.get("OLLAMA_GPU_PROVEN") != "1":
        print(
            "[FAIL] --require-gpu set but OLLAMA_GPU_PROVEN is not 1. "
            "Run: pwsh -ExecutionPolicy Bypass -File tools/ollama/prove_gpu.ps1 -Model <model> -Seconds 25",
            file=sys.stderr,
        )
        raise SystemExit(1)

    if ollama_chat_json is None:
        msg = "Could not import tools.module_crawler.llm.ollama_json."
        if _ollama_import_error:
            msg += f" {_ollama_import_error}"
        msg += " Install deps: pip install requests jsonschema"
        raise SystemExit(msg)

    module_code = args.module_code.strip()
    if not module_code:
        raise SystemExit("module_code is required")

    data_dir = Path(args.data_dir) if args.data_dir else Path(__file__).resolve().parents[2] / "data"
    payload = load_chunks_payload(module_code, data_dir)
    chunks = payload.get("chunks") or []
    total_available = len(chunks)
    if args.max_chunks is not None and args.max_chunks > 0:
        chunks = chunks[: args.max_chunks]
        payload = {**payload, "chunks": chunks}
    allowed_source_ids = {str(c.get("source_registry_id")) for c in chunks if c.get("source_registry_id")}
    if not allowed_source_ids:
        raise SystemExit("No source_registry_id in chunks.")

    evidence_text = build_evidence_text(payload)
    user_message = {
        "module_code": module_code,
        "evidence": evidence_text,
    }

    n_chunks = len(chunks)
    cap_note = f" (capped from {total_available})" if args.max_chunks and n_chunks < total_available else ""
    print(f"[Ollama] Calling {args.model} with {n_chunks} chunks{cap_note} (up to 24 questions). Timeout: {args.ollama_timeout}s. This may take 3–10+ minutes…", file=sys.stderr)
    start = time.perf_counter()
    done = threading.Event()

    def still_running():
        interval = 60
        while not done.wait(timeout=interval):
            elapsed = time.perf_counter() - start
            print(f"[Ollama] Still running… ({elapsed:.0f}s)", file=sys.stderr, flush=True)

    t = threading.Thread(target=still_running, daemon=True)
    t.start()
    try:
        raw = ollama_chat_json(args.model, SYSTEM_RULES, json.dumps(user_message, indent=2), temperature=0.3, timeout=args.ollama_timeout)
    finally:
        done.set()
    elapsed = time.perf_counter() - start
    print(f"[Ollama] Done in {elapsed:.1f}s", file=sys.stderr)
    # Extract JSON if wrapped
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start >= 0 and end > start:
                raw = json.loads(raw[start:end])
            else:
                raise

    # Pass A output may have up to 24 questions; reduce to 12 by coverage diversity
    # Accept "questions" or "Questions" (some models vary casing)
    questions = raw.get("questions") or raw.get("Questions") or []
    if not isinstance(questions, list):
        questions = []
    if args.debug:
        print(f"[debug] raw keys: {list(raw.keys())}", file=sys.stderr)
        print(f"[debug] questions count: {len(questions)}", file=sys.stderr)
        if questions and len(questions) > 0:
            print(f"[debug] first question keys: {list(questions[0].keys()) if isinstance(questions[0], dict) else type(questions[0])}", file=sys.stderr)
        else:
            print(f"[debug] raw (truncated): {json.dumps(raw)[:800]}...", file=sys.stderr)
    if len(questions) > 12:
        questions = reduce_to_12_by_coverage(questions, threshold=0.5)
    else:
        questions = questions[:12]
    # Remove value_score from final output (Pass B schema has no value_score)
    for q in questions:
        q.pop("value_score", None)
    final_output = {"module_code": raw.get("module_code") or module_code, "questions": questions}

    errs = validate_output(final_output, allowed_source_ids)
    if errs:
        drafts_dir = data_dir / "module_llm_drafts"
        drafts_dir.mkdir(parents=True, exist_ok=True)
        draft_path = drafts_dir / f"{module_code}_raw.json"
        with open(draft_path, "w", encoding="utf-8") as f:
            json.dump(raw, f, indent=2, ensure_ascii=False)
        print("Validation failed:", file=sys.stderr)
        for e in errs:
            print(f"  - {e}", file=sys.stderr)
        print(f"Raw output written to {draft_path} for inspection.", file=sys.stderr)
        raise SystemExit(1)

    print(json.dumps(final_output, indent=2, ensure_ascii=False))

    if not args.persist:
        return

    # Persist to RUNTIME (module data stays in RUNTIME only; source metadata from module_sources + module_documents)
    runtime_url = (
        os.environ.get("RUNTIME_DATABASE_URL")
        or os.environ.get("RUNTIME_DB_URL")
        or os.environ.get("DATABASE_URL_RUNTIME")
        or ""
    )
    if not runtime_url:
        raise SystemExit("RUNTIME_DATABASE_URL (or RUNTIME_DB_URL) required for --persist")

    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
    except ImportError:
        raise SystemExit("pip install psycopg2-binary required for --persist")

    runtime = psycopg2.connect(runtime_url)

    try:
        # Resolve discipline_subtype_id from subtype_code (optional)
        with runtime.cursor(cursor_factory=RealDictCursor) as rcur:
            rcur.execute(
                "SELECT id, code FROM public.discipline_subtypes WHERE is_active = true"
            )
            subtype_by_code = {str(row["code"]).upper(): str(row["id"]) for row in rcur.fetchall()}
        default_subtype_id = next(iter(subtype_by_code.values()), None)
        if not default_subtype_id:
            raise SystemExit("RUNTIME has no active discipline_subtypes; cannot persist OFCs (discipline_subtype_id NOT NULL).")

        # Fetch source metadata from RUNTIME (module_sources + module_documents) for citations
        source_meta = {}
        ids_list = list(allowed_source_ids)
        with runtime.cursor(cursor_factory=RealDictCursor) as rcur:
            rcur.execute(
                "SELECT id, COALESCE(source_label, '') AS source_title, source_url AS source_url FROM public.module_sources WHERE id = ANY(%s::uuid[])",
                (ids_list,)
            )
            for row in rcur.fetchall():
                source_meta[str(row["id"])] = {
                    "source_title": row.get("source_title") or "",
                    "source_publisher": None,
                    "source_url": row.get("source_url"),
                    "publication_date": None,
                }
            # Fill from module_documents for ids not in module_sources (e.g. doc used as source when no source row)
            found = set(source_meta)
            missing = [i for i in ids_list if i not in found]
            if missing:
                rcur.execute(
"SELECT id, COALESCE(label, '') AS source_title, url AS source_url FROM public.module_documents WHERE id = ANY(%s::uuid[])",
                (missing,)
                )
                for row in rcur.fetchall():
                    source_meta[str(row["id"])] = {
                        "source_title": row.get("source_title") or "",
                        "source_publisher": None,
                        "source_url": row.get("source_url"),
                        "publication_date": None,
                    }

        with runtime.cursor() as rcur:
            rcur.execute("DELETE FROM public.module_instances WHERE module_code = %s", (module_code,))
            rcur.execute(
                """INSERT INTO public.module_instances (module_code, standard_key, standard_version, attributes_json)
                   VALUES (%s, 'LLM_WIZARD', '1', '{}'::jsonb)
                   RETURNING id""",
                (module_code,)
            )
            row = rcur.fetchone()
            instance_id = str(row[0])

            for idx, q in enumerate(final_output["questions"]):
                key = q.get("key") or f"Q{idx+1:03d}"
                question_text = q.get("question") or ""
                assessment_intent = q.get("assessment_intent") or ""
                title = assessment_intent[:500] if assessment_intent else question_text[:500]
                applicability = (q.get("applicability") or "APPLIES").upper()
                if applicability not in ("APPLIES", "N_A"):
                    applicability = "APPLIES"
                subtype_code = (q.get("subtype_code") or "").strip().upper()
                discipline_subtype_id = subtype_by_code.get(subtype_code) if subtype_code else default_subtype_id

                rcur.execute(
                    """INSERT INTO public.module_instance_criteria
                       (module_instance_id, criterion_key, title, question_text, discipline_subtype_id, applicability, order_index)
                       VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                    (instance_id, key, title, question_text, discipline_subtype_id, applicability, idx + 1)
                )

                for oidx, ofc in enumerate(q.get("ofcs") or []):
                    ofc_code = ofc.get("ofc_code") or f"OFC_{key}_{oidx}"
                    ofc_text = ofc.get("text") or ""
                    if not ofc_text:
                        continue
                    rcur.execute(
                        """INSERT INTO public.module_instance_ofcs
                           (module_instance_id, criterion_key, template_key, discipline_subtype_id, ofc_text, order_index)
                           VALUES (%s, %s, %s, %s, %s, %s)""",
                        (instance_id, key, ofc_code, discipline_subtype_id, ofc_text, oidx + 1)
                    )
                    cits = ofc.get("citations") or []
                    if not cits:
                        runtime.rollback()
                        raise ValueError(f"OFC {ofc_code} has no citations (abort transaction)")
                    for c in cits:
                        sid = str(c.get("source_registry_id") or "")
                        meta = source_meta.get(sid) or {}
                        loc_type = normalize_locator_type(c.get("locator_type"))
                        loc_val = str(c.get("locator_value") or "").strip() or "1"
                        rcur.execute(
                            """INSERT INTO public.module_instance_citations
                               (module_instance_id, criterion_key, template_key, source_title, source_publisher, source_url, publication_date, locator_type, locator_value)
                               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                            (
                                instance_id, key, ofc_code,
                                meta.get("source_title"),
                                meta.get("source_publisher"),
                                meta.get("source_url"),
                                meta.get("publication_date"),
                                loc_type,
                                loc_val,
                            )
                        )
        runtime.commit()
        print(f"[OK] Persisted module_instance for {module_code}", file=sys.stderr)
    except Exception as e:
        runtime.rollback()
        raise SystemExit(f"Persist failed: {e}")
    finally:
        runtime.close()


if __name__ == "__main__":
    main()
