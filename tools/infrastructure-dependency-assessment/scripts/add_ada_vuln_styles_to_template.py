#!/usr/bin/env python3
"""
Part A: Add Franklin-based ADA_* styles to the report template and remove legacy [[VULN_NARRATIVE]].
Run once (or when template is reset). Reporter will apply these styles when injecting vulnerability blocks.
Usage: python scripts/add_ada_vuln_styles_to_template.py [path/to/report template.docx]
Default path: ADA/report template.docx (relative to repo root = parent of scripts/).
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from docx import Document
    from docx.enum.style import WD_STYLE_TYPE
    from docx.shared import Inches, Pt
except ImportError:
    print("ERROR: python-docx required", file=sys.stderr)
    sys.exit(2)

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TEMPLATE = REPO_ROOT / "ADA" / "report template.docx"

# Franklin fallback list (primary in styles; Word may substitute at render)
FRANKLIN_FONT = "Franklin Gothic"
FRANKLIN_DEMI = "Franklin Gothic Demi"
FRANKLIN_MEDIUM = "Franklin Gothic Medium"
FRANKLIN_BOOK = "Franklin Gothic Book"
FONT_FALLBACK_LIST = [
    "ITC Franklin Gothic",
    "Franklin Gothic",
    "Franklin Gothic Book",
    "Franklin Gothic Medium",
    "Franklin Gothic Demi",
    "Arial",
]


def _get_style(doc: Document, name: str):
    try:
        return doc.styles[name]
    except KeyError:
        return None


def add_ada_vuln_styles(doc: Document) -> None:
    """Ensure all ADA_Vuln_* styles exist with Franklin typography. Idempotent: skips if already present."""
    from docx.enum.style import WD_STYLE_TYPE

    styles = doc.styles

    # ADA_Vuln_Header: Franklin Gothic Demi, 13 pt, Bold, All Caps, space before 12, after 2, keep with next
    if _get_style(doc, "ADA_Vuln_Header") is None:
        s = styles.add_style("ADA_Vuln_Header", WD_STYLE_TYPE.PARAGRAPH)
        s.font.name = FRANKLIN_DEMI
        s.font.size = Pt(13)
        s.font.bold = True
        s.font.all_caps = True
        pf = s.paragraph_format
        pf.space_before = Pt(12)
        pf.space_after = Pt(2)
        pf.line_spacing = 1.0
        pf.keep_with_next = True

    # ADA_Vuln_Severity: Franklin Gothic Medium, 11 pt, Bold, All Caps, after 6, keep with next
    if _get_style(doc, "ADA_Vuln_Severity") is None:
        s = styles.add_style("ADA_Vuln_Severity", WD_STYLE_TYPE.PARAGRAPH)
        s.font.name = FRANKLIN_MEDIUM
        s.font.size = Pt(11)
        s.font.bold = True
        s.font.all_caps = True
        pf = s.paragraph_format
        pf.space_before = Pt(0)
        pf.space_after = Pt(6)
        pf.keep_with_next = True

    # ADA_Vuln_Meta: Franklin Gothic Book, 10.5 pt, no bold (bold via runs), after 6, line 1.15, keep with next
    if _get_style(doc, "ADA_Vuln_Meta") is None:
        s = styles.add_style("ADA_Vuln_Meta", WD_STYLE_TYPE.PARAGRAPH)
        s.font.name = FRANKLIN_BOOK
        s.font.size = Pt(10.5)
        s.font.bold = False
        pf = s.paragraph_format
        pf.space_after = Pt(6)
        pf.line_spacing = 1.15
        pf.keep_with_next = True

    # ADA_Vuln_Label: Franklin Gothic Medium, 10.5 pt, Bold, before 6, after 2
    if _get_style(doc, "ADA_Vuln_Label") is None:
        s = styles.add_style("ADA_Vuln_Label", WD_STYLE_TYPE.PARAGRAPH)
        s.font.name = FRANKLIN_MEDIUM
        s.font.size = Pt(10.5)
        s.font.bold = True
        pf = s.paragraph_format
        pf.space_before = Pt(6)
        pf.space_after = Pt(2)
        pf.line_spacing = 1.0

    # ADA_Vuln_Body: Franklin Gothic Book, 10.5 pt, after 6, line 1.15
    if _get_style(doc, "ADA_Vuln_Body") is None:
        s = styles.add_style("ADA_Vuln_Body", WD_STYLE_TYPE.PARAGRAPH)
        s.font.name = FRANKLIN_BOOK
        s.font.size = Pt(10.5)
        s.font.bold = False
        pf = s.paragraph_format
        pf.space_after = Pt(6)
        pf.line_spacing = 1.15

    # ADA_Vuln_Bullets: Franklin Gothic Book, 10.5 pt, left indent 0.25", hanging 0.15", after 3, line 1.15
    if _get_style(doc, "ADA_Vuln_Bullets") is None:
        s = styles.add_style("ADA_Vuln_Bullets", WD_STYLE_TYPE.PARAGRAPH)
        s.font.name = FRANKLIN_BOOK
        s.font.size = Pt(10.5)
        pf = s.paragraph_format
        pf.left_indent = Inches(0.25)
        pf.first_line_indent = Inches(-0.15)
        pf.space_after = Pt(3)
        pf.line_spacing = 1.15

    # ADA_Vuln_Numbered: same as bullets but for numbered lines (content has "1. " etc.)
    if _get_style(doc, "ADA_Vuln_Numbered") is None:
        s = styles.add_style("ADA_Vuln_Numbered", WD_STYLE_TYPE.PARAGRAPH)
        s.font.name = FRANKLIN_BOOK
        s.font.size = Pt(10.5)
        pf = s.paragraph_format
        pf.left_indent = Inches(0.25)
        pf.first_line_indent = Inches(-0.15)
        pf.space_after = Pt(3)
        pf.line_spacing = 1.15


def remove_vuln_narrative_anchor(doc: Document) -> int:
    """Remove any paragraph that contains exactly [[VULN_NARRATIVE]]. Returns number removed."""
    from docx.oxml.ns import qn

    removed = 0
    body = doc.element.body
    for child in list(body):
        if child.tag != qn("w:p"):
            continue
        # get paragraph text
        parts = []
        for el in child.iter():
            if el.tag == qn("w:t") and el.text:
                parts.append(el.text)
        text = "".join(parts).strip()
        if text == "[[VULN_NARRATIVE]]":
            body.remove(child)
            removed += 1
    return removed


def remove_impact_curves_section(doc: Document) -> int:
    """Remove MODELED DISRUPTION CURVES section: paragraphs containing that header or [[IMPACT_CURVES_SECTION]]. Returns number removed."""
    from docx.oxml.ns import qn

    removed = 0
    body = doc.element.body
    for child in list(body):
        if child.tag != qn("w:p"):
            continue
        parts = []
        for el in child.iter():
            if el.tag == qn("w:t") and el.text:
                parts.append(el.text)
        text = "".join(parts).strip()
        if "[[IMPACT_CURVES_SECTION]]" in text or "MODELED DISRUPTION CURVES" in text.upper():
            body.remove(child)
            removed += 1
    return removed


def main() -> int:
    template_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_TEMPLATE
    if not template_path.exists():
        print(f"Template not found: {template_path}", file=sys.stderr)
        return 1
    doc = Document(str(template_path))
    add_ada_vuln_styles(doc)
    n = remove_vuln_narrative_anchor(doc)
    m = remove_impact_curves_section(doc)
    doc.save(str(template_path))
    print(f"Updated {template_path}: added ADA_Vuln_* styles, removed {n} [[VULN_NARRATIVE]] anchor(s), removed {m} MODELED DISRUPTION CURVES / [[IMPACT_CURVES_SECTION]] paragraph(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
