"""
Payload handling and Part II data resolution.
Strict truth mode: no legacy vulnerability_blocks fallback.
No docx operations; pure dict in/out.
"""
from __future__ import annotations

import os

from constants import _PART2_CATEGORY_ORDER, _SEVERITY_ORDER


def get_part2_findings(assessment: dict):
    """
    Part II vulnerability source when report_vm.part2.vulnerabilities is not present (caller handles that first).
    Strict precedence: report_themed_findings from assessment.categories only.
    Returns themed findings list ordered by severity/category/title.
    Raises ValueError when no truth-backed findings are present.
    """
    tf: list = []
    try:
        cats = assessment.get("categories") or {}
        for cat_id in _PART2_CATEGORY_ORDER:
            cat = cats.get(cat_id) or {}
            arr = (cat or {}).get("report_themed_findings") or []
            for item in arr:
                if not item or not isinstance(item, dict):
                    continue
                title = (item.get("title") or "").strip()
                narrative = (item.get("narrative") or "").strip()
                ofc = (item.get("ofcText") or "").strip()
                if title and (narrative or ofc):
                    tf.append({**item, "category": cat_id})
    except Exception:
        tf = []
    if tf:
        # Order: severity (HIGH first), then category order, then title
        def _key(f):
            sev = (f.get("severity") or "").upper()
            sev_idx = _SEVERITY_ORDER.index(sev) if sev in _SEVERITY_ORDER else 99
            cat_idx = _PART2_CATEGORY_ORDER.index(f.get("category") or "") if (f.get("category") or "") in _PART2_CATEGORY_ORDER else 99
            return (sev_idx, cat_idx, (f.get("title") or "").lower())

        return sorted(tf, key=_key)
    raise ValueError("Missing structured Part II findings: report_themed_findings not present.")


def use_legacy_vuln_string() -> bool:
    """True when REPORTER_USE_LEGACY_VULN_STRING is set to 1/true/yes (allow legacy vulnerability_blocks string injection)."""
    return os.environ.get("REPORTER_USE_LEGACY_VULN_STRING", "0").strip().lower() in ("1", "true", "yes")


def get_part2_from_payload(data: dict) -> tuple[dict, bool]:
    """
    Resolve Part II dict and whether to use report_vm (structured) path.
    Returns (part2_dict, use_vm). part2_dict is report_vm.part2 or {}.
    """
    vm = data.get("report_vm") if isinstance(data, dict) else None
    use_vm = vm is not None and isinstance(vm, dict)
    part2 = (vm.get("part2") or {}) if use_vm else {}
    return part2, use_vm
