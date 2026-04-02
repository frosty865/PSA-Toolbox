#!/usr/bin/env python3
"""
Search and destroy empty folders across all 3 repos.

This script:
1. Finds all empty directories
2. Excludes protected directories (venv, node_modules, .git, etc.)
3. Deletes empty folders
"""

import os
import sys
from pathlib import Path

# Directories to exclude from deletion
EXCLUDE_PATTERNS = [
    'venv',
    'node_modules',
    '.git',
    '__pycache__',
    '.next',
    '.vscode',
    '.idea',
    'dist',
    'build',
    '.pytest_cache',
    '.mypy_cache',
    'coverage',
    '.nyc_output',
    'site-packages',
    'Scripts',  # Windows venv scripts
    'Include',  # Windows venv include
    'Lib',  # Windows venv lib
    'pyvenv.cfg',
]

# Directories that should be kept even if empty (runtime directories)
KEEP_EMPTY = [
    'analytics/incoming',
    'analytics/processed',
    'analytics/library',
    'app/processing',
    # ⚠️ DEPRECATED: Tech_Sources removed. Use PSA_PIPELINE_ROOT instead.
    # 'Tech_Sources/incoming',  # DEPRECATED
    # 'Tech_Sources/processed',  # DEPRECATED
    'logs',
]


def should_exclude(path: Path) -> bool:
    """Check if path should be excluded from deletion."""
    path_str = str(path).replace('\\', '/')
    
    # Check exclude patterns
    for pattern in EXCLUDE_PATTERNS:
        if pattern in path_str:
            return True
    
    # Check keep empty list
    for keep_pattern in KEEP_EMPTY:
        if keep_pattern in path_str:
            return True
    
    return False


def is_empty_directory(path: Path) -> bool:
    """Check if directory is empty (no files, only empty subdirectories)."""
    if not path.is_dir():
        return False
    
    try:
        items = list(path.iterdir())
        if len(items) == 0:
            return True
        
        # Check if all items are empty subdirectories
        for item in items:
            if item.is_file():
                return False
            if item.is_dir():
                if not is_empty_directory(item):
                    return False
        
        return True
    except PermissionError:
        return False
    except Exception:
        return False


def find_empty_directories(root_path: Path) -> list[Path]:
    """Find all empty directories in root_path."""
    empty_dirs = []
    
    if not root_path.exists() or not root_path.is_dir():
        return empty_dirs
    
    # Walk directory tree
    for dirpath, dirnames, filenames in os.walk(root_path, topdown=False):
        dir_path = Path(dirpath)
        
        # Skip excluded directories
        if should_exclude(dir_path):
            continue
        
        # Check if directory is empty
        if is_empty_directory(dir_path):
            empty_dirs.append(dir_path)
    
    return empty_dirs


def delete_empty_directories(empty_dirs: list[Path], repo_name: str) -> tuple[list, list]:
    """Delete empty directories."""
    deleted = []
    errors = []
    
    for dir_path in empty_dirs:
        try:
            # Double-check it's still empty before deleting
            if is_empty_directory(dir_path):
                dir_path.rmdir()
                deleted.append(dir_path)
                print(f"  ✓ Deleted: {dir_path.relative_to(dir_path.parts[0])}")
            else:
                print(f"  ⚠ Skipped (no longer empty): {dir_path.relative_to(dir_path.parts[0])}")
        except OSError as e:
            errors.append((dir_path, str(e)))
            print(f"  ✗ Error deleting {dir_path.relative_to(dir_path.parts[0])}: {e}")
        except Exception as e:
            errors.append((dir_path, str(e)))
            print(f"  ✗ Unexpected error deleting {dir_path.relative_to(dir_path.parts[0])}: {e}")
    
    return deleted, errors


def main():
    """Main execution."""
    print("=" * 80)
    print("SEARCH AND DESTROY EMPTY FOLDERS")
    print("=" * 80)
    print()
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    workspace_root = Path(script_dir).parent.parent
    
    psa_rebuild_path = workspace_root / 'psa_rebuild'
    psa_engine_path = workspace_root / 'psa_engine'
    psaback_path = workspace_root / 'psaback'
    
    all_deleted = []
    all_errors = []
    
    # Process psa_rebuild
    if psa_rebuild_path.exists():
        print("Scanning psa_rebuild for empty directories...")
        empty_dirs = find_empty_directories(psa_rebuild_path)
        print(f"Found {len(empty_dirs)} empty directories")
        
        if empty_dirs:
            print("\nDeleting empty directories...")
            deleted, errors = delete_empty_directories(empty_dirs, "psa_rebuild")
            all_deleted.extend([f"psa_rebuild/{d.relative_to(psa_rebuild_path)}" for d in deleted])
            all_errors.extend([(f"psa_rebuild/{d.relative_to(psa_rebuild_path)}", e) for d, e in errors])
            print(f"\npsa_rebuild: Deleted {len(deleted)}, Errors: {len(errors)}")
        else:
            print("No empty directories found")
    else:
        print("⚠ psa_rebuild not found")
    
    print()
    
    # Process psa_engine
    if psa_engine_path.exists():
        print("Scanning psa_engine for empty directories...")
        empty_dirs = find_empty_directories(psa_engine_path)
        print(f"Found {len(empty_dirs)} empty directories")
        
        if empty_dirs:
            print("\nDeleting empty directories...")
            deleted, errors = delete_empty_directories(empty_dirs, "psa_engine")
            all_deleted.extend([f"psa_engine/{d.relative_to(psa_engine_path)}" for d in deleted])
            all_errors.extend([(f"psa_engine/{d.relative_to(psa_engine_path)}", e) for d, e in errors])
            print(f"\npsa_engine: Deleted {len(deleted)}, Errors: {len(errors)}")
        else:
            print("No empty directories found")
    else:
        print("⚠ psa_engine not found")
    
    print()
    
    # Process psaback
    if psaback_path.exists():
        print("Scanning psaback for empty directories...")
        empty_dirs = find_empty_directories(psaback_path)
        print(f"Found {len(empty_dirs)} empty directories")
        
        if empty_dirs:
            print("\nDeleting empty directories...")
            deleted, errors = delete_empty_directories(empty_dirs, "psaback")
            all_deleted.extend([f"psaback/{d.relative_to(psaback_path)}" for d in deleted])
            all_errors.extend([(f"psaback/{d.relative_to(psaback_path)}", e) for d, e in errors])
            print(f"\npsaback: Deleted {len(deleted)}, Errors: {len(errors)}")
        else:
            print("No empty directories found")
    else:
        print("⚠ psaback not found")
    
    # Final summary
    print("\n" + "=" * 80)
    print("FINAL SUMMARY")
    print("=" * 80)
    print(f"Total empty directories deleted: {len(all_deleted)}")
    print(f"Total errors: {len(all_errors)}")
    
    if all_errors:
        print("\nErrors:")
        for dir_path, error in all_errors[:10]:  # Show first 10
            print(f"  {dir_path}: {error}")
        if len(all_errors) > 10:
            print(f"  ... and {len(all_errors) - 10} more errors")


if __name__ == '__main__':
    main()

