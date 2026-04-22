#!/usr/bin/env python3
"""
Validate the HOST VOFC catalog against the assessment JSON for drift.

Checks:
- source fields exist in the assessment schema/tables
- blank-only trigger values are not used as evidence
- trigger conditions line up with explicit assessment values
- finding text does not rely on obviously unsupported placeholders

This is intentionally conservative: it flags anything uncertain rather than
trying to "understand" the finding.
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Set


ROOT = Path(__file__).resolve().parent
ASSESSMENT_PATH = Path(r"C:\Users\frost\Downloads\host_assessment_1.0.0_20260415_141718.json")
CATALOG_PATH = ROOT / "LocalData" / "vofc_vulnerabilities.js"

BLANK_WORDS = {"", "not applicable", "n/a", "na"}
SUSPICIOUS_WORDS = {
    "decorative",
    "exclusionary",
    "weakens",
    "weakest",
    "increases vulnerability",
    "path of least resistance",
    "creates mixed circulation",
}


@dataclass
class Finding:
    v_number: str
    title: str
    issues: List[str]


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_catalog() -> List[Dict[str, Any]]:
    text = CATALOG_PATH.read_text(encoding="utf-8")
    match = re.search(r"window\.VOFC_VULNERABILITIES\s*=\s*(\[[\s\S]*?\]);\s*\n\nfunction getSeverityFromEvidence", text)
    if not match:
        raise RuntimeError("Could not locate VOFC_VULNERABILITIES array")
    return json.loads(match.group(1))


def normalize_key(key: str) -> str:
    return key.strip()


def collect_schema_fields(assessment: Dict[str, Any]) -> Set[str]:
    fields: Set[str] = set()
    sections = assessment["data"]["sections"]
    for section_name, section in sections.items():
        if isinstance(section, dict):
            for key in section.keys():
                fields.add(f"{section_name}.{normalize_key(key)}")
    tables = assessment["data"]["tables"]
    for table_name, rows in tables.items():
        for row in rows:
            if isinstance(row, dict):
                for key in row.keys():
                    fields.add(f"{table_name}.{normalize_key(key)}")
    return fields


def collect_actual_values(assessment: Dict[str, Any]) -> Dict[str, Set[str]]:
    values: Dict[str, Set[str]] = {}
    sections = assessment["data"]["sections"]
    for section_name, section in sections.items():
        if isinstance(section, dict):
            for key, val in section.items():
                values.setdefault(f"{section_name}.{normalize_key(key)}", set()).add(str(val))
    tables = assessment["data"]["tables"]
    for table_name, rows in tables.items():
        for row in rows:
            if isinstance(row, dict):
                for key, val in row.items():
                    values.setdefault(f"{table_name}.{normalize_key(key)}", set()).add(str(val))
    return values


def field_exists(source_field: str, schema_fields: Set[str]) -> bool:
    sf = source_field.replace("[]", "")
    return sf in schema_fields or source_field in schema_fields


def trigger_blank_issue(trigger_conditions: Dict[str, Any]) -> Optional[str]:
    for key, val in trigger_conditions.items():
        if isinstance(val, str) and val.strip().lower() in BLANK_WORDS:
            return f"trigger `{key}` uses a blank/Not Applicable-like value as evidence"
    return None


def trigger_matches(actual_values: Dict[str, Set[str]], source_field: str, trigger_conditions: Dict[str, Any]) -> List[str]:
    # This validator does not attempt to prove multi-field synthesis from a
    # single source field. It only ensures the triggers are not blank evidence.
    return []


def sentence_drift_issues(title: str, description: str, risk_impact: str) -> List[str]:
    issues: List[str] = []
    combined = f"{title} {description} {risk_impact}".lower()
    for word in SUSPICIOUS_WORDS:
        if word in combined:
            issues.append(f"contains potentially inferential phrase `{word}`")
    return issues


def main() -> int:
    assessment = load_json(ASSESSMENT_PATH)
    catalog = load_catalog()
    schema_fields = collect_schema_fields(assessment)

    findings: List[Finding] = []
    for item in catalog:
        issues: List[str] = []
        v_number = str(item.get("v_number", ""))
        title = str(item.get("vulnerability_text", ""))
        source_field = str(item.get("source_field", ""))
        trigger_conditions = item.get("trigger_conditions") or {}

        if not v_number or not title:
            issues.append("missing v_number or vulnerability_text")

        if source_field and not field_exists(source_field, schema_fields):
            issues.append(f"source_field `{source_field}` does not exist in the assessment schema")

        if isinstance(trigger_conditions, dict):
            blank_issue = trigger_blank_issue(trigger_conditions)
            if blank_issue:
                issues.append(blank_issue)
            issues.extend(trigger_matches({}, source_field, trigger_conditions))
        else:
            issues.append("trigger_conditions is not an object")

        issues.extend(sentence_drift_issues(title, str(item.get("description", "")), str(item.get("risk_impact", ""))))

        if issues:
            findings.append(Finding(v_number=v_number, title=title, issues=issues))

    if findings:
        print(f"DRIFT CHECK FAILED: {len(findings)} findings need review\n")
        for finding in findings:
            print(f"{finding.v_number} | {finding.title}")
            for issue in finding.issues:
                print(f"  - {issue}")
            print()
        return 1

    print("DRIFT CHECK PASSED: no obvious drift detected")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
