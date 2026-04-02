#!/usr/bin/env python3
"""
Debug script to check why a document might be stuck in incoming.
"""

import sys
from pathlib import Path

# Add watcher directory to path
watcher_dir = Path(__file__).parent.parent
sys.path.insert(0, str(watcher_dir.parent.parent))

from analytics.watcher.pipeline_watcher import PipelineWatcher

def debug_incoming(custom_incoming_dir=None):
    """Debug documents in incoming directory."""
    watcher = PipelineWatcher()
    
    # Override incoming directory if specified
    if custom_incoming_dir:
        watcher.incoming_dir = Path(custom_incoming_dir)
    
    print("=" * 60)
    print("Pipeline Watcher Debug")
    print("=" * 60)
    print(f"Incoming directory: {watcher.incoming_dir}")
    print(f"Exists: {watcher.incoming_dir.exists()}")
    print()
    
    if not watcher.incoming_dir.exists():
        print("ERROR: Incoming directory does not exist!")
        return
    
    # List all files
    print("Files in incoming directory:")
    print("-" * 60)
    files = list(watcher.incoming_dir.iterdir())
    
    if not files:
        print("  (empty)")
    else:
        for filepath in files:
            if filepath.is_file():
                size = filepath.stat().st_size
                mtime = filepath.stat().st_mtime
                print(f"  {filepath.name}")
                print(f"    Size: {size:,} bytes")
                print(f"    Modified: {mtime}")
                print()
    
    # Check file stability
    print("File stability check:")
    print("-" * 60)
    for filepath in files:
        if filepath.is_file():
            is_stable = watcher._is_file_stable(filepath, watcher.file_stability_seconds)
            print(f"  {filepath.name}: {'STABLE' if is_stable else 'NOT STABLE (size changing)'}")
    
    # Check for duplicates
    print()
    print("Duplicate check:")
    print("-" * 60)
    for filepath in files:
        if filepath.is_file():
            sha256 = watcher._compute_sha256(filepath)
            duplicate_id = watcher._check_duplicate(sha256)
            if duplicate_id:
                print(f"  {filepath.name}: DUPLICATE (matches {duplicate_id})")
            else:
                print(f"  {filepath.name}: NEW (SHA256: {sha256[:16]}...)")
    
    # Try to intake
    print()
    print("Attempting intake:")
    print("-" * 60)
    for filepath in files:
        if filepath.is_file():
            print(f"  Processing {filepath.name}...")
            try:
                doc_id = watcher._intake_document(filepath)
                if doc_id:
                    print(f"    ✓ Intaken as: {doc_id}")
                else:
                    print(f"    ✗ Intake failed or duplicate")
            except Exception as e:
                print(f"    ✗ Error: {e}")
    
    print()
    print("=" * 60)

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Debug stuck documents in incoming directory")
    parser.add_argument(
        "--incoming",
        help="Custom incoming directory path (default: analytics/incoming)"
    )
    
    args = parser.parse_args()
    debug_incoming(args.incoming)

