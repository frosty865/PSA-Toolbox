#!/usr/bin/env python3
"""
Build Module Questions from Vulnerability Candidates

Consolidates, deduplicates, and selects <=12 vulnerabilities, then writes to module_questions.
Forces coverage: LIFE_SAFETY (>=2) + OPERATIONS (>=2) when present in candidates.
Uses deterministic normalization + Jaccard token overlap for dedupe.
"""

import os
import re
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

DOMAIN_ORDER = ["LIFE_SAFETY", "OPERATIONS", "PHYSICAL_SECURITY", "USER_SAFETY", "CYBER_AWARENESS"]


def norm(s: str) -> str:
    """Normalize text for deduplication."""
    s = (s or "").lower().strip()
    s = re.sub(r"[^a-z0-9\s]+", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s


def tokens(s: str) -> set:
    """Extract tokens (words >=3 chars) from normalized text."""
    return set([t for t in norm(s).split(" ") if len(t) >= 3])


def jaccard(a: set, b: set) -> float:
    """Calculate Jaccard similarity between token sets."""
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def question_from_vuln(vtxt: str) -> str:
    """Generate question text from vulnerability text."""
    v = (vtxt or "").strip().rstrip(".")
    # Keep it existence / capability framing.
    return f"Is there a capability or process in place to prevent or mitigate the condition where {v}?"


def category(vtxt: str, itxt: str) -> str:
    """Heuristic categorizer (deterministic) to support life safety / ops coverage."""
    t = (vtxt + " " + itxt).lower()
    life = ["fire", "suppression", "extinguisher", "sprinkler", "thermal", "runaway", "smoke", "ems", "evac", "shutdown", "isolation", "barrier", "separation", "heat"]
    ops = ["procedure", "plan", "drill", "exercise", "coordination", "fire department", "training", "post order", "inspection", "maintenance", "response", "notification", "reporting"]
    cyber_aw = ["phishing", "scam", "fraud", "qr", "impersonation", "social engineering"]
    if any(k in t for k in life):
        return "LIFE_SAFETY"
    if any(k in t for k in ops):
        return "OPERATIONS"
    if any(k in t for k in cyber_aw):
        return "CYBER_AWARENESS"
    phys = ["lighting", "camera", "cctv", "visibility", "barrier", "bollard", "access", "tamper", "signage", "fence"]
    user = ["trip", "slip", "wayfinding", "pedestrian", "marking", "crosswalk"]
    if any(k in t for k in phys):
        return "PHYSICAL_SECURITY"
    if any(k in t for k in user):
        return "USER_SAFETY"
    return "PHYSICAL_SECURITY"


def main():
    ap = argparse.ArgumentParser(
        description="Build module questions from vulnerability candidates"
    )
    ap.add_argument("--module-code", required=True, help="Module code (e.g., MODULE_EV_PARKING)")
    ap.add_argument("--model", required=True, help="Model name for provenance in module_questions")
    ap.add_argument("--max-questions", type=int, default=12, help="Maximum questions to create (default 12)")
    ap.add_argument("--dedupe-threshold", type=float, default=0.72, help="Jaccard similarity threshold for deduplication (default 0.72)")
    ap.add_argument("--apply", action="store_true", help="Actually insert into database (dry-run by default)")
    args = ap.parse_args()

    runtime_url = (
        os.environ.get("RUNTIME_DATABASE_URL")
        or os.environ.get("RUNTIME_DB_URL")
        or os.environ.get("DATABASE_URL_RUNTIME")
        or ""
    )
    if not runtime_url:
        raise SystemExit(
            "Missing RUNTIME_DATABASE_URL (or RUNTIME_DB_URL / DATABASE_URL_RUNTIME)."
        )

    db = psycopg2.connect(runtime_url)

    # Ensure module_questions exists (if migration not yet run)
    with db, db.cursor() as cur:
        cur.execute("""
          CREATE TABLE IF NOT EXISTS public.module_questions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            module_code text NOT NULL,
            discipline_subtype_id uuid NULL,
            vulnerability_title text NOT NULL,
            vulnerability_text text NOT NULL,
            impact_text text NOT NULL,
            question_text text NOT NULL,
            ofc_options jsonb NOT NULL DEFAULT '[]'::jsonb,
            evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
            llm_model text NOT NULL,
            llm_run_id text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
          );
          CREATE INDEX IF NOT EXISTS idx_module_questions_module_code ON public.module_questions(module_code);
        """)

    with db, db.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
          SELECT
            id, vulnerability_title, vulnerability_text, impact_text, ofc_options, evidence, llm_confidence,
            created_at
          FROM public.module_vulnerability_candidates
          WHERE module_code = %s
          ORDER BY llm_confidence DESC NULLS LAST, created_at ASC
        """, (args.module_code,))
        rows = cur.fetchall()

    if not rows:
        print("[0] No vulnerability candidates found. Run extract_module_vulnerabilities_from_corpus.py --apply first.")
        return

    # Dedupe by normalized token overlap on vulnerability_text
    kept = []
    kept_tokens = []
    for r in rows:
        vtxt = (r["vulnerability_text"] or "").strip()
        if not vtxt:
            continue
        ofcs = r["ofc_options"] or []
        if isinstance(ofcs, str):
            try:
                ofcs = json.loads(ofcs)
            except:
                ofcs = []
        ofcs = [s.strip() for s in ofcs if isinstance(s, str) and s.strip()]
        if len(ofcs) < 2:
            continue

        tok = tokens(vtxt)
        dup = False
        for kt in kept_tokens:
            if jaccard(tok, kt) >= args.dedupe_threshold:
                dup = True
                break
        if dup:
            continue

        kept.append({
            "id": str(r["id"]),
            "title": (r["vulnerability_title"] or "").strip()[:200] or "Untitled vulnerability",
            "vuln": vtxt,
            "impact": (r["impact_text"] or "").strip(),
            "ofcs": ofcs[:4],
            "evidence": r["evidence"] or [],
            "category": category(vtxt, r["impact_text"] or ""),
            "confidence": float(r["llm_confidence"] or 0)
        })
        kept_tokens.append(tok)

    if not kept:
        print("[0] All candidates filtered (dedupe or <2 ofcs).")
        return

    # Ensure coverage: try to include life safety and ops when present
    by_cat = {k: [] for k in DOMAIN_ORDER}
    for item in kept:
        by_cat.setdefault(item["category"], []).append(item)

    selected = []

    def take(cat: str, n: int):
        """Take up to n items from category."""
        for it in by_cat.get(cat, []):
            if len(selected) >= args.max_questions:
                break
            if it in selected:
                continue
            selected.append(it)
            if sum(1 for x in selected if x["category"] == cat) >= n:
                break

    # Minimums if available
    take("LIFE_SAFETY", 2)
    take("OPERATIONS", 2)

    # Fill remaining by priority order and confidence
    rest = []
    for cat in DOMAIN_ORDER:
        rest.extend(by_cat.get(cat, []))
    rest = sorted(rest, key=lambda x: (-x["confidence"], DOMAIN_ORDER.index(x["category"]) if x["category"] in DOMAIN_ORDER else 99))

    for it in rest:
        if len(selected) >= args.max_questions:
            break
        if it in selected:
            continue
        selected.append(it)

    run_id = f"{args.module_code}:{args.model}:finalize"
    inserts = 0

    with db, db.cursor() as cur:
        if args.apply:
            # Clear previous generated questions for this module (idempotent regeneration)
            cur.execute("DELETE FROM public.module_questions WHERE module_code = %s", (args.module_code,))

            for it in selected:
                q = question_from_vuln(it["vuln"])
                cur.execute("""
                  INSERT INTO public.module_questions
                    (module_code, discipline_subtype_id,
                     vulnerability_title, vulnerability_text, impact_text,
                     question_text, ofc_options, evidence,
                     llm_model, llm_run_id)
                  VALUES
                    (%s, NULL, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s)
                """, (
                    args.module_code,
                    it["title"],
                    it["vuln"],
                    it["impact"],
                    q,
                    json.dumps(it["ofcs"]),
                    json.dumps(it["evidence"]),
                    args.model,
                    run_id
                ))
                inserts += 1

    print(f"[OK] candidates_in={len(rows)} after_dedupe={len(kept)} selected={len(selected)} module_questions_written={inserts} apply={args.apply}")

    # Print preview for quick validation
    for i, it in enumerate(selected, 1):
        print(f"\n[{i}] {it['category']} :: {it['title']}")
        print(f"VULN: {it['vuln']}")
        print(f"OFCs: {len(it['ofcs'])}")


if __name__ == "__main__":
    main()
