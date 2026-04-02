#!/usr/bin/env python3
"""Quick script to delete specific PDFs."""
import os
from pathlib import Path

# Use PSA_SYSTEM_ROOT environment variable or default to D:\PSA_System
PSA_SYSTEM_ROOT = Path(os.environ.get('PSA_SYSTEM_ROOT', r'D:\PSA_System'))
pdf_dir = PSA_SYSTEM_ROOT / "data" / "incoming"
files_to_delete = [
    "FAA_FAA_TFR_DECISION_MATRIX_SLTT_LAW_ENFORCEMENT_GUIDE.pdf",
    "workbook.pdf"
]

for filename in files_to_delete:
    file_path = pdf_dir / filename
    if file_path.exists():
        file_path.unlink()
        print(f"Deleted: {filename}")
    else:
        print(f"Not found: {filename}")
