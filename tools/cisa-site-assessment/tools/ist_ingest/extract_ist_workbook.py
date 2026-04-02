#!/usr/bin/env python3
"""
IST Workbook Extractor
Extracts VOFC_Library.xlsx into normalized JSON format.

Reads all sheets, normalizes rows, handles carry-forward logic.
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Any
import pandas as pd
import hashlib

# Expected header columns (case-insensitive)
EXPECTED_HEADERS = [
    "parent question",
    "child question/answer(s)",
    "vulnerability",
    "option for consideration",
    "reference"
]

def normalize_header(header: str) -> str:
    """Normalize header to lowercase, strip whitespace."""
    return str(header).strip().lower() if header else ""

def find_header_row(df: pd.DataFrame) -> Optional[int]:
    """Find the row index containing the header columns."""
    for idx, row in df.iterrows():
        row_values = [normalize_header(str(val)) for val in row.values]
        # Check if this row contains all expected headers
        found_count = 0
        for expected in EXPECTED_HEADERS:
            if any(expected in val for val in row_values):
                found_count += 1
        # If we find at least 4 out of 5 headers, consider this the header row
        if found_count >= 4:
            return idx
    return None

def get_column_mapping(df: pd.DataFrame, header_row_idx: int) -> Dict[str, int]:
    """Map normalized header names to column indices."""
    header_row = df.iloc[header_row_idx]
    mapping = {}
    
    for col_idx, col_val in enumerate(header_row):
        normalized = normalize_header(str(col_val))
        
        # Map to expected headers
        if "parent question" in normalized:
            mapping["parent_question"] = col_idx
        elif "child question" in normalized or "answer" in normalized:
            mapping["child_node"] = col_idx
        elif "vulnerability" in normalized:
            mapping["vulnerability"] = col_idx
        elif "option for consideration" in normalized or "ofc" in normalized:
            mapping["ofc_text"] = col_idx
        elif "reference" in normalized:
            mapping["reference"] = col_idx
    
    return mapping

def extract_cell_value(df: pd.DataFrame, row_idx: int, col_idx: int) -> Optional[str]:
    """Extract and clean cell value."""
    try:
        val = df.iloc[row_idx, col_idx]
        if pd.isna(val):
            return None
        val_str = str(val).strip()
        return val_str if val_str else None
    except (IndexError, KeyError):
        return None

def extract_sheet(workbook_path: str, sheet_name: str) -> List[Dict[str, Any]]:
    """Extract normalized records from a single sheet."""
    df = pd.read_excel(workbook_path, sheet_name=sheet_name, header=None)
    
    # Find header row
    header_row_idx = find_header_row(df)
    if header_row_idx is None:
        print(f"  WARNING: Could not find header row in sheet '{sheet_name}', skipping")
        return []
    
    # Get column mapping
    column_mapping = get_column_mapping(df, header_row_idx)
    
    # Verify we have at least parent_question and one other column
    if "parent_question" not in column_mapping:
        print(f"  WARNING: Could not find 'parent_question' column in sheet '{sheet_name}', skipping")
        return []
    
    records = []
    last_parent_question = None
    last_child_node = None
    last_reference = None  # Sheet-level reference carry-forward
    
    # Process data rows (start after header row)
    for row_idx in range(header_row_idx + 1, len(df)):
        record = {
            "sheet_name": sheet_name,
            "row_number": row_idx + 1,  # 1-indexed for user reference
            "parent_question": None,
            "child_node": None,
            "vulnerability": None,
            "ofc_text": None,
            "reference": None,
            "reference_inherited": False,
            "reference_unresolved": False
        }
        
        # Extract parent_question
        if "parent_question" in column_mapping:
            parent_val = extract_cell_value(df, row_idx, column_mapping["parent_question"])
            if parent_val:
                last_parent_question = parent_val
                record["parent_question"] = parent_val
            elif last_parent_question:
                # Carry forward
                record["parent_question"] = last_parent_question
        
        # Extract child_node
        if "child_node" in column_mapping:
            child_val = extract_cell_value(df, row_idx, column_mapping["child_node"])
            if child_val:
                last_child_node = child_val
                record["child_node"] = child_val
            elif last_child_node:
                # Carry forward ONLY if vulnerability or ofc_text present
                has_vuln_or_ofc = False
                if "vulnerability" in column_mapping:
                    vuln_val = extract_cell_value(df, row_idx, column_mapping["vulnerability"])
                    if vuln_val:
                        has_vuln_or_ofc = True
                        record["vulnerability"] = vuln_val
                
                if "ofc_text" in column_mapping:
                    ofc_val = extract_cell_value(df, row_idx, column_mapping["ofc_text"])
                    if ofc_val:
                        has_vuln_or_ofc = True
                        record["ofc_text"] = ofc_val
                
                if has_vuln_or_ofc:
                    record["child_node"] = last_child_node
        
        # Extract vulnerability (if not already set)
        if "vulnerability" in column_mapping and not record["vulnerability"]:
            vuln_val = extract_cell_value(df, row_idx, column_mapping["vulnerability"])
            if vuln_val:
                record["vulnerability"] = vuln_val
        
        # Extract ofc_text (if not already set)
        if "ofc_text" in column_mapping and not record["ofc_text"]:
            ofc_val = extract_cell_value(df, row_idx, column_mapping["ofc_text"])
            if ofc_val:
                record["ofc_text"] = ofc_val
        
        # Extract reference with carry-forward logic
        if "reference" in column_mapping:
            ref_raw = extract_cell_value(df, row_idx, column_mapping["reference"])
            
            if ref_raw:
                # Non-empty reference: update last_reference and use it
                last_reference = ref_raw
                record["reference"] = ref_raw
                record["reference_inherited"] = False
                record["reference_unresolved"] = False
            else:
                # Empty reference cell: carry forward if row has ofc_text or vulnerability
                has_ofc_or_vuln = bool(record.get("ofc_text") or record.get("vulnerability"))
                
                if has_ofc_or_vuln:
                    # Carry forward reference if available
                    if last_reference is not None:
                        record["reference"] = last_reference
                        record["reference_inherited"] = True
                        record["reference_unresolved"] = False
                    else:
                        # No reference available to inherit
                        record["reference"] = None
                        record["reference_inherited"] = False
                        record["reference_unresolved"] = True
                else:
                    # Pure question-tree row: no reference needed
                    record["reference"] = None
                    record["reference_inherited"] = False
                    record["reference_unresolved"] = False
        else:
            # No reference column in sheet: check if unresolved
            has_ofc_or_vuln = bool(record.get("ofc_text") or record.get("vulnerability"))
            if has_ofc_or_vuln:
                record["reference"] = None
                record["reference_inherited"] = False
                record["reference_unresolved"] = True
            else:
                record["reference"] = None
                record["reference_inherited"] = False
                record["reference_unresolved"] = False
        
        # Only add record if it has at least parent_question or meaningful content
        if record["parent_question"] or record["vulnerability"] or record["ofc_text"]:
            records.append(record)
    
    return records

def main():
    """Main extraction process."""
    script_dir = Path(__file__).parent
    input_dir = script_dir / "input"
    output_dir = script_dir / "output"
    
    workbook_path = input_dir / "VOFC_Library.xlsx"
    
    if not workbook_path.exists():
        print(f"ERROR: Workbook not found at {workbook_path}")
        print(f"Please copy VOFC_Library.xlsx to {input_dir}")
        sys.exit(1)
    
    print("=" * 80)
    print("IST Workbook Extractor")
    print("=" * 80)
    print()
    print(f"Reading workbook: {workbook_path}")
    
    # Read all sheet names
    try:
        excel_file = pd.ExcelFile(workbook_path)
        sheet_names = excel_file.sheet_names
        print(f"Found {len(sheet_names)} sheets: {', '.join(sheet_names)}")
    except Exception as e:
        print(f"ERROR: Failed to read workbook: {e}")
        sys.exit(1)
    
    all_records = []
    disciplines_data = []
    
    # Extract each sheet
    for sheet_name in sheet_names:
        print(f"\nProcessing sheet: {sheet_name}")
        try:
            records = extract_sheet(str(workbook_path), sheet_name)
            print(f"  Extracted {len(records)} records")
            all_records.extend(records)
            
            disciplines_data.append({
                "sheet_name": sheet_name,
                "records": records
            })
        except Exception as e:
            print(f"  ERROR processing sheet '{sheet_name}': {e}")
            continue
    
    print(f"\nTotal records extracted: {len(all_records)}")
    
    # Count unresolved references
    unresolved_records = [r for r in all_records if r.get("reference_unresolved", False)]
    if unresolved_records:
        print(f"  Found {len(unresolved_records)} records with unresolved references")
    
    # Write JSONL output (one JSON per row)
    jsonl_path = output_dir / "ist_extracted_rows.jsonl"
    print(f"\nWriting JSONL output: {jsonl_path}")
    with open(jsonl_path, 'w', encoding='utf-8') as f:
        for record in all_records:
            f.write(json.dumps(record, ensure_ascii=False) + '\n')
    print(f"  Wrote {len(all_records)} records")
    
    # Write unresolved reference rows (quarantine export)
    if unresolved_records:
        unresolved_path = output_dir / "ist_unresolved_reference_rows.json"
        print(f"\nWriting unresolved reference rows: {unresolved_path}")
        unresolved_export = {
            "generated_at": pd.Timestamp.now().isoformat(),
            "workbook": "VOFC_Library.xlsx",
            "total_unresolved": len(unresolved_records),
            "records": unresolved_records
        }
        with open(unresolved_path, 'w', encoding='utf-8') as f:
            json.dump(unresolved_export, f, ensure_ascii=False, indent=2)
        print(f"  Wrote {len(unresolved_records)} unresolved reference records")
    
    # Write normalized packages JSON
    packages_path = output_dir / "ist_normalized_packages.json"
    print(f"\nWriting normalized packages: {packages_path}")
    
    packages = {
        "generated_at": pd.Timestamp.now().isoformat(),
        "workbook": "VOFC_Library.xlsx",
        "disciplines": disciplines_data
    }
    
    with open(packages_path, 'w', encoding='utf-8') as f:
        json.dump(packages, f, ensure_ascii=False, indent=2)
    print(f"  Wrote {len(disciplines_data)} discipline packages")
    
    print("\n" + "=" * 80)
    print("Extraction complete!")
    print("=" * 80)

if __name__ == "__main__":
    main()

