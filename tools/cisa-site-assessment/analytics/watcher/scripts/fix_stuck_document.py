#!/usr/bin/env python3
"""
Fix stuck document in incoming directory.
Moves it to processing and creates trigger file.
"""

import sys
import json
import shutil
from pathlib import Path
from datetime import datetime

def fix_stuck_document(incoming_path: str, processing_base: str):
    """Move stuck document from incoming to processing."""
    incoming = Path(incoming_path)
    processing_base_dir = Path(processing_base)
    
    if not incoming.exists():
        print(f"ERROR: Incoming directory does not exist: {incoming}")
        return False
    
    # Find PDF files in incoming
    pdf_files = list(incoming.glob("*.pdf"))
    
    if not pdf_files:
        print("No PDF files found in incoming directory")
        return False
    
    for pdf_file in pdf_files:
        print(f"Found stuck document: {pdf_file.name}")
        print(f"  Size: {pdf_file.stat().st_size:,} bytes")
        print(f"  Modified: {datetime.fromtimestamp(pdf_file.stat().st_mtime)}")
        
        # Generate document ID from filename
        doc_id = pdf_file.stem  # Use filename without extension as ID
        
        # Create processing directory
        processing_dir = processing_base_dir / doc_id
        processing_dir.mkdir(parents=True, exist_ok=True)
        
        # Move file
        dest_file = processing_dir / pdf_file.name
        if dest_file.exists():
            print(f"  WARNING: Destination already exists: {dest_file}")
            response = input("  Overwrite? (y/n): ")
            if response.lower() != 'y':
                print("  Skipping...")
                continue
            dest_file.unlink()
        
        print(f"  Moving to: {dest_file}")
        shutil.move(str(pdf_file), str(dest_file))
        
        # Create pipeline trigger
        trigger_file = processing_dir / "pipeline_trigger.json"
        trigger_data = {
            "source_document_id": doc_id,
            "triggered_at": datetime.now().isoformat(),
            "status": "queued",
            "note": "Manually moved from stuck state"
        }
        
        with open(trigger_file, 'w') as f:
            json.dump(trigger_data, f, indent=2)
        
        print(f"  ✓ Created trigger file: {trigger_file}")
        print(f"  ✓ Document ready for processing: {doc_id}")
        print()
    
    return True

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Fix stuck document in incoming")
    parser.add_argument(
        "--incoming",
        default=None,  # ⚠️ DEPRECATED: Tech_Sources removed. Use PSA_PIPELINE_ROOT/incoming instead.
        help="Incoming directory path"
    )
    parser.add_argument(
        "--processing",
        default=None,  # ⚠️ DEPRECATED: Tech_Sources removed. Use PSA_PIPELINE_ROOT/temp instead.
        help="Processing base directory"
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Fix Stuck Document")
    print("=" * 60)
    print(f"Incoming: {args.incoming}")
    print(f"Processing: {args.processing}")
    print()
    
    fix_stuck_document(args.incoming, args.processing)
    
    print("=" * 60)
    print("Done!")
    print("=" * 60)

