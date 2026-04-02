#!/usr/bin/env python3
"""
Build PER review packets from analyzer output.
Generates markdown review packets and JSON data file.
"""

import os
import json
import glob
import re
from datetime import datetime
from pathlib import Path

# Configuration
ENGINE_DIR = Path(__file__).parent.parent
OUT_DIR = ENGINE_DIR / "doctrine" / "baseline_canon" / "review_packets"

DISCIPLINE_PREFIX = "PER"
ACTIONS_KEEP = {"REWRITE_TO_CONTROL_ASSERTION", "MOVE_TO_COMPONENT_CHECKLIST"}
ACTION_DROP = "DROP"

# Search directories (relative to project root)
SEARCH_DIRS = [
    Path(__file__).parent.parent.parent / "analytics" / "reports",
    Path(__file__).parent.parent.parent / "analytics" / "runtime",
]

PATTERNS = [
    "*legacy*baseline*refactor*.json",
    "*baseline*refactor*.json",
]


def newest_json_candidate():
    """Find the most recent analyzer output JSON file."""
    candidates = []
    for search_dir in SEARCH_DIRS:
        if not search_dir.exists():
            continue
        for pattern in PATTERNS:
            for path in search_dir.glob(pattern):
                if not path.suffix == ".json":
                    continue
                # Avoid obvious non-analyzer files
                lp = str(path).lower()
                if any(x in lp for x in ["taxonomy", "disciplines", "discipline_subtypes", "subsectors", "sectors"]):
                    continue
                try:
                    mtime = path.stat().st_mtime
                except OSError:
                    continue
                candidates.append((mtime, path))
    
    if not candidates:
        return None
    
    candidates.sort(reverse=True)
    
    # Choose first that looks like analyzer output by having "outcome" fields
    for _, path in candidates[:50]:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            recs = data if isinstance(data, list) else (
                data.get("records") or data.get("results") or data.get("rows") or data.get("items", [])
            )
            if isinstance(recs, list) and recs and isinstance(recs[0], dict) and "outcome" in recs[0]:
                return path
        except Exception:
            continue
    
    # Fallback to newest
    if candidates:
        return candidates[0][1]
    return None


def load_records(path):
    """Load records from analyzer output JSON."""
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    if isinstance(data, list):
        return data
    
    for k in ("records", "results", "rows", "items"):
        if k in data and isinstance(data[k], list):
            return data[k]
    
    raise ValueError(f"Unrecognized analyzer output shape: {path}")


def g(rec, *keys, default=None):
    """Get value from record using multiple possible keys."""
    for k in keys:
        if k in rec and rec[k] not in (None, ""):
            return rec[k]
    return default


def normalize_action(rec):
    """Normalize action/outcome field."""
    return g(rec, "outcome", "action", "route", default="").strip()


def is_per(rec):
    """Check if record is PER discipline."""
    code = g(rec, "discipline_subtype_code", default="") or ""
    # discipline_subtype_code formats like PER_*
    return code.startswith(DISCIPLINE_PREFIX + "_") or code == DISCIPLINE_PREFIX


def md_escape(s):
    """Escape markdown special characters."""
    if s is None:
        return ""
    return str(s).replace("\r", "").strip()


def write_packet_md(path, title, items):
    """Write markdown review packet."""
    lines = []
    lines.append(f"# {title}")
    lines.append("")
    lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
    lines.append("")
    lines.append(f"Count: {len(items)}")
    lines.append("")
    
    for i, rec in enumerate(items, 1):
        element_code = g(rec, "legacy_code", "element_code", "element_id", default="")
        subtype = g(rec, "discipline_subtype_code", default="")
        dim = g(rec, "capability_dimension", default="")
        action = normalize_action(rec)
        q = g(rec, "proposed_rewrite", "question_text", "question", "text", default="")
        notes = g(rec, "notes", "reason", "explanation", default="")
        rewrite_template = g(rec, "rewrite_template", default="")
        proposed_rewrite = g(rec, "proposed_rewrite", default="")
        reason_codes = g(rec, "reason_codes", default=[])
        lint = g(rec, "lint", default={}) or {}
        lint_ok = lint.get("ok")
        lint_codes = lint.get("reason_codes") or []
        
        # Keep it review-friendly and deterministic
        lines.append(f"## {i}. {element_code} | {subtype} | {dim} | {action}")
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
        
        lines.append("**Lint**")
        lines.append("")
        lines.append(f"- ok: {lint_ok}")
        if lint_codes:
            lines.append(f"- reason_codes: {', '.join(lint_codes)}")
        lines.append("")
        
        # Reviewer decision stub (to be filled manually)
        lines.append("**Reviewer decision**")
        lines.append("")
        lines.append("- Baseline spine candidate? (YES/NO)")
        lines.append("- Boundary statement (if YES):")
        lines.append("- If NO: DROP or COMPONENT?")
        lines.append("")
    
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines).rstrip() + "\n")


def main():
    """Main execution."""
    src = newest_json_candidate()
    if not src:
        raise SystemExit(
            "[FAIL] Could not find analyzer output JSON. "
            "Put the analyzer output under analytics/reports/ and rerun."
        )
    
    recs = load_records(src)
    per = [r for r in recs if isinstance(r, dict) and is_per(r)]
    
    keep = [r for r in per if normalize_action(r) in ACTIONS_KEEP]
    rewrites_all = [r for r in keep if normalize_action(r) == "REWRITE_TO_CONTROL_ASSERTION"]
    # Filter: REWRITE packet includes only lint PASS
    rewrites_pass = [r for r in rewrites_all if (r.get("lint") or {}).get("ok") is True]
    rewrites_fail = [r for r in rewrites_all if (r.get("lint") or {}).get("ok") is False]
    comps = [r for r in keep if normalize_action(r) == "MOVE_TO_COMPONENT_CHECKLIST"]
    drops = [r for r in per if normalize_action(r) == ACTION_DROP]
    
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    
    out_rewrite = OUT_DIR / "PER_REWRITE.md"
    out_rewrite_fail = OUT_DIR / "PER_REWRITE_LINT_FAIL.md"
    out_comp = OUT_DIR / "PER_COMPONENT_CHECKLIST.md"
    out_drop = OUT_DIR / "PER_DROP.md"
    out_data = OUT_DIR / "PER_packets.data.json"
    
    write_packet_md(out_rewrite, "PER — REWRITE_TO_CONTROL_ASSERTION (LINT PASS ONLY)", rewrites_pass)
    write_packet_md(out_rewrite_fail, "PER — REWRITE CANDIDATES BLOCKED BY LINT", rewrites_fail)
    write_packet_md(out_comp, "PER — MOVE_TO_COMPONENT_CHECKLIST (Review Packet)", comps)
    write_packet_md(out_drop, "PER — DROP (Lock Eliminations)", drops)
    
    with open(out_data, "w", encoding="utf-8") as f:
        json.dump({
            "source_file": str(src),
            "discipline": "PER",
            "counts": {
                "total_per": len(per),
                "rewrite_all": len(rewrites_all),
                "rewrite_lint_pass": len(rewrites_pass),
                "rewrite_lint_fail": len(rewrites_fail),
                "component_checklist": len(comps),
                "drop": len(drops),
            },
        }, f, ensure_ascii=False, indent=2)
    
    print("SOURCE:", src)
    print("PER TOTAL:", len(per))
    print("REWRITE ALL:", len(rewrites_all))
    print("REWRITE LINT PASS:", len(rewrites_pass))
    print("REWRITE LINT FAIL:", len(rewrites_fail))
    print("COMPONENT_CHECKLIST:", len(comps))
    print("DROP:", len(drops))
    print("WROTE:")
    print(" -", out_rewrite)
    print(" -", out_rewrite_fail)
    print(" -", out_comp)
    print(" -", out_drop)
    print(" -", out_data)


if __name__ == "__main__":
    main()
