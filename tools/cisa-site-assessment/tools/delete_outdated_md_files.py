#!/usr/bin/env python3
"""
Delete outdated, orphaned, and deprecated .md files across all 3 repos.

This script identifies and deletes:
- One-time completion/summary documents
- Migration/cleanup plans for completed tasks
- Old audit reports
- Reorganization summaries
- Deprecated documentation
"""

import os
import sys
from pathlib import Path

# Files to delete in psa_rebuild
PSA_REBUILD_DELETE = [
    # Completion/summary docs (one-time tasks)
    "docs/ADMIN_REMOVAL.md",
    "docs/SYSTEM_RESET_COMPLETE.md",
    "docs/SYSTEM_RESET_EXECUTION.md",
    "docs/SYSTEM_RESET_PLAN.md",
    "docs/HYGIENE_RESET_COMPLETE.md",
    "docs/HYGIENE_CLEANUP_PLAN.md",
    "docs/ADMIN_REDESIGN_COMPLETE.md",
    "docs/ADMIN_3_CLICK_AUDIT_V1.md",
    "docs/ADMIN_EXISTING_SURFACE_V1.md",
    "docs/admin/REBUILD_COMPLETE.md",
    "docs/admin/PAGE_CLEANUP_SUMMARY.md",
    "docs/admin/ADMIN_REBUILD_PLAN.md",
    "docs/admin/ADMIN_AUDIT_REPORT.md",
    
    # NSSM cleanup docs
    "docs/NSSM_CLEANUP.md",
    "docs/NSSM_SERVICES.md",
    "docs/NSSM_SERVICES_SUMMARY.md",
    
    # Migration docs (completed migrations)
    "docs/doctrine/MIGRATION_STATUS.md",
    "docs/doctrine/MIGRATION_APPLICATION_NOTES.md",
    "analytics/watcher/MIGRATION_SUMMARY.md",
    "analytics/watcher/MIGRATION_GUIDE.md",
    "analytics/watcher/MIGRATION_COMPLETE.md",
    "analytics/watcher/REORGANIZATION_COMPLETE.md",
    "analytics/watcher/REORGANIZE_PSABACK.md",
    "analytics/watcher/WATCHER_COMPARISON.md",
    
    # Already archived
    "archive/2025-12-21/ROUTE_TEST_SUMMARY.md",
]

# Files to delete in psa_engine
PSA_ENGINE_DELETE = [
    # Completion/summary docs
    "analytics/coverage_library/FLATTENING_COMPLETE.md",
    "analytics/coverage_library/MIGRATION_COMPLETE.md",
    "analytics/coverage_library/RESTRUCTURING_SUMMARY.md",
    "analytics/library/LOADER_MIGRATION_SUMMARY.md",
    "analytics/watcher/STREAMLINING_COMPLETE.md",
    "analytics/watcher/IMPLEMENTATION_SUMMARY.md",
    "analytics/watcher/scripts/REORGANIZATION_STEPS.md",
    "analytics/watcher/scripts/SERVICE_REORGANIZATION_SUMMARY.md",
    "analytics/watcher/scripts/SERVICE_REORGANIZATION.md",
    "docs/OVERLAY_IMPLEMENTATION_SUMMARY.md",
    
    # Deprecated service docs
    "services/candidate_viewer/DEPRECATED.md",
]

# Files to delete in psaback
PSABACK_DELETE = [
    # Completion/summary docs
    "UNIFIED_DOCUMENT_STANDARD_COMPLETE.md",
    "REORGANIZATION_SUMMARY.md",
    "FOLDER_STRUCTURE_CORRECTED.md",
    "ALL_PROJECTS_REORGANIZATION_COMPLETE.md",
    "db/BASELINE_SEEDING_COMPLETE.md",
    "db/ISOLATION_COMPLETE.md",
    "db/VIEW_MIGRATION_COMPLETE.md",
    "db/REDUCED_SCHEMA_COMPLETE.md",
    "db/db/VIEW_MIGRATION_COMPLETE.md",
    "db/db/REDUCED_SCHEMA_COMPLETE.md",
    "db/db/ISOLATION_COMPLETE.md",
    
    # Deprecated/old docs
    "docs/DEPRECATED_REPO_EXTRACTION_PLAN.md",
    "WATCHER_FIX_SUMMARY.md",
]


def delete_files(repo_path: str, files: list, repo_name: str):
    """Delete files from a repository."""
    deleted = []
    not_found = []
    errors = []
    
    for file_path in files:
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
    
    return deleted, not_found, errors


def main():
    """Main execution."""
    print("=" * 80)
    print("DELETE OUTDATED/ORPHANED/DEPRECATED .MD FILES")
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

