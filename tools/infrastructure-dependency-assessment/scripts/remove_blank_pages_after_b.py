#!/usr/bin/env python3
"""
Remove hard-coded blank pages after Section B (DEPENDENCY SNAPSHOT TABLE).
Targets the v2backup template used by the web app.

Run from repo root: python scripts/remove_blank_pages_after_b.py
Modifies the template in place. Creates backup first.
"""
from pathlib import Path

try:
    from docx import Document
    from docx.oxml.ns import qn
except ImportError:
    print("Install python-docx: pip install python-docx", file=__import__("sys").stderr)
    raise SystemExit(2)

REPO_ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_PATH = REPO_ROOT / "assets" / "templates" / "Asset Dependency Assessment Report_BLANK.v2backup.docx"


def get_paragraph_text(p_elem):
    parts = []
    for el in p_elem.iter():
        if el.tag == qn("w:t") and el.text:
            parts.append(el.text)
    return "".join(parts).strip()


def has_page_break(p_elem):
    for c in p_elem.iter():
        if c.tag == qn("w:br") and c.get(qn("w:type")) == "page":
            return True
    return False


def is_empty(p_elem):
    return not get_paragraph_text(p_elem).strip()


def main():
    if not TEMPLATE_PATH.is_file():
        print(f"Template not found: {TEMPLATE_PATH}", flush=True)
        raise SystemExit(1)

    import shutil
    backup = TEMPLATE_PATH.parent / (TEMPLATE_PATH.stem + ".bak_blank_pages.docx")
    if backup.exists():
        backup.unlink()
    shutil.copy2(TEMPLATE_PATH, backup)
    print(f"Backup: {backup}", flush=True)

    doc = Document(str(TEMPLATE_PATH))
    body = doc.element.body
    children = list(body)

    # Find index of paragraph containing SNAPSHOT_CASCADE
    cascade_idx = None
    for i, child in enumerate(children):
        if child.tag != qn("w:p"):
            continue
        if "[[SNAPSHOT_CASCADE]]" in get_paragraph_text(child):
            cascade_idx = i
            break

    if cascade_idx is None:
        print("[[SNAPSHOT_CASCADE]] not found; nothing to remove.", flush=True)
        return 0

    to_remove = []
    stop_markers = ("C. SECTOR", "D. CROSS", "E. PRIORITY", "PART II", "[[")
    for i in range(cascade_idx + 1, min(cascade_idx + 6, len(children))):
        child = children[i]
        if child.tag != qn("w:p"):
            break
        text = get_paragraph_text(child)
        if any(m in text.upper() for m in stop_markers):
            break
        if has_page_break(child) or is_empty(child):
            to_remove.append(child)
        else:
            break

    for el in to_remove:
        body.remove(el)

    doc.save(str(TEMPLATE_PATH))
    print(f"Removed {len(to_remove)} blank page paragraph(s) after Section B", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
