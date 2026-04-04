"""
Tests for report_humanize: no backend leakage, acronym expansion, spacing.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from report_humanize import (
    dedupe_sentences,
    expand_acronym,
    expand_acronym_in_text,
    human_label,
    human_value,
    normalize_spacing,
    sanitize_backend_evidence,
    strip_it_transport_mitigation_when_unconfirmed,
)


def test_normalize_spacing() -> None:
    assert normalize_spacing("  a   b  ") == "a b"
    assert normalize_spacing("A.  B.") == "A. B."
    s = "Same sentence. Same sentence."
    assert normalize_spacing(s) == "Same sentence."


def test_dedupe_sentences() -> None:
    assert dedupe_sentences("") == ""
    assert dedupe_sentences("One. Two.") == "One. Two."
    assert dedupe_sentences("One. One.") == "One."
    assert (
        dedupe_sentences("Additional electric service connections not provided in assessment input. Additional electric service connections not provided in assessment input.")
        == "Additional electric service connections not provided in assessment input."
    )


def test_human_label() -> None:
    assert human_label("E-3_more_than_one_connection") == "Additional electric service connections present"
    assert human_label("backup_duration_hours") == "Backup duration (hours)"
    assert human_label("comm_restoration_coordination") == "Restoration coordination with provider in place"
    assert human_label("building_entry_diversity") == "Building entry diversity"


def test_human_value() -> None:
    assert human_value(True) == "Yes"
    assert human_value(False) == "No"
    assert human_value("yes") == "Yes"
    assert human_value("no") == "No"
    assert human_value("MANUAL_ONSITE") == "Manual (on-site)"
    assert human_value(48) == "48"


def test_sanitize_backend_evidence() -> None:
    inp = "Assessment input records E-3_more_than_one_connection = no. Additional electric service connections not provided in assessment input. Assessment input records E-3_more_than_one_connection = no. On-site backup generation is documented with backup_duration_hours = 48."
    out = sanitize_backend_evidence(inp)
    assert "Assessment input records" not in out
    assert "E-3_more_than_one_connection" not in out
    assert "backup_duration_hours" not in out
    assert "48" in out or "hours" in out


def test_sanitize_cat_key_val() -> None:
    inp = "Communications:time_to_impact_hours = 0; comm_restoration_coordination = no"
    out = sanitize_backend_evidence(inp)
    assert "time_to_impact_hours" not in out
    assert "comm_restoration_coordination" not in out
    assert "Communications" in out


def test_expand_acronym() -> None:
    seen = set()
    assert expand_acronym("WASD", seen) == "Miami-Dade Water and Sewer Department (WASD)"
    assert "WASD" in seen
    assert expand_acronym("WASD", seen) == "WASD"
    assert expand_acronym("Other", seen) == "Other"


def test_expand_acronym_in_text() -> None:
    seen = set()
    t = "Water from WASD and other sources."
    out = expand_acronym_in_text(t, seen)
    assert "Miami-Dade Water and Sewer Department (WASD)" in out
    assert "WASD" in seen


def test_strip_it_transport_mitigation_when_unconfirmed_removes_definitive_reduces() -> None:
    """When IT diversity/independence not confirmed, narrative must not contain definitive 'reduces' mitigation."""
    assessment = {"categories": {"INFORMATION_TECHNOLOGY": {}}}
    text = "Single path documented. Last-mile diversity reduces concentrated failure exposure. Concentrated failure exposure cannot be ruled out."
    out = strip_it_transport_mitigation_when_unconfirmed(text, assessment)
    assert "reduces" not in out.lower(), "Must not claim 'reduces' when diversity not confirmed"
    assert "Route independence and building-entry diversity are not confirmed" in out
    assert "common-corridor failure could affect multiple connections" in out


def test_strip_it_transport_mitigation_when_confirmed_leaves_mitigation() -> None:
    """When IT transport diversity is confirmed, mitigation sentence may remain."""
    assessment = {
        "categories": {
            "INFORMATION_TECHNOLOGY": {
                "it_transport_resilience": {"carrier_diversity": "DIFFERENT_CARRIERS", "building_entry_diversity": "SEPARATE_ENTRIES"},
            },
        },
    }
    text = "Last-mile diversity reduces concentrated failure exposure."
    out = strip_it_transport_mitigation_when_unconfirmed(text, assessment)
    assert "reduces" in out or "Last-mile" in out, "When confirmed, mitigation wording may remain"


if __name__ == "__main__":
    test_normalize_spacing()
    test_dedupe_sentences()
    test_human_label()
    test_human_value()
    test_sanitize_backend_evidence()
    test_sanitize_cat_key_val()
    test_expand_acronym()
    test_expand_acronym_in_text()
    print("All report_humanize tests passed.")
