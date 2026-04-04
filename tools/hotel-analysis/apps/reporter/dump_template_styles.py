"""Dump template style names, styleIds, and types (python-docx view). Run from repo root."""
from pathlib import Path

from docx import Document
from docx.enum.style import WD_STYLE_TYPE


def main():
    repo_root = Path(__file__).resolve().parent.parent.parent
    template_path = repo_root / "ADA" / "report template.docx"
    if not template_path.is_file():
        template_path = repo_root / Path(r"ADA/report template.docx")
    doc = Document(str(template_path))
    rows = []
    for s in doc.styles:
        stype = getattr(s, "type", None)
        stype_name = {
            WD_STYLE_TYPE.PARAGRAPH: "PARAGRAPH",
            WD_STYLE_TYPE.CHARACTER: "CHARACTER",
            WD_STYLE_TYPE.TABLE: "TABLE",
            WD_STYLE_TYPE.LIST: "LIST",
        }.get(stype, str(stype))
        rows.append((getattr(s, "name", None), getattr(s, "style_id", None), stype_name))
    rows.sort(key=lambda x: (x[2], (x[0] or "").lower()))
    print(f"Template: {template_path}")
    for name, sid, typ in rows:
        print(f"{typ:10}  name={name!r}  style_id={sid!r}")

if __name__ == "__main__":
    main()
