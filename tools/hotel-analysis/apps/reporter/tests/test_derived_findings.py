#!/usr/bin/env python3
"""
Drift guard: derived findings loader must render OFC text and counts from
assessment.sessions.<domain>.derived only (no re-derivation). Ensures DOCX
vulnerability section matches online summary.
"""
import json
from pathlib import Path

import pytest

REPORTER_DIR = Path(__file__).resolve().parent.parent
FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def _load_fixture(name: str) -> dict:
    path = FIXTURES_DIR / name
    if not path.exists():
        pytest.skip(f"Fixture not found: {path}")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def test_derived_findings_ofc_text_matches_derived_ofcs():
    """For each vulnerability_id, rendered OFC text must equal derived.ofcs join (order preserved)."""
    data = _load_fixture("derived_findings_export.json")
    if str(REPORTER_DIR) not in __import__("sys").path:
        import sys
        sys.path.insert(0, str(REPORTER_DIR))
    from main import load_derived_findings_from_payload

    findings = load_derived_findings_from_payload(data)
    # Build expected OFC join per vuln from raw derived.ofcs
    assessment = data.get("assessment") or {}
    sessions = assessment.get("sessions") or {}
    for domain_code in ("ELECTRIC_POWER", "COMMUNICATIONS", "INFORMATION_TECHNOLOGY", "WATER", "WASTEWATER"):
        domain = sessions.get(domain_code) or {}
        derived = domain.get("derived") or {}
        ofcs = derived.get("ofcs") or []
        ofc_by_vuln: dict[str, list[str]] = {}
        for o in ofcs:
            if not isinstance(o, dict):
                continue
            vid = (o.get("vulnerability_id") or "").strip()
            if not vid:
                continue
            text = (o.get("text") or "").strip()
            ofc_by_vuln.setdefault(vid, []).append(text)
        for f in findings:
            if f.get("infrastructure") != domain_code:
                continue
            fid = (f.get("id") or "").strip()
            expected_joined = "\n".join(ofc_by_vuln.get(fid, [])) or None
            actual = f.get("ofcText")
            if expected_joined:
                assert actual == expected_joined, (
                    f"vulnerability_id={fid} domain={domain_code}: "
                    f"expected ofcText {expected_joined!r}, got {actual!r}"
                )
            else:
                assert actual is None or (isinstance(actual, str) and not actual.strip()), (
                    f"vulnerability_id={fid} domain={domain_code}: expected no OFC, got {actual!r}"
                )


def test_derived_findings_count_equals_themed_findings_sum():
    """Number of loaded findings must equal sum of themedFindings lengths across sessions."""
    data = _load_fixture("derived_findings_export.json")
    if str(REPORTER_DIR) not in __import__("sys").path:
        import sys
        sys.path.insert(0, str(REPORTER_DIR))
    from main import load_derived_findings_from_payload

    findings = load_derived_findings_from_payload(data)
    assessment = data.get("assessment") or {}
    sessions = assessment.get("sessions") or {}
    expected_count = 0
    for domain_code in ("ELECTRIC_POWER", "COMMUNICATIONS", "INFORMATION_TECHNOLOGY", "WATER", "WASTEWATER"):
        domain = sessions.get(domain_code) or {}
        derived = domain.get("derived") or {}
        themed = derived.get("themedFindings")
        if not isinstance(themed, list):
            themed = derived.get("vulnerabilities") if isinstance(derived.get("vulnerabilities"), list) else []
        for item in themed or []:
            if item and isinstance(item, dict) and (item.get("title") or "").strip():
                expected_count += 1
    assert len(findings) == expected_count, (
        f"Expected {expected_count} findings (sum of themedFindings), got {len(findings)}"
    )


def test_has_derived_findings_true_when_sessions_derived_present():
    """_has_derived_findings is True when at least one session has derived."""
    data = _load_fixture("derived_findings_export.json")
    if str(REPORTER_DIR) not in __import__("sys").path:
        import sys
        sys.path.insert(0, str(REPORTER_DIR))
    from main import _has_derived_findings

    assert _has_derived_findings(data) is True


def test_has_derived_findings_false_when_no_sessions():
    """_has_derived_findings is False when assessment.sessions is missing."""
    data = {"assessment": {"asset": {}}}
    if str(REPORTER_DIR) not in __import__("sys").path:
        import sys
        sys.path.insert(0, str(REPORTER_DIR))
    from main import _has_derived_findings

    assert _has_derived_findings(data) is False
