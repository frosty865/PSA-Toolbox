#!/usr/bin/env python3
"""
One-off repro script for Comms PACE chart PRIMARY vs effective_capacity_pct mismatch.
Read-only: loads JSON, prints inputs, calls reporter's build_pace_model_from_comm,
compares PRIMARY series to comm_pace_P.effective_capacity_pct, dumps dependency summary Notes.

Usage:
  python tools/repro_primary_chart_issue.py [path/to/assessment.json]
  Default path: /mnt/data/asset-dependency-progress-2026-03-05.json (override with arg or env ASSESSMENT_JSON).
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Reporter app root (parent of tools/)
REPORTER_ROOT = Path(__file__).resolve().parent.parent
if str(REPORTER_ROOT) not in sys.path:
    sys.path.insert(0, str(REPORTER_ROOT))

def main() -> None:
    default_path = os.environ.get("ASSESSMENT_JSON", "/mnt/data/asset-dependency-progress-2026-03-05.json")
    json_path = sys.argv[1] if len(sys.argv) > 1 else default_path
    path = Path(json_path)
    if not path.is_file():
        print(f"ERROR: JSON file not found: {path}", file=sys.stderr)
        print("Usage: python tools/repro_primary_chart_issue.py [path/to/assessment.json]", file=sys.stderr)
        sys.exit(1)

    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    categories = data.get("categories") or {}
    comm = categories.get("COMMUNICATIONS") or {}
    if isinstance(comm, dict):
        comm = dict(comm)
    else:
        comm = {}

    # --- Comms PACE inputs ---
    print("=== Comms PACE inputs (categories.COMMUNICATIONS) ===")
    for key in ("comm_pace_P", "comm_pace_A", "comm_pace_C", "comm_pace_E"):
        raw = comm.get(key) or {}
        if isinstance(raw, dict):
            cap = raw.get("effective_capacity_pct")
            print(f"  {key}: effective_capacity_pct = {cap!r}")
        else:
            print(f"  {key}: (not a dict) {type(raw).__name__}")

    # --- Build PACE model (same as reporter) ---
    from main import build_pace_model_from_comm

    pace_model = build_pace_model_from_comm(comm)
    layers = pace_model.get("layers") or {}
    order = ["PRIMARY", "ALTERNATE", "CONTINGENCY", "EMERGENCY"]

    print("\n=== PACE model series (computed by build_pace_model_from_comm) ===")
    p_cap_input = None
    if isinstance(comm.get("comm_pace_P"), dict):
        p_cap_input = comm["comm_pace_P"].get("effective_capacity_pct")

    for key in order:
        layer = layers.get(key) or {}
        curve = layer.get("curve") or []
        present = layer.get("present", False)
        if curve:
            # Sample: t=0, t=24, t=96
            t0 = next((p for p in curve if p.get("t_hours") == 0), None)
            t24 = next((p for p in curve if p.get("t_hours") == 24), None)
            t96 = next((p for p in curve if p.get("t_hours") == 96), None)
            caps = [t0.get("capacity_pct") if t0 else None, t24.get("capacity_pct") if t24 else None, t96.get("capacity_pct") if t96 else None]
            print(f"  {key}: present={present}, curve sample t=0,24,96 capacity_pct = {caps}")
        else:
            print(f"  {key}: present={present}, curve=[]")

    # --- Mismatch report: PRIMARY vs comm_pace_P.effective_capacity_pct ---
    print("\n=== PRIMARY vs comm_pace_P.effective_capacity_pct ===")
    primary_curve = (layers.get("PRIMARY") or {}).get("curve") or []
    if primary_curve and p_cap_input is not None:
        # After TTI, PRIMARY curve should reflect legacy cap_after (100 - loss_no_backup), NOT comm_pace_P.effective_capacity_pct
        # So we expect mismatch when PACE data exists: PRIMARY is built from time_to_impact_hours + loss_fraction_no_backup.
        tti = comm.get("time_to_impact_hours") or comm.get("curve_time_to_impact_hours")
        loss = comm.get("loss_fraction_no_backup") or comm.get("curve_loss_fraction_no_backup")
        cap_after_legacy = 100 - (100 * (loss if loss is not None else 0)) if loss is not None else None
        after_tti = [p for p in primary_curve if tti is not None and p.get("t_hours", 0) >= (tti or 0)]
        plotted_after = after_tti[0].get("capacity_pct") if after_tti else None
        print(f"  comm_pace_P.effective_capacity_pct (input): {p_cap_input}")
        print(f"  Legacy time_to_impact_hours: {tti}, loss_fraction_no_backup: {loss} -> cap_after (legacy): {cap_after_legacy}")
        print(f"  PRIMARY curve capacity_pct after TTI (plotted): {plotted_after}")
        if plotted_after is not None and p_cap_input is not None and abs(plotted_after - p_cap_input) > 0.01:
            print("  MISMATCH: PRIMARY plotted value does not equal comm_pace_P.effective_capacity_pct (PRIMARY uses legacy curve, not PACE P layer).")
        else:
            print("  (PRIMARY curve is built from legacy t_impact/cap_after when PACE data exists; comm_pace_P.effective_capacity_pct is not used for PRIMARY.)")
    elif primary_curve:
        print("  comm_pace_P.effective_capacity_pct: not set in input.")
        print("  PRIMARY curve sample:", [p.get("capacity_pct") for p in primary_curve[:5]], "...")
    else:
        print("  No PRIMARY curve in model.")

    # --- Dependency summary Notes at DOCX render time ---
    print("\n=== Dependency summary Notes (at DOCX render) ===")
    report_vm = data.get("report_vm") or {}
    part2 = report_vm.get("part2") or {}
    summary_rows = part2.get("dependency_summary_rows")
    if summary_rows:
        for row in summary_rows:
            cat = row.get("category", "")
            notes = row.get("notes", "")
            print(f"  {cat!r}: notes = {notes!r}")
    else:
        # Fallback: Python build_summary
        from main import build_summary
        assessment = data.get("assessment") or data
        summary_rows = build_summary(assessment)
        for row in summary_rows:
            cat = row.get("category", "")
            notes = row.get("notes", "")
            print(f"  {cat!r}: notes = {notes!r}")

    print("\nDone.")

if __name__ == "__main__":
    main()
