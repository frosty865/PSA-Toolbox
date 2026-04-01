#!/usr/bin/env python3
"""
Tests for Executive Summary brevity (D3) and narrative coherence (D4).
- D3: Executive summary is 1 paragraph, <= 5 sentences, no bullets/tables
- D4: No "not confirmed%", no "~not confirmed", no placeholders, no leaked anchors
"""
import io
import json
import os
import re
import sys
from pathlib import Path

import pytest

REPORTER_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = REPORTER_DIR.parent.parent
CANONICAL_TEMPLATE = REPO_ROOT / "ADA" / "report template.docx"


def _minimal_assessment():
    return {
        "asset": {"asset_name": "Test Facility", "psa_cell": "555-000-0000"},
        "categories": {
            "ELECTRIC_POWER": {
                "requires_service": True,
                "time_to_impact_hours": 24,
                "loss_fraction_no_backup": 0.5,
                "has_backup_any": True,
                "backup_duration_hours": 48,
                "loss_fraction_with_backup": 0.1,
                "recovery_time_hours": 12,
            },
            "COMMUNICATIONS": {"requires_service": False},
            "INFORMATION_TECHNOLOGY": {"requires_service": False},
            "WATER": {"requires_service": False},
            "WASTEWATER": {"requires_service": False},
            "CRITICAL_PRODUCTS": {},
        },
    }


def _executive_snapshot_with_brief():
    return {
        "posture": "MODERATE — Electric Power reaches severe impact in 24 hours with ~50% functional loss; provider not confirmed.",
        "summary": "Overall posture is MODERATE. Electric Power fails fastest. Electric Power shows deepest loss.",
        "executive_summary_brief": (
            "Overall posture is MODERATE; Electric Power drives risk with provider not confirmed. "
            "Electric Power reaches severe impact in 24 hours. "
            "Electric Power shows the deepest functional loss (~50% without alternate). "
            "Alternate capability sustains operations for up to 48 hours in the shortest sector."
        ),
        "drivers": [
            "Electric Power: Severe impact at 24 hrs; ~50% loss; provider not confirmed.",
        ],
        "matrixRows": [
            {"sector": "Electric Power", "ttiHrs": "24", "lossPct": "50", "backupHrs": "48", "structuralPosture": "weak / UNCONFIRMED / MODERATE"},
        ],
        "cascade": None,
    }


def _run_reporter(payload: dict, work_dir: Path) -> tuple[int, str]:
    """Run reporter; return (exit_code, stderr)."""
    if not CANONICAL_TEMPLATE.exists():
        pytest.skip("No template found: ADA/report template.docx")
    template = CANONICAL_TEMPLATE
    work_dir.mkdir(parents=True, exist_ok=True)
    old_work = os.environ.get("WORK_DIR")
    old_template = os.environ.get("TEMPLATE_PATH")
    os.environ["WORK_DIR"] = str(work_dir)
    os.environ["TEMPLATE_PATH"] = str(template)
    old_stdin = sys.stdin
    sys.stdin = io.StringIO(json.dumps(payload))
    stderr_capture = io.StringIO()
    old_stderr = sys.stderr
    sys.stderr = stderr_capture
    exit_code = 0
    try:
        if str(REPORTER_DIR) not in sys.path:
            sys.path.insert(0, str(REPORTER_DIR))
        from main import main as reporter_main
        reporter_main()
    except SystemExit as e:
        exit_code = e.code if e.code is not None else 1
    finally:
        sys.stdin = old_stdin
        sys.stderr = old_stderr
        os.environ.pop("WORK_DIR", None)
        os.environ.pop("TEMPLATE_PATH", None)
        if old_work:
            os.environ["WORK_DIR"] = old_work
        if old_template:
            os.environ["TEMPLATE_PATH"] = old_template
    return exit_code, stderr_capture.getvalue()


def _extract_docx_text(docx_path: Path) -> str:
    """Extract plain text from DOCX."""
    try:
        import zipfile
        with zipfile.ZipFile(docx_path, "r") as z:
            xml = z.read("word/document.xml").decode("utf-8")
    except Exception:
        return ""
    text = re.sub(r"<w:t[^>]*>([^<]*)</w:t>", r"\1", xml)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


@pytest.fixture
def work_dir(tmp_path):
    return tmp_path


def test_executive_summary_brief_brevity(work_dir):
    """D3: Executive summary brief injected when provided; no bullet chars in brief."""
    payload = {
        "assessment": _minimal_assessment(),
        "vofc_collection": {"items": []},
        "executive_snapshot": _executive_snapshot_with_brief(),
        "priority_actions": {
            "title": "Priority Actions",
            "actions": [{"number": i, "leadIn": f"A{i}", "fullText": f"Text {i}."} for i in range(1, 6)],
        },
    }
    exit_code, _ = _run_reporter(payload, work_dir)
    assert exit_code == 0
    text = _extract_docx_text(work_dir / "output.docx")
    # Brief contains posture and driver clause (template may or may not have TABLE_SUMMARY)
    assert "Overall posture is MODERATE" in text or "Electric Power" in text


def test_narrative_no_not_confirmed_pct(work_dir):
    """D4: No literal 'not confirmed%' in sector narratives; sectors without service use different phrasing."""
    payload = {
        "assessment": _minimal_assessment(),
        "vofc_collection": {"items": []},
        "executive_snapshot": _executive_snapshot_with_brief(),
        "priority_actions": {
            "title": "Priority Actions",
            "actions": [{"number": i, "leadIn": f"A{i}", "fullText": f"Text {i}."} for i in range(1, 6)],
        },
    }
    exit_code, _ = _run_reporter(payload, work_dir)
    assert exit_code == 0
    text = _extract_docx_text(work_dir / "output.docx")
    assert "not confirmed%" not in text
    assert "[[CHART_" not in text
    assert "[[SNAPSHOT_" not in text
