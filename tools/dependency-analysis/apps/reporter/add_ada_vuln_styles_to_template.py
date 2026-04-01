#!/usr/bin/env python3
"""
One-off: add required ADA_Vuln_* paragraph styles to the report template if missing.
Creates PARAGRAPH styles only; forces style name and styleId to match (no whitespace/case drift).
Run from repo root: python apps/reporter/add_ada_vuln_styles_to_template.py
Or: python apps/reporter/add_ada_vuln_styles_to_template.py "path/to/template.docx"
Saves the template in place. Idempotent.
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from docx import Document
    from docx.enum.style import WD_STYLE_TYPE
    from docx.oxml.ns import qn
    from docx.shared import Inches, Pt
except ImportError:
    print("Install python-docx: pip install python-docx", file=sys.stderr)
    sys.exit(2)

FRANKLIN_FONT_DEMI = "Franklin Gothic Demi"
FRANKLIN_FONT_MEDIUM = "Franklin Gothic Medium"
FRANKLIN_FONT_BOOK = "Franklin Gothic Book"

REQUIRED_ADA_STYLES = [
    "ADA_Vuln_Header",
    "ADA_Vuln_Severity",
    "ADA_Vuln_Meta",
    "ADA_Vuln_Label",
    "ADA_Vuln_Body",
    "ADA_Vuln_Bullets",
    "ADA_Vuln_Numbered",
]


def _norm(x: str | None) -> str:
    return (x or "").strip()


def _find_paragraph_style_by_name_or_id(doc: Document, target: str):
    """Return style if a PARAGRAPH style exists with name or style_id matching target (normalized)."""
    target = _norm(target)
    for s in doc.styles:
        if getattr(s, "type", None) != WD_STYLE_TYPE.PARAGRAPH:
            continue
        if _norm(getattr(s, "name", "")) == target:
            return s
        if _norm(getattr(s, "style_id", "")) == target:
            return s
    return None


def _force_style_name_and_id(style, target: str) -> None:
    """Set style name and w:styleId to target (exact match for QC)."""
    target = _norm(target)
    style.name = target
    try:
        style._element.set(qn("w:styleId"), target)
    except Exception:
        pass


def ensure_ada_vuln_styles(doc: Document) -> list[str]:
    """Add any missing ADA_Vuln_* paragraph styles; force name and styleId. Returns list of names added."""
    added = []
    # Build style definitions: (name, font_name, size_pt, bold, all_caps, space_before, space_after, line_spacing, extra_paragraph_format)
    defs = [
        ("ADA_Vuln_Header", FRANKLIN_FONT_DEMI, 13, True, True, 12, 2, 1.0, None),
        ("ADA_Vuln_Severity", FRANKLIN_FONT_MEDIUM, 11, True, True, 0, 6, None, None),
        ("ADA_Vuln_Meta", FRANKLIN_FONT_BOOK, 10.5, False, False, None, 6, 1.15, None),
        ("ADA_Vuln_Label", FRANKLIN_FONT_MEDIUM, 10.5, True, False, 6, 2, 1.0, None),
        ("ADA_Vuln_Body", FRANKLIN_FONT_BOOK, 10.5, False, False, None, 6, 1.15, None),
        ("ADA_Vuln_Bullets", FRANKLIN_FONT_BOOK, 10.5, False, False, None, 3, 1.15, "bullets"),
        ("ADA_Vuln_Numbered", FRANKLIN_FONT_BOOK, 10.5, False, False, None, 3, 1.15, "numbered"),
    ]
    for name, font_name, size_pt, bold, all_caps, space_before, space_after, line_spacing, kind in defs:
        target = _norm(name)
        found = _find_paragraph_style_by_name_or_id(doc, target)
        if found is not None:
            _force_style_name_and_id(found, target)
            pf = found.paragraph_format
            pf.keep_with_next = True
            continue
        base = _find_paragraph_style_by_name_or_id(doc, "ADA_Vuln_Body") or _find_paragraph_style_by_name_or_id(doc, "Normal")
        try:
            base_ref = doc.styles["Normal"] if base is None else base
        except KeyError:
            base_ref = None
        new_style = doc.styles.add_style(target, WD_STYLE_TYPE.PARAGRAPH)
        if base_ref is not None:
            try:
                new_style.base_style = base_ref
            except Exception:
                pass
        new_style.font.name = font_name
        new_style.font.size = Pt(size_pt)
        new_style.font.bold = bold
        new_style.font.all_caps = all_caps
        pf = new_style.paragraph_format
        pf.keep_with_next = True
        if space_before is not None:
            pf.space_before = Pt(space_before)
        if space_after is not None:
            pf.space_after = Pt(space_after)
        if line_spacing is not None:
            pf.line_spacing = line_spacing
        if kind == "bullets":
            pf.left_indent = Inches(0.25)
            pf.first_line_indent = Inches(-0.15)
        elif kind == "numbered":
            pf.left_indent = Inches(0.25)
            pf.first_line_indent = Inches(-0.15)
        _force_style_name_and_id(new_style, target)
        added.append(target)
    return added


# Cover-page strings that must not appear as consecutive duplicates in the first ~15 paragraphs.
_COVER_DUPLICATE_TEXTS = (
    "Asset Dependency Assessment",
    "UNCLASSIFIED//FOR OFFICIAL USE ONLY",
)
_COVER_LOOKAHEAD = 15


def _paragraph_text(p) -> str:
    """Return plain text of a paragraph element."""
    if p is None or p.tag != qn("w:p"):
        return ""
    return "".join(n.text or "" for n in p.iter() if getattr(n, "text", None)).strip()


def normalize_cover_page(doc: Document) -> int:
    """
    In the first ~15 body paragraphs, remove consecutive duplicate paragraphs whose text
    exactly matches 'Asset Dependency Assessment' or 'UNCLASSIFIED//FOR OFFICIAL USE ONLY'.
    Also remove a duplicate empty paragraph immediately before such a duplicate to avoid double spacing.
    Returns the number of paragraphs removed.
    """
    body = doc.element.body
    if body is None:
        return 0
    children = list(body)
    # Collect (index, element, text) for first paragraph elements only (up to _COVER_LOOKAHEAD).
    para_info: list[tuple[int, object, str]] = []
    for i, el in enumerate(children):
        if len(para_info) >= _COVER_LOOKAHEAD:
            break
        if el.tag == qn("w:p"):
            para_info.append((i, el, _paragraph_text(el)))
    if len(para_info) < 2:
        return 0
    to_remove: set[int] = set()
    for k in range(1, len(para_info)):
        idx, _, text = para_info[k]
        prev_idx, _, prev_text = para_info[k - 1]
        if text not in _COVER_DUPLICATE_TEXTS:
            continue
        if text != prev_text:
            continue
        to_remove.add(idx)
        # Remove preceding empty paragraph if present to avoid double spacing.
        if prev_text == "":
            to_remove.add(prev_idx)
    for idx in sorted(to_remove, reverse=True):
        body.remove(children[idx])
    return len(to_remove)


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent.parent
    template_path = Path(sys.argv[1]) if len(sys.argv) > 1 else repo_root / "ADA" / "report template.docx"
    if not template_path.is_file():
        print(f"Template not found: {template_path}", file=sys.stderr)
        return 1
    doc = Document(str(template_path))
    added = ensure_ada_vuln_styles(doc)
    removed = normalize_cover_page(doc)
    doc.save(str(template_path))
    if added:
        print(f"Added styles to {template_path}: {added}")
    else:
        print(f"All required styles already present (name/styleId normalized) in {template_path}")
    if removed:
        print(f"Removed {removed} duplicate cover-page paragraph(s) from {template_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
