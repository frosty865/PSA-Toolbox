#!/usr/bin/env python3
"""
Debug: Map all page breaks in the template and trace what the reporter does.
Run from repo root: python scripts/debug_template_pagebreaks.py
"""
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = REPO_ROOT / "assets" / "templates" / "Asset Dependency Assessment Report_BLANK.v2backup.docx"

def main():
    from docx import Document
    from docx.oxml.ns import qn

    if not TEMPLATE.exists():
        print(f"Template not found: {TEMPLATE}")
        return 1

    print(f"Template: {TEMPLATE}")
    print(f"Exists: {TEMPLATE.exists()}")
    print()

    doc = Document(str(TEMPLATE))
    body = doc.element.body
    children = list(body)

    def get_text(elem):
        return "".join(t.text or "" for t in elem.iter() if t.tag == qn("w:t")).strip()

    def has_page_break(elem):
        return any(
            el.tag == qn("w:br") and el.get(qn("w:type")) == "page"
            for el in elem.iter()
        )

    print("=== TEMPLATE BODY STRUCTURE ===")
    print("Index | Type | PageBreak | Text (first 60 chars)")
    print("-" * 80)
    for i, c in enumerate(children):
        tag = "p" if c.tag == qn("w:p") else ("tbl" if c.tag == qn("w:tbl") else "other")
        br = has_page_break(c) if c.tag == qn("w:p") else False
        t = get_text(c)[:60] if c.tag == qn("w:p") else ""
        marker = " *** PAGE BREAK ***" if br else ""
        print(f"{i:3}   {tag:4}   {str(br):5}   {repr(t)}{marker}")

    print()
    print("=== PAGE BREAK SUMMARY ===")
    breaks = [(i, get_text(c)) for i, c in enumerate(children) if c.tag == qn("w:p") and has_page_break(c)]
    for i, t in breaks:
        print(f"  Index {i}: {repr(t[:50]) if t else '(empty)'}")

    print()
    print("=== ENV CHECK (what reporter would use) ===")
    print(f"  TEMPLATE_PATH env: {os.environ.get('TEMPLATE_PATH', '(not set)')}")
    blank = REPO_ROOT / "assets" / "templates" / "Asset Dependency Assessment Report_BLANK.docx"
    print(f"  BLANK.docx exists: {blank.exists()}")
    print(f"  v2backup.docx exists: {TEMPLATE.exists()}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
