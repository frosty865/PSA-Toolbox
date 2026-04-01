#!/usr/bin/env python3
"""
Snapshot Model v3: Inject required anchors into BLANK template body.
Run: python inject_anchors_into_body.py [path_to_BLANK.docx]
Modifies the file in place. Creates backup as *.backup.docx first.

Anchors follow the new Snapshot-first structure:
- [[SNAPSHOT_POSTURE]] – Overall posture classification and summary
- [[SNAPSHOT_DRIVERS]] – Key risk drivers list
- [[SNAPSHOT_MATRIX]] – Infrastructure exposure matrix
- [[SNAPSHOT_CASCADE]] – Cascading risk indicator (conditional)
- [[EXEC_SUMMARY]] – Executive summary narrative (max 2 paragraphs)
- [[INFRA_ENERGY]] – Energy infrastructure analysis section
- [[INFRA_COMMS]] – Communications infrastructure analysis section
- [[INFRA_IT]] – Information Technology infrastructure analysis section
- [[INFRA_WATER]] – Water infrastructure analysis section
- [[INFRA_WASTEWATER]] – Wastewater infrastructure analysis section
- [[SYNTHESIS]] – Cross-infrastructure synthesis section
- [[APPENDIX_INDEX]] – Vulnerability index table (Appendix A)

Also removes legacy SAFE-era paragraph markers and outdated headers.
"""
import sys
from pathlib import Path

try:
    from docx import Document
    from docx.oxml.ns import qn
except ImportError:
    print("Install python-docx: pip install python-docx", file=sys.stderr)
    sys.exit(2)

REQUIRED_ANCHORS = [
    "[[SNAPSHOT_POSTURE]]",
    "[[SNAPSHOT_DRIVERS]]",
    "[[SNAPSHOT_MATRIX]]",
    "[[SNAPSHOT_CASCADE]]",
    "[[EXEC_SUMMARY]]",
    "[[INFRA_ENERGY]]",
    "[[INFRA_COMMS]]",
    "[[INFRA_IT]]",
    "[[INFRA_WATER]]",
    "[[INFRA_WASTEWATER]]",
    "[[SYNTHESIS]]",
    "[[APPENDIX_INDEX]]",
]
OPTIONAL_ANCHORS = []


def get_para_text(element):
    parts = []
    for el in element.iter():
        if el.tag == qn("w:t") and el.text:
            parts.append(el.text)
    return "".join(parts).strip()


def _insert_anchor_after(body, index: int, anchor: str) -> None:
    from docx.oxml import OxmlElement

    p = OxmlElement("w:p")
    r = OxmlElement("w:r")
    t = OxmlElement("w:t")
    t.text = anchor
    t.set(qn("xml:space"), "preserve")
    r.append(t)
    p.append(r)
    body.insert(index + 1, p)


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent.parent
    ada_dir = repo_root / "ADA"
    blank_path = ada_dir / "report template.docx"

    if len(sys.argv) > 1:
        input_path = Path(sys.argv[1]).resolve()
    else:
        input_path = blank_path

    if not input_path.is_file():
        print(f"Template not found: {input_path}", file=sys.stderr)
        return 1

    doc = Document(str(input_path))
    body = doc.element.body
    children = list(body)

    # 1) Remove legacy SAFE-era content blocks
    legacy_markers = [
        "ANCHOR BLOCK (dev only)",
    ]
    to_remove = []
    for i, child in enumerate(children):
        if child.tag == qn("w:p"):
            text = get_para_text(child)
            for marker in legacy_markers:
                if marker in text:
                    to_remove.append(child)
                    break
    for child in to_remove:
        body.remove(child)
    children = list(body)

    # 2) Check which anchors already exist
    existing = set()
    for child in children:
        if child.tag != qn("w:p"):
            continue
        text = get_para_text(child)
        for a in REQUIRED_ANCHORS + OPTIONAL_ANCHORS:
            if a in text or text == a:
                existing.add(a)

    # 3) Insert missing anchors at appropriate locations
    # Map section headers to their corresponding anchors
    section_map = {
        "EXECUTIVE RISK POSTURE SNAPSHOT": [
            "[[SNAPSHOT_POSTURE]]",
            "[[SNAPSHOT_DRIVERS]]",
            "[[SNAPSHOT_MATRIX]]",
            "[[SNAPSHOT_CASCADE]]",
        ],
        "EXECUTIVE SUMMARY": ["[[EXEC_SUMMARY]]"],
        "ENERGY": ["[[INFRA_ENERGY]]"],
        "COMMUNICATIONS": ["[[INFRA_COMMS]]"],
        "INFORMATION TECHNOLOGY": ["[[INFRA_IT]]"],
        "WATER": ["[[INFRA_WATER]]"],
        "WASTEWATER": ["[[INFRA_WASTEWATER]]"],
        "CROSS-INFRASTRUCTURE SYNTHESIS": ["[[SYNTHESIS]]"],
        "APPENDIX": ["[[APPENDIX_INDEX]]"],
    }

    insertions: list[tuple[int, str, int]] = []  # (index_after, anchor, order)
    order = 0

    for i, child in enumerate(children):
        if child.tag != qn("w:p"):
            continue
        text = get_para_text(child).upper()
        for section_header, anchors in section_map.items():
            if section_header in text:
                for anchor in anchors:
                    if anchor not in existing:
                        insertions.append((i, anchor, order))
                        order += 1
                        existing.add(anchor)

    # Apply insertions: high index first; for same index, reverse order (first-found inserted first)
    for idx, anchor, _ in sorted(insertions, key=lambda x: (-x[0], -x[2])):
        _insert_anchor_after(body, idx, anchor)

    # 4) Append any remaining required anchors at end (fallback)
    for anchor in REQUIRED_ANCHORS:
        if anchor not in existing:
            p = doc.add_paragraph(anchor)
            body.remove(p._element)
            body.append(p._element)
            existing.add(anchor)

    # Create backup
    backup_path = input_path.with_suffix(".backup.docx")
    import shutil
    shutil.copy2(input_path, backup_path)
    doc.save(str(input_path))
    print(f"✓ Backup: {backup_path}")
    print(f"✓ Updated: {input_path}")
    print(f"✓ Anchors present: {sorted(existing)}")
    print("\nTemplate Redesign Complete – Snapshot Model Aligned.")
    return 0




if __name__ == "__main__":
    sys.exit(main())
