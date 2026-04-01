#!/usr/bin/env python3
"""
Minimal standalone reporter smoke test.
Builds a minimal assessment JSON, sets WORK_DIR to a temp folder, calls main report
generation directly (no Node). Asserts output.docx is created and has size > 0.
Run: python apps/reporter/dev_smoke.py
"""
import io
import json
import os
import sys
from pathlib import Path

# Ensure we can import main from this package
REPORTER_DIR = Path(__file__).resolve().parent
if str(REPORTER_DIR) not in sys.path:
    sys.path.insert(0, str(REPORTER_DIR))

# Minimal assessment: asset name, one category (ELECTRIC_POWER), empty VOFC
MINIMAL_ASSESSMENT = {
    "asset": {
        "asset_name": "Dev Smoke Asset",
        "visit_date_iso": "",
        "assessor": "",
        "location": "",
        "psa_cell": "555-000-0000",
    },
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
    },
}
MINIMAL_PAYLOAD = {
    "assessment": MINIMAL_ASSESSMENT,
    "vofc_collection": {
        "items": [
            {
                "category": "ELECTRIC_POWER",
                "vulnerability": "Reliance on single utility feed",
                "option_for_consideration": "Consider secondary feed where feasible.",
            },
        ],
    },
}

# Temp folder under data/temp/reporter-smoke (repo-relative)
REPO_ROOT = REPORTER_DIR.parent.parent
WORK_DIR = REPO_ROOT / "data" / "temp" / "reporter-smoke"


def main() -> None:
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    work_dir_str = str(WORK_DIR)

    # Set env so main() uses our work dir and canonical template (ADA/report template.docx)
    canonical_template = REPO_ROOT / "ADA" / "report template.docx"
    if not canonical_template.is_file():
        print("FAIL: ADA/report template.docx not found; create it for export.", file=sys.stderr)
        sys.exit(1)
    old_work = os.environ.get("WORK_DIR")
    old_template = os.environ.get("TEMPLATE_PATH")
    os.environ["WORK_DIR"] = work_dir_str
    os.environ["TEMPLATE_PATH"] = str(canonical_template)

    # Stdin-equivalent: JSON payload
    stdin_content = json.dumps(MINIMAL_PAYLOAD)
    old_stdin = sys.stdin
    sys.stdin = io.StringIO(stdin_content)

    try:
        from main import main as reporter_main
        reporter_main()
    finally:
        sys.stdin = old_stdin
        if old_work is not None:
            os.environ["WORK_DIR"] = old_work
        else:
            os.environ.pop("WORK_DIR", None)
        if old_template is not None:
            os.environ["TEMPLATE_PATH"] = old_template
        else:
            os.environ.pop("TEMPLATE_PATH", None)

    output_docx = WORK_DIR / "output.docx"
    if not output_docx.is_file():
        print("FAIL: output.docx was not created", file=sys.stderr)
        sys.exit(1)
    if output_docx.stat().st_size <= 0:
        print("FAIL: output.docx has size 0", file=sys.stderr)
        sys.exit(1)
    print("OK: output.docx created, size =", output_docx.stat().st_size)

    # D2: Run verify_output.py on generated DOCX; exit nonzero on any violation
    verify_script = REPORTER_DIR / "verify_output.py"
    if verify_script.is_file():
        import subprocess
        result = subprocess.run(
            [sys.executable, str(verify_script), str(output_docx)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print("FAIL: verify_output.py reported violations:", file=sys.stderr)
            sys.stderr.write(result.stderr or "")
            sys.exit(1)
        print("OK: verify_output.py passed")


if __name__ == "__main__":
    main()
