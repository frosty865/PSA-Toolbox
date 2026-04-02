#!/usr/bin/env python3
"""
IST Extract Validator
Validates the extracted JSON output for quality and completeness.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Any

def load_packages(packages_path: Path) -> Dict[str, Any]:
    """Load normalized packages JSON."""
    with open(packages_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def validate_extract(packages_path: Path) -> tuple[bool, List[str]]:
    """Validate extracted data. Returns (is_valid, errors)."""
    errors = []
    
    if not packages_path.exists():
        errors.append(f"Packages file not found: {packages_path}")
        return False, errors
    
    try:
        packages = load_packages(packages_path)
    except Exception as e:
        errors.append(f"Failed to load packages file: {e}")
        return False, errors
    
    # Check: At least 1 discipline sheet parsed
    disciplines = packages.get("disciplines", [])
    if len(disciplines) == 0:
        errors.append("No discipline sheets found in packages")
        return False, errors
    
    print(f"Found {len(disciplines)} discipline sheets")
    
    # Check: Each discipline has >= 10 records (warn for empty, fail only if < 10 and > 0)
    for disc in disciplines:
        sheet_name = disc.get("sheet_name", "unknown")
        records = disc.get("records", [])
        if len(records) == 0:
            # Empty sheet: warn but don't fail (might be formatting/placeholder sheet)
            print(f"  WARNING: Sheet '{sheet_name}' has 0 records (may be empty or unparseable)")
        elif len(records) < 10:
            errors.append(f"Sheet '{sheet_name}' has only {len(records)} records (minimum 10 required)")
    
    # Check: % rows with parent_question not null > 50%
    total_records = 0
    records_with_parent = 0
    
    for disc in disciplines:
        records = disc.get("records", [])
        total_records += len(records)
        for record in records:
            if record.get("parent_question"):
                records_with_parent += 1
    
    if total_records > 0:
        parent_percentage = (records_with_parent / total_records) * 100
        print(f"Records with parent_question: {records_with_parent}/{total_records} ({parent_percentage:.1f}%)")
        if parent_percentage <= 50:
            errors.append(f"Only {parent_percentage:.1f}% of records have parent_question (minimum 50% required)")
    else:
        errors.append("No records found to validate")
    
    # Check: Reference resolution (quarantine, not fail)
    unresolved_count = 0
    unresolved_details = []
    logic_error_count = 0
    
    for disc in disciplines:
        records = disc.get("records", [])
        for record in records:
            ofc_text = record.get("ofc_text")
            vulnerability = record.get("vulnerability")
            reference = record.get("reference")
            reference_unresolved = record.get("reference_unresolved", False)
            
            # Hard fail only if logic error: ofc_text exists, no reference, but not marked unresolved
            if ofc_text and not reference and not reference_unresolved:
                logic_error_count += 1
                errors.append(
                    f"LOGIC ERROR: Record in sheet '{disc.get('sheet_name')}' row {record.get('row_number')} "
                    f"has ofc_text but no reference and reference_unresolved is false"
                )
            
            # Count unresolved references (quarantine)
            if reference_unresolved:
                unresolved_count += 1
                unresolved_details.append({
                    "sheet_name": disc.get("sheet_name"),
                    "row_number": record.get("row_number"),
                    "has_ofc": bool(ofc_text),
                    "has_vulnerability": bool(vulnerability)
                })
    
    # Report unresolved references (warning, not error)
    if unresolved_count > 0:
        print(f"\n[WARN] Unresolved OFC references: {unresolved_count} rows (will be routed to manual review)")
        print("  Sample unresolved rows:")
        for detail in unresolved_details[:10]:  # Show first 10
            print(f"    - {detail['sheet_name']} row {detail['row_number']}")
        if len(unresolved_details) > 10:
            print(f"    ... and {len(unresolved_details) - 10} more (see ist_unresolved_reference_rows.json)")
    
    # Only fail on logic errors, not unresolved references
    is_valid = len(errors) == 0
    return is_valid, errors

def main():
    """Main validation process."""
    script_dir = Path(__file__).parent
    output_dir = script_dir / "output"
    packages_path = output_dir / "ist_normalized_packages.json"
    
    print("=" * 80)
    print("IST Extract Validator")
    print("=" * 80)
    print()
    
    is_valid, errors = validate_extract(packages_path)
    
    if is_valid:
        print("\n✓ Validation PASSED")
        print("=" * 80)
        sys.exit(0)
    else:
        print("\n✗ Validation FAILED")
        print("\nErrors:")
        for error in errors:
            print(f"  - {error}")
        print("=" * 80)
        sys.exit(1)

if __name__ == "__main__":
    main()

