#!/usr/bin/env python3
"""
Delete outdated, orphaned, and deprecated .py files across all 3 repos.

This script identifies and deletes:
- One-time fix/cleanup scripts that have been completed
- Debug scripts that are no longer needed
- Migration scripts for completed migrations
- Temporary or test scripts (excluding venv)
"""

import os
import sys
from pathlib import Path

# Files to delete in psa_rebuild
PSA_REBUILD_DELETE = [
    # One-time fix scripts (already completed)
    "tools/fix_baseline_subtype_references.py",  # One-time fix for subtype references
    "tools/purge_baseline_placeholders.py",  # One-time cleanup, already completed
    
    # One-time reorganization scripts
    "analytics/watcher/scripts/identify_misplaced_files.py",  # One-time reorganization task
    
    # Note: Keeping debug_stuck_document.py and fix_stuck_document.py as they may be useful for operations
]

# Files to delete in psa_engine
PSA_ENGINE_DELETE = [
    # One-time fix/normalization scripts
    "analytics/tools/fix_vss_phrasing_issues.py",  # One-time fix for VSS phrasing
    "analytics/tools/normalize_procedures_questions.py",  # One-time normalization
    "analytics/tools/normalize_personnel_questions.py",  # One-time normalization
    "analytics/tools/fix_phrasing_issues.py",  # One-time fix script
]

# Files to delete in psaback
PSABACK_DELETE = [
    # Temporary/one-time scripts
    "tools/temp_coverage_calculator.py",  # Explicitly marked as TEMPORARY
    "tools/fix_stuck_documents.py",  # One-time fix script
]


def should_exclude_file(file_path: str) -> bool:
    """Check if file should be excluded from deletion (e.g., venv, node_modules)."""
    exclude_patterns = [
        'venv/',
        'node_modules/',
        '__pycache__/',
        '.git/',
        'site-packages/',
    ]
    return any(pattern in file_path.replace('\\', '/') for pattern in exclude_patterns)


def delete_files(repo_path: str, files: list, repo_name: str):
    """Delete files from a repository."""
    deleted = []
    not_found = []
    errors = []
    excluded = []
    
    for file_path in files:
        # Skip excluded files
        if should_exclude_file(file_path):
            excluded.append(file_path)
            continue
            
        full_path = os.path.join(repo_path, file_path)
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
                deleted.append(file_path)
                print(f"  ✓ Deleted: {file_path}")
            except Exception as e:
                errors.append((file_path, str(e)))
                print(f"  ✗ Error deleting {file_path}: {e}")
        else:
            not_found.append(file_path)
            print(f"  ⚠ Not found: {file_path}")
    
    print(f"\n{repo_name} Summary:")
    print(f"  Deleted: {len(deleted)}")
    print(f"  Not found: {len(not_found)}")
    print(f"  Errors: {len(errors)}")
    if excluded:
        print(f"  Excluded: {len(excluded)}")
    
    return deleted, not_found, errors


def main():
    """Main execution."""
    print("=" * 80)
    print("DELETE OUTDATED/ORPHANED/DEPRECATED .PY FILES")
    print("=" * 80)
    print()
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    workspace_root = os.path.join(script_dir, '..', '..')
    
    psa_rebuild_path = os.path.join(workspace_root, 'psa_rebuild')
    psa_engine_path = os.path.join(workspace_root, 'psa_engine')
    psaback_path = os.path.join(workspace_root, 'psaback')
    
    all_deleted = []
    all_not_found = []
    all_errors = []
    
    # Delete from psa_rebuild
    if os.path.exists(psa_rebuild_path):
        print("Processing psa_rebuild...")
        deleted, not_found, errors = delete_files(psa_rebuild_path, PSA_REBUILD_DELETE, "psa_rebuild")
        all_deleted.extend([f"psa_rebuild/{f}" for f in deleted])
        all_not_found.extend([f"psa_rebuild/{f}" for f in not_found])
        all_errors.extend([(f"psa_rebuild/{f}", e) for f, e in errors])
    else:
        print("⚠ psa_rebuild not found")
    
    print()
    
    # Delete from psa_engine
    if os.path.exists(psa_engine_path):
        print("Processing psa_engine...")
        deleted, not_found, errors = delete_files(psa_engine_path, PSA_ENGINE_DELETE, "psa_engine")
        all_deleted.extend([f"psa_engine/{f}" for f in deleted])
        all_not_found.extend([f"psa_engine/{f}" for f in not_found])
        all_errors.extend([(f"psa_engine/{f}", e) for f, e in errors])
    else:
        print("⚠ psa_engine not found")
    
    print()
    
    # Delete from psaback
    if os.path.exists(psaback_path):
        print("Processing psaback...")
        deleted, not_found, errors = delete_files(psaback_path, PSABACK_DELETE, "psaback")
        all_deleted.extend([f"psaback/{f}" for f in deleted])
        all_not_found.extend([f"psaback/{f}" for f in not_found])
        all_errors.extend([(f"psaback/{f}", e) for f, e in errors])
    else:
        print("⚠ psaback not found")
    
    # Final summary
    print("\n" + "=" * 80)
    print("FINAL SUMMARY")
    print("=" * 80)
    print(f"Total deleted: {len(all_deleted)}")
    print(f"Total not found: {len(all_not_found)}")
    print(f"Total errors: {len(all_errors)}")
    
    if all_errors:
        print("\nErrors:")
        for file_path, error in all_errors:
            print(f"  {file_path}: {error}")


if __name__ == '__main__':
    main()

