#!/usr/bin/env python3
"""
Remove page-break paragraphs from the template to eliminate blank pages.
Modifies the template in place. Creates backup first.

KEEPS index 4 (before main content) - may be needed for cover/title layout.
REMOVES: 21, 26, 31, 36, 41 (between B and D), 53 (between Annex and Sector Reports).

Run from repo root: python scripts/strip_template_pagebreaks.py
"""
from pathlib import Path

try:
    from docx import Document
    from docx.oxml.ns import qn
except ImportError:
    print("Install python-docx: pip install python-docx", file=__import__("sys").stderr)
    raise SystemExit(2)

REPO_ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = REPO_ROOT / "assets" / "templates" / "Asset Dependency Assessment Report_BLANK.v2backup.docx"


def has_page_break(elem):
    for el in elem.iter():
        if el.tag == qn("w:br") and el.get(qn("w:type")) == "page":
            return True
    return False


def main():
    if not TEMPLATE.exists():
        print(f"Template not found: {TEMPLATE}")
        return 1

    import shutil
    backup = TEMPLATE.parent / (TEMPLATE.stem + ".before_strip_pagebreaks.docx")
    shutil.copy2(TEMPLATE, backup)
    print(f"Backup: {backup}")

    doc = Document(str(TEMPLATE))
    body = doc.element.body
    children = list(body)

    def get_text(elem):
        return "".join(t.text or "" for t in elem.iter() if t.tag == qn("w:t")).strip()

    to_remove = []
    seen_first_content = False
    for i, child in enumerate(children):
        if child.tag != qn("w:p"):
            continue
        if not has_page_break(child):
            continue
        text = get_text(child)
        # Keep first page break (before "Asset Dependency Risk Analysis") - cover layout
        if not seen_first_content:
            next_idx = i + 1
            if next_idx < len(children) and children[next_idx].tag == qn("w:p"):
                next_text = get_text(children[next_idx])
                if "Asset Dependency" in next_text or "Risk Analysis" in next_text:
                    seen_first_content = True
                    continue  # Keep this one
        to_remove.append(child)

    for el in to_remove:
        body.remove(el)

    doc.save(str(TEMPLATE))
    print(f"Removed {len(to_remove)} page-break paragraph(s) from template")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
