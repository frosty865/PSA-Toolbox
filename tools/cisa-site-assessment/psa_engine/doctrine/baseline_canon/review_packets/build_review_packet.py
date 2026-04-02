import json, os, glob
from datetime import datetime
from pathlib import Path

# Calculate paths: build_review_packet.py is at psa_engine/doctrine/baseline_canon/review_packets/
# We need to get to project root (one level up from psa_engine)
ENGINE_DIR = Path(__file__).parent.parent.parent.parent.parent
OUT_DIR = Path(__file__).parent

DISCIPLINE_PREFIX = os.environ.get("DISCIPLINE_PREFIX", "PER").strip()
SOURCE_JSON = os.environ.get("SOURCE_JSON", "").strip()

SEARCH_DIRS = [
  ENGINE_DIR / "analytics",
  ENGINE_DIR / "analytics" / "reports",
  ENGINE_DIR / "analytics" / "runtime",
  ENGINE_DIR / "output",
  ENGINE_DIR / "outputs",
  ENGINE_DIR / "tmp",
]

PATTERNS = [
  "**/*legacy_baseline_refactor_map.json",
  "**/*legacy*baseline*refactor*.json",
  "**/*analy*legacy*baseline*.json",
  "**/*baseline*refactor*.json",
  "**/*.json",
]

def newest_analyzer_json():
    candidates = []
    for d in SEARCH_DIRS:
        if not d.exists():
            continue
        for pat in PATTERNS:
            for p in d.glob(pat):
                if not p.suffix == ".json":
                    continue
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    recs = data if isinstance(data, list) else (data.get("records") or data.get("results") or data.get("rows") or data.get("items"))
                    if isinstance(recs, list) and recs and isinstance(recs[0], dict) and any(k in recs[0] for k in ("outcome", "action", "route", "discipline_subtype_code")):
                        candidates.append((p.stat().st_mtime, p))
                except Exception:
                    continue
    if not candidates:
        return None
    candidates.sort(reverse=True)
    return candidates[0][1]

def load_records(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    for k in ("records", "results", "rows", "items"):
        if k in data and isinstance(data[k], list):
            return data[k]
    raise ValueError("Unrecognized analyzer output shape")

def g(rec, *keys, default=None):
    for k in keys:
        if k in rec and rec[k] not in (None, ""):
            return rec[k]
    return default

def outcome(rec):
    """Extract outcome from record, checking outcome/action/route fields."""
    return (g(rec, "outcome", "action", "route", default="") or "").strip()

def is_discipline(rec):
    code = g(rec, "discipline_subtype_code", default="") or ""
    # SMG special case: include items routed to MOVE_TO_SMG regardless of subtype prefix
    if DISCIPLINE_PREFIX == "SMG":
        outcome_val = outcome(rec)
        action_val = g(rec, "action", default="") or ""
        route_val = g(rec, "route", default="") or ""
        is_routed_to_smg = (outcome_val == "MOVE_TO_SMG") or (action_val == "MOVE_TO_SMG") or (route_val == "MOVE_TO_SMG")
        return (code.startswith(DISCIPLINE_PREFIX + "_") or code == DISCIPLINE_PREFIX) or is_routed_to_smg
    else:
        return code.startswith(DISCIPLINE_PREFIX + "_") or code == DISCIPLINE_PREFIX

def md_escape(s):
    return ("" if s is None else str(s)).replace("\r", "").strip()

def write_md(path, title, items):
    lines = []
    lines.append(f"# {title}")
    lines.append("")
    lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
    lines.append(f"Count: {len(items)}")
    lines.append("")
    for i, rec in enumerate(items, 1):
        legacy = g(rec, "element_code", "legacy_code", "legacy_id", default="")
        subtype = g(rec, "discipline_subtype_code", default="")
        dim = g(rec, "capability_dimension", default="")
        out = outcome(rec)
        q = g(rec, "proposed_rewrite", "question_text", "question", default="")
        notes = g(rec, "notes", default="")
        reason_codes = g(rec, "reason_codes", default=[]) or []
        lint = g(rec, "lint", default={}) or {}
        lint_ok = lint.get("ok")
        lint_codes = lint.get("reason_codes") or []
        lines.append(f"## {i}. {legacy} | {subtype} | {dim} | {out}")
        lines.append("")
        lines.append("**Question text**")
        lines.append("")
        lines.append(md_escape(q) if q else "(missing)")
        lines.append("")
        if notes:
            lines.append("**Analyzer notes**")
            lines.append("")
            lines.append(md_escape(notes))
            lines.append("")
        if reason_codes:
            lines.append("**Reason codes**")
            lines.append("")
            lines.append(", ".join(reason_codes))
            lines.append("")
        lines.append("**Lint**")
        lines.append("")
        lines.append(f"- ok: {lint_ok}")
        if lint_codes:
            lines.append(f"- reason_codes: {', '.join(lint_codes)}")
        lines.append("")
        lines.append("**Reviewer decision**")
        lines.append("")
        lines.append("- Baseline spine candidate? (YES/NO)")
        lines.append("- Boundary statement (if YES):")
        lines.append("- If NO: DROP or COMPONENT?")
        lines.append("")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines).rstrip() + "\n")

def main():
    # Use SOURCE_JSON if provided, otherwise find newest
    if SOURCE_JSON:
        src = Path(SOURCE_JSON)
    else:
        src = newest_analyzer_json()
    
    if not src or not Path(src).exists():
        raise SystemExit(f"[FAIL] Analyzer output JSON not found. SOURCE_JSON={SOURCE_JSON!r}")

    recs_all = load_records(src)
    recs = [r for r in recs_all if isinstance(r, dict) and is_discipline(r)]

    # Classify by outcome (checking outcome/action/route fields)
    rewrites = [r for r in recs if outcome(r) == "REWRITE_TO_CONTROL_ASSERTION"]
    # For SMG, MOVE_TO_SMG items are component depth (governance/procedural items routed from other disciplines)
    if DISCIPLINE_PREFIX == "SMG":
        comps = [r for r in recs if outcome(r) in ("MOVE_TO_COMPONENT_CHECKLIST", "MOVE_TO_SMG")]
    else:
        comps = [r for r in recs if outcome(r) == "MOVE_TO_COMPONENT_CHECKLIST"]
    drops = [r for r in recs if outcome(r) == "DROP"]

    # Explicit fail-closed bucket: items dropped due to lint fail-closed
    # These have outcome=DROP but reason_code=LINT_FAIL_REWRITE_TO_DROP
    fail_closed = [r for r in drops if "LINT_FAIL_REWRITE_TO_DROP" in (r.get("reason_codes") or [])]

    # Sanity: count all outcomes to ensure reconciliation
    outcomes = {}
    for r in recs:
        out = outcome(r)
        outcomes[out] = outcomes.get(out, 0) + 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    write_md(OUT_DIR / f"{DISCIPLINE_PREFIX}_REWRITE.md",
             f"{DISCIPLINE_PREFIX} — REWRITE_TO_CONTROL_ASSERTION", rewrites)

    write_md(OUT_DIR / f"{DISCIPLINE_PREFIX}_FAIL_CLOSED.md",
             f"{DISCIPLINE_PREFIX} — FAIL-CLOSED (LINT_FAIL_REWRITE_TO_DROP)", fail_closed)

    write_md(OUT_DIR / f"{DISCIPLINE_PREFIX}_COMPONENT_CHECKLIST.md",
             f"{DISCIPLINE_PREFIX} — MOVE_TO_COMPONENT_CHECKLIST", comps)

    write_md(OUT_DIR / f"{DISCIPLINE_PREFIX}_DROP.md",
             f"{DISCIPLINE_PREFIX} — DROP", drops)

    data_path = OUT_DIR / f"{DISCIPLINE_PREFIX}_packets.data.json"
    with open(data_path, "w", encoding="utf-8") as f:
        json.dump({
            "source_file": str(src),
            "discipline": DISCIPLINE_PREFIX,
            "counts": {
                "total": len(recs),
                "rewrite": len(rewrites),
                "component_checklist": len(comps),
                "drop": len(drops),
                "fail_closed": len(fail_closed),
                "by_outcome": outcomes,
            },
        }, f, ensure_ascii=False, indent=2)

    # Print sanity counts that must reconcile
    print("SOURCE:", src)
    print("DISCIPLINE:", DISCIPLINE_PREFIX)
    print("TOTAL:", len(recs))
    print("REWRITE:", len(rewrites))
    print("COMPONENT_CHECKLIST:", len(comps))
    print("DROP:", len(drops))
    print("FAIL_CLOSED:", len(fail_closed))
    print("BY_OUTCOME:", outcomes)
    
    # Sanity check: sum of classified items should equal total
    classified_sum = len(rewrites) + len(comps) + len(drops)
    if classified_sum != len(recs):
        print(f"⚠️  WARNING: Classified sum ({classified_sum}) != Total ({len(recs)})")
        print(f"   Unclassified items: {len(recs) - classified_sum}")
    else:
        print("✓ Sanity check passed: All items classified")
    
    # Sanity check: fail_closed should be subset of drops
    if len(fail_closed) > len(drops):
        print(f"⚠️  WARNING: FAIL_CLOSED ({len(fail_closed)}) > DROP ({len(drops)})")
    else:
        print(f"✓ Sanity check passed: FAIL_CLOSED ({len(fail_closed)}) <= DROP ({len(drops)})")
    
    print("WROTE PACKETS IN:", OUT_DIR)

if __name__ == "__main__":
    main()
