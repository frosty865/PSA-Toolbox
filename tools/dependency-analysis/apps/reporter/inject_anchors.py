#!/usr/bin/env python3
"""
Produce _dev_with_anchors.docx as a copy of BLANK.
BLANK must have all required anchors in-body (no appended block).
Run inject_anchors_into_body.py first to add anchors to BLANK if needed.
"""
import shutil
import sys
from pathlib import Path

DEV_OUTPUT_NAME = "_dev_with_anchors.docx"


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent.parent
    ada_dir = repo_root / "ADA"
    real_template = ada_dir / "report template.docx"

    if len(sys.argv) > 1:
        input_path = Path(sys.argv[1]).resolve()
    else:
        input_path = real_template

    if not input_path.is_file():
        print(f"Input template not found: {input_path}", file=sys.stderr)
        return 1

    if input_path == real_template:
        output_path = ada_dir / DEV_OUTPUT_NAME
    else:
        output_path = input_path.parent / f"_dev_with_anchors_{input_path.name}"

    if output_path.resolve() == real_template.resolve():
        print("Refusing to overwrite real template.", file=sys.stderr)
        return 1

    shutil.copy2(input_path, output_path)
    print(f"Wrote: {output_path} (copy of {input_path.name})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
