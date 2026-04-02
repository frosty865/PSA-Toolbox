#!/usr/bin/env python3
"""
Run 2-pass module generation: PASS A (questions) then PASS B (OFCs per question).
Reads chunks from data/module_chunks/<module_code>.json, writes result to tools/outputs/module_two_pass_<module_code>.json.
Yield guard: if PASS A yields <8 questions, retry once then fail with report (no empty export).

Usage:
  python tools/modules/run_module_two_pass.py --module-code MODULE_EV_PARKING [--model llama3.2:1b] [--max-chunks 80]
  python tools/modules/run_module_two_pass.py --module-code MODULE_EV_PARKING --report-dir tools/outputs
"""

import argparse
import json
import os
import sys
from pathlib import Path

_script_dir = Path(__file__).resolve().parent
_project_root = _script_dir.parents[1]
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

for env_file in (_project_root / ".env.local", _project_root / ".local.env"):
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    os.environ[k.strip()] = v.strip().strip('"').strip("'")
        break

from services.processor.pipeline.module_generate_two_pass import (
    generate_module_two_pass,
    load_chunks_from_json,
)


def main() -> int:
    ap = argparse.ArgumentParser(description="Run 2-pass module generation (PASS A questions, PASS B OFCs)")
    ap.add_argument("--module-code", required=True, help="Module code (e.g. MODULE_EV_PARKING)")
    ap.add_argument("--model", default="llama3.2:1b", help="Ollama model")
    ap.add_argument("--max-chunks", type=int, default=80, help="Max chunks to send to PASS A")
    ap.add_argument("--report-dir", default=None, help="Directory for module_generation_report.json (default: tools/outputs)")
    ap.add_argument("--skip-pass-b", action="store_true", help="Only run PASS A (questions)")
    args = ap.parse_args()

    module_code = (args.module_code or "").strip()
    if not module_code:
        print("--module-code is required", file=sys.stderr)
        return 1

    chunks_path = _project_root / "data" / "module_chunks" / f"{module_code}.json"
    if not chunks_path.exists():
        print(
            f"Chunks file not found: {chunks_path}. Run: python tools/modules/extract_module_pdfs_to_chunks.py {module_code}",
            file=sys.stderr,
        )
        return 1

    chunks = load_chunks_from_json(module_code, chunks_path, args.max_chunks)
    if not chunks:
        print("No chunks loaded. Check data/module_chunks file.", file=sys.stderr)
        return 1

    report_dir = Path(args.report_dir or _project_root / "tools" / "outputs")
    report_dir.mkdir(parents=True, exist_ok=True)

    module_title = module_code.replace("MODULE_", "").replace("_", " ").title()
    result = generate_module_two_pass(
        model=args.model,
        module_code=module_code,
        module_title=module_title,
        chunks=chunks,
        max_chunks=args.max_chunks,
        run_pass_b_per_question=not args.skip_pass_b,
        report_dir=report_dir,
    )

    out_path = report_dir / f"module_two_pass_{module_code}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Wrote {out_path}")
    print(f"Export status: {result.get('export_status', 'UNKNOWN')}")
    print(f"Questions: {len(result.get('questions') or [])}")
    if result.get("export_status") != "OK":
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
