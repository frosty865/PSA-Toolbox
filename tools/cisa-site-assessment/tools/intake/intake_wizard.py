#!/usr/bin/env python3
"""
Intake Wizard CLI

Human-confirmed metadata entry with optional Ollama suggestions.
Requires operator confirmation before writing metadata files.
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import argparse

# Add router to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "services" / "router"))
from meta_schema import create_metadata, validate_metadata, ALLOWED_DISCIPLINES, ALLOWED_SOURCE_TYPES
from ollama_suggest import suggest_metadata


def get_username() -> str:
    """Get username from environment or prompt."""
    username = os.getenv("USERNAME") or os.getenv("USER") or "operator"
    return username


def prompt_choice(prompt: str, choices: List[str], default: Optional[str] = None) -> str:
    """
    Prompt user for choice from list.
    
    Args:
        prompt: Prompt text
        choices: List of valid choices
        default: Default choice (if None, no default)
    
    Returns:
        Selected choice
    """
    while True:
        if default:
            prompt_text = f"{prompt} [{default}]: "
        else:
            prompt_text = f"{prompt}: "
        
        choice = input(prompt_text).strip()
        
        if not choice and default:
            return default
        
        if choice in choices:
            return choice
        
        print(f"Invalid choice. Must be one of: {', '.join(choices)}")


def prompt_optional(prompt: str, default: Optional[str] = None) -> Optional[str]:
    """
    Prompt for optional string input.
    
    Args:
        prompt: Prompt text
        default: Default value
    
    Returns:
        Input string or None if empty
    """
    if default:
        prompt_text = f"{prompt} [{default}]: "
    else:
        prompt_text = f"{prompt} (optional): "
    
    value = input(prompt_text).strip()
    
    if not value:
        return default if default else None
    
    return value


def prompt_required(prompt: str, default: Optional[str] = None) -> str:
    """
    Prompt for required string input.
    
    Args:
        prompt: Prompt text
        default: Default value
    
    Returns:
        Input string (never None)
    """
    while True:
        if default:
            prompt_text = f"{prompt} [{default}]: "
        else:
            prompt_text = f"{prompt}: "
        
        value = input(prompt_text).strip()
        
        if not value:
            if default:
                return default
            print("This field is required.")
            continue
        
        return value


def classify_single_file(pdf_path: Path, use_ollama: bool = True) -> bool:
    """
    Classify a single PDF file.
    
    Args:
        pdf_path: Path to PDF file
        use_ollama: Whether to use Ollama suggestions
    
    Returns:
        True if metadata written successfully, False otherwise
    """
    print(f"\n{'='*60}")
    print(f"Classifying: {pdf_path.name}")
    print(f"{'='*60}")
    
    # Optional Ollama suggestion
    suggestion = None
    if use_ollama:
        print("\n[Optional] Getting Ollama suggestions...")
        try:
            suggestion = suggest_metadata(pdf_path)
            print(f"\nPROPOSED METADATA (from Ollama):")
            print(f"  Discipline: {suggestion.get('discipline_code', 'N/A')}")
            print(f"  Source Type: {suggestion.get('source_type', 'corpus')}")
            print(f"  Sector: {suggestion.get('sector_id', 'N/A')}")
            print(f"  Subsector: {suggestion.get('subsector_id', 'N/A')}")
            print(f"  Confidence: {suggestion.get('confidence', 0.0):.2f}")
            print(f"  Rationale: {suggestion.get('rationale', 'N/A')}")
            print("\n⚠️  These are PROPOSALS only - you must confirm or override each field.")
        except Exception as e:
            print(f"⚠️  Ollama suggestion failed: {e}")
            print("Continuing with manual entry...")
    
    # Prompt for metadata (with suggestions as defaults)
    print("\n" + "-"*60)
    print("METADATA ENTRY (all fields require confirmation)")
    print("-"*60)
    
    # Source type
    source_type_default = suggestion.get("source_type", "corpus") if suggestion else "corpus"
    source_type = prompt_choice(
        "Source Type",
        list(ALLOWED_SOURCE_TYPES),
        default=source_type_default
    )
    
    # Discipline code
    discipline_default = suggestion.get("discipline_code") if suggestion else None
    print(f"\nAllowed disciplines: {', '.join(sorted(ALLOWED_DISCIPLINES))}")
    discipline_code = prompt_required(
        "Discipline Code",
        default=discipline_default
    )
    
    if discipline_code not in ALLOWED_DISCIPLINES:
        print(f"ERROR: Invalid discipline code: {discipline_code}")
        return False
    
    # Module ID (if source_type is module)
    module_id = None
    if source_type == "module":
        module_id = prompt_required("Module ID")
    
    # Sector ID (optional)
    sector_default = suggestion.get("sector_id") if suggestion else None
    sector_id = prompt_optional("Sector ID", default=sector_default)
    
    # Subsector ID (optional, requires sector_id)
    subsector_id = None
    if sector_id:
        subsector_default = suggestion.get("subsector_id") if suggestion else None
        subsector_id = prompt_optional("Subsector ID", default=subsector_default)
    
    # Source key (optional)
    source_key = prompt_optional("Source Key")
    
    # Notes (optional)
    notes = prompt_optional("Notes")
    
    # Confirmed by
    username = get_username()
    confirmed_by = prompt_required("Confirmed By (username)", default=username)
    
    # Create metadata
    try:
        metadata = create_metadata(
            source_type=source_type,
            discipline_code=discipline_code,
            confirmed_by=confirmed_by,
            module_id=module_id,
            sector_id=sector_id,
            subsector_id=subsector_id,
            source_key=source_key,
            notes=notes
        )
    except ValueError as e:
        print(f"ERROR: Invalid metadata: {e}")
        return False
    
    # Confirm before writing
    print("\n" + "-"*60)
    print("METADATA SUMMARY:")
    print(json.dumps(metadata, indent=2))
    print("-"*60)
    
    confirm = prompt_choice("Write metadata file? (y/n)", ["y", "n"], default="y")
    
    if confirm != "y":
        print("Cancelled.")
        return False
    
    # Write metadata file
    meta_path = pdf_path.with_suffix(".meta.json")
    try:
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)
        
        print(f"\n✅ Metadata written: {meta_path}")
        return True
    except Exception as e:
        print(f"ERROR: Failed to write metadata: {e}")
        return False


def classify_bulk(files: List[Path], use_ollama: bool = True) -> bool:
    """
    Classify multiple files with same metadata (bulk mode).
    
    Args:
        files: List of PDF paths
        use_ollama: Whether to use Ollama for first file only
    
    Returns:
        True if all metadata written successfully, False otherwise
    """
    print(f"\n{'='*60}")
    print(f"BULK CLASSIFICATION: {len(files)} files")
    print(f"{'='*60}")
    
    # Get metadata once (use Ollama on first file if enabled)
    first_file = files[0]
    suggestion = None
    
    if use_ollama:
        print(f"\n[Optional] Getting Ollama suggestions from: {first_file.name}")
        try:
            suggestion = suggest_metadata(first_file)
            print(f"\nPROPOSED METADATA (from Ollama):")
            print(f"  Discipline: {suggestion.get('discipline_code', 'N/A')}")
            print(f"  Source Type: {suggestion.get('source_type', 'corpus')}")
            print(f"  Sector: {suggestion.get('sector_id', 'N/A')}")
            print(f"  Subsector: {suggestion.get('subsector_id', 'N/A')}")
            print(f"  Confidence: {suggestion.get('confidence', 0.0):.2f}")
            print(f"  Rationale: {suggestion.get('rationale', 'N/A')}")
        except Exception as e:
            print(f"⚠️  Ollama suggestion failed: {e}")
    
    # Prompt for metadata (applies to all files)
    print("\n" + "-"*60)
    print("METADATA ENTRY (will apply to all files)")
    print("-"*60)
    
    source_type_default = suggestion.get("source_type", "corpus") if suggestion else "corpus"
    source_type = prompt_choice(
        "Source Type",
        list(ALLOWED_SOURCE_TYPES),
        default=source_type_default
    )
    
    print(f"\nAllowed disciplines: {', '.join(sorted(ALLOWED_DISCIPLINES))}")
    discipline_default = suggestion.get("discipline_code") if suggestion else None
    discipline_code = prompt_required("Discipline Code", default=discipline_default)
    
    if discipline_code not in ALLOWED_DISCIPLINES:
        print(f"ERROR: Invalid discipline code: {discipline_code}")
        return False
    
    module_id = None
    if source_type == "module":
        module_id = prompt_required("Module ID")
    
    sector_default = suggestion.get("sector_id") if suggestion else None
    sector_id = prompt_optional("Sector ID", default=sector_default)
    
    subsector_id = None
    if sector_id:
        subsector_default = suggestion.get("subsector_id") if suggestion else None
        subsector_id = prompt_optional("Subsector ID", default=subsector_default)
    
    source_key = prompt_optional("Source Key")
    notes = prompt_optional("Notes")
    
    username = get_username()
    confirmed_by = prompt_required("Confirmed By (username)", default=username)
    
    # Create metadata template
    try:
        metadata = create_metadata(
            source_type=source_type,
            discipline_code=discipline_code,
            confirmed_by=confirmed_by,
            module_id=module_id,
            sector_id=sector_id,
            subsector_id=subsector_id,
            source_key=source_key,
            notes=notes
        )
    except ValueError as e:
        print(f"ERROR: Invalid metadata: {e}")
        return False
    
    # Confirm
    print("\n" + "-"*60)
    print("METADATA SUMMARY (will apply to all files):")
    print(json.dumps(metadata, indent=2))
    print("-"*60)
    
    confirm = prompt_choice("Write metadata files for all files? (y/n)", ["y", "n"], default="y")
    
    if confirm != "y":
        print("Cancelled.")
        return False
    
    # Write metadata for all files
    success_count = 0
    for pdf_path in files:
        meta_path = pdf_path.with_suffix(".meta.json")
        try:
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, indent=2)
            print(f"✅ {pdf_path.name}")
            success_count += 1
        except Exception as e:
            print(f"❌ {pdf_path.name}: {e}")
    
    print(f"\n✅ Successfully classified {success_count}/{len(files)} files")
    return success_count == len(files)


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(description="Intake Wizard - Human-confirmed metadata entry")
    parser.add_argument(
        "--staging-dir",
        type=str,
        default=None,
        help="Staging directory (default: services/router/staging/unclassified)"
    )
    parser.add_argument(
        "--no-ollama",
        action="store_true",
        help="Disable Ollama suggestions"
    )
    parser.add_argument(
        "--bulk",
        action="store_true",
        help="Bulk mode: classify all PDFs in staging with same metadata"
    )
    parser.add_argument(
        "files",
        nargs="*",
        help="Specific PDF files to classify (if not provided, uses staging directory)"
    )
    
    args = parser.parse_args()
    
    # Determine staging directory
    if args.staging_dir:
        staging_dir = Path(args.staging_dir)
    else:
        # Default: assume running from psa_rebuild root
        base_dir = Path(__file__).parent.parent.parent
        staging_dir = base_dir / "services" / "router" / "staging" / "unclassified"
    
    # Get files to classify
    files_to_classify = []
    
    if args.files:
        # Use provided files
        for file_arg in args.files:
            file_path = Path(file_arg)
            if not file_path.exists():
                print(f"ERROR: File not found: {file_path}")
                sys.exit(1)
            if not file_path.suffix.lower() == ".pdf":
                print(f"WARNING: Not a PDF file: {file_path}")
            files_to_classify.append(file_path)
    else:
        # Use staging directory
        if not staging_dir.exists():
            print(f"ERROR: Staging directory not found: {staging_dir}")
            sys.exit(1)
        
        pdf_files = list(staging_dir.glob("*.pdf"))
        if not pdf_files:
            print(f"No PDF files found in: {staging_dir}")
            sys.exit(0)
        
        files_to_classify = pdf_files
    
    if not files_to_classify:
        print("No files to classify.")
        sys.exit(0)
    
    # Classify files
    use_ollama = not args.no_ollama
    
    if args.bulk or len(files_to_classify) > 1:
        success = classify_bulk(files_to_classify, use_ollama=use_ollama)
    else:
        success = classify_single_file(files_to_classify[0], use_ollama=use_ollama)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
