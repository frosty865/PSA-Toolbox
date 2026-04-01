#!/usr/bin/env python3
"""
Template hygiene: Remove static sector headings, C. SECTOR ANALYSIS, and collapse
consecutive page breaks. Sector rendering occurs dynamically in Part II.

Run from repo root: python scripts/remove_static_sector_headings.py
Modifies the template in place. Creates backup first.
"""
from pathlib import Path

try:
    from docx import Document
    from docx.oxml.ns import qn
except ImportError:
    print("Install python-docx: pip install python-docx", __import__("sys").stderr)
    raise SystemExit(2)

SECTOR_LABELS = frozenset({
    "ELECTRIC POWER",
    "COMMUNICATIONS",
    "INFORMATION TECHNOLOGY",
    "WATER",
    "WASTEWATER",
})

REPO_ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_PATH = REPO_ROOT / "assets" / "templates" / "Asset Dependency Assessment Report_BLANK.docx"


def iter_body_paragraphs(doc):
    """Yield paragraphs in document body (excludes headers/footers)."""
    body = doc.element.body
    for child in body:
        if child.tag == qn("w:p"):
            yield child


def get_paragraph_text(p_elem):
    """Extract text from a w:p element."""
    parts = []
    for el in p_elem.iter():
        if el.tag == qn("w:t") and el.text:
            parts.append(el.text)
    return "".join(parts).strip()


def main():
    if not TEMPLATE_PATH.is_file():
        print(f"Template not found: {TEMPLATE_PATH}", flush=True)
        raise SystemExit(1)

    # Backup
    backup = TEMPLATE_PATH.with_suffix(".docx.backup_sector_cleanup")
    if backup.exists():
        backup.unlink()
    import shutil
    shutil.copy2(TEMPLATE_PATH, backup)
    print(f"Backup: {backup}", flush=True)

    doc = Document(str(TEMPLATE_PATH))
    body = doc.element.body
    to_remove = []
    in_part1 = False

    for p_elem in iter_body_paragraphs(doc):
        text = get_paragraph_text(p_elem)
        if "DEPENDENCY SNAPSHOT" in text.upper() or "SNAPSHOT TABLE" in text.upper():
            in_part1 = True
        if "PART II" in text.upper():
            break
        if in_part1 and text.upper() in SECTOR_LABELS:
            to_remove.append(p_elem)

    for p_elem in to_remove:
        parent = p_elem.getparent()
        if parent is not None:
            parent.remove(p_elem)

    # Remove "C. SECTOR ANALYSIS" heading entirely (phantom section)
    sector_analysis_removed = 0
    for p_elem in list(iter_body_paragraphs(doc)):
        text = get_paragraph_text(p_elem)
        if "C. SECTOR ANALYSIS" in text.upper() or "C. Sector Analysis" in text:
            parent = p_elem.getparent()
            if parent is not None:
                parent.remove(p_elem)
                sector_analysis_removed += 1

    # Collapse consecutive page breaks (template hygiene)
    from docx.oxml.ns import qn
    body = doc.element.body
    children = list(body)
    collapsed = 0
    i = 1
    while i < len(children):
        if children[i - 1].tag != qn("w:p") or children[i].tag != qn("w:p"):
            i += 1
            continue
        prev_has = any(
            c.tag == qn("w:br") and c.get(qn("w:type")) == "page"
            for c in children[i - 1].iter()
        )
        cur_has = any(
            c.tag == qn("w:br") and c.get(qn("w:type")) == "page"
            for c in children[i].iter()
        )
        if prev_has and cur_has:
            body.remove(children[i])
            children = list(body)
            collapsed += 1
            continue
        i += 1

    doc.save(str(TEMPLATE_PATH))
    print(f"Removed {len(to_remove)} static sector headings from {TEMPLATE_PATH}", flush=True)
    if sector_analysis_removed:
        print(f"Removed {sector_analysis_removed} C. SECTOR ANALYSIS heading(s)", flush=True)
    if collapsed:
        print(f"Collapsed {collapsed} consecutive page break(s)", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
