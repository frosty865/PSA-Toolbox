#!/usr/bin/env python3
"""
Extract PDF outline (TOC) via PyMuPDF. Outputs JSON for plan schema derivation.
Usage: python extract_pdf_toc.py <abs_path_to.pdf>
Stdout: ONLY the JSON payload. Stderr: logs/debug only.
"""

import json
import sys
from pathlib import Path


def _write_out(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.stdout.flush()


def main() -> None:
    if len(sys.argv) < 2:
        _write_out({"error": "Missing pdf_path", "toc": []})
        sys.exit(1)
    pdf_path = Path(sys.argv[1]).resolve()
    if not pdf_path.exists():
        _write_out({"error": f"File not found: {pdf_path}", "toc": []})
        sys.exit(1)
    if pdf_path.suffix.lower() != ".pdf":
        _write_out({"error": "Not a PDF file", "toc": []})
        sys.exit(1)

    try:
        import fitz  # PyMuPDF
    except ImportError:
        print("PyMuPDF (fitz) not installed. pip install pymupdf", file=sys.stderr)
        _write_out({"error": "PyMuPDF (fitz) not installed. pip install pymupdf", "toc": []})
        sys.exit(1)

    try:
        doc = fitz.open(str(pdf_path))
        toc = doc.get_toc(simple=False)
        doc.close()
    except Exception as e:
        print(str(e), file=sys.stderr)
        _write_out({"error": str(e), "toc": []})
        sys.exit(1)

    # get_toc(simple=False) returns list of [level, title, page, ...]; level 1-based
    out = []
    for item in toc or []:
        level = int(item[0]) if len(item) > 0 else 1
        title = (item[1] or "").strip() if len(item) > 1 else ""
        page = int(item[2]) if len(item) > 2 and item[2] is not None else 0
        page = max(1, page)
        out.append({"level": level, "title": title, "page": page})
    _write_out({"toc": out})


if __name__ == "__main__":
    main()
