#!/usr/bin/env python3
"""Print text from first N pages of a PDF (for metadata extraction input)."""
import sys
from pathlib import Path

def main():
    if len(sys.argv) < 2:
        sys.exit(1)
    pdf_path = sys.argv[1]
    max_pages = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 3
    project_root = Path(__file__).resolve().parent.parent
    sys.path.insert(0, str(project_root))
    try:
        from model.ingest.pdf_citation_extractor import extract_text_from_pages
        text = extract_text_from_pages(pdf_path, max_pages=max_pages)
        print(text or "")
    except Exception:
        print("")

if __name__ == "__main__":
    main()
