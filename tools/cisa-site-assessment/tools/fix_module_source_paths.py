#!/usr/bin/env python3
"""
Fix Module Source Storage Paths

Fixes module_sources records with invalid storage_relpath values.
Attempts to locate and copy files from research download directories to proper module storage.

Usage:
    python tools/fix_module_source_paths.py [--module-code MODULE_EV_PARKING] [--dry-run]
"""

import argparse
import os
import re
import shutil
import sys
import uuid
from pathlib import Path
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import psycopg2
from urllib.parse import urlparse


def load_env_file(filepath: str):
    """Load environment variables from .env.local file."""
    if not os.path.exists(filepath):
        return
    
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip().strip('"').strip("'")


def get_runtime_db_connection():
    """Get RUNTIME database connection."""
    load_env_file('.env.local')
    
    runtime_dsn = os.getenv('RUNTIME_DATABASE_URL')
    if runtime_dsn:
        return psycopg2.connect(runtime_dsn)
    
    runtime_url = os.getenv('SUPABASE_RUNTIME_URL')
    runtime_password = os.getenv('SUPABASE_RUNTIME_DB_PASSWORD')
    
    if runtime_url and runtime_password:
        clean_password = runtime_password.strip().strip('"').strip("'").replace('\\', '')
        clean_url = runtime_url.strip().strip('"').strip("'").replace('\\', '').replace(' ', '')
        url = urlparse(clean_url)
        project_ref = url.hostname.split('.')[0] if url.hostname else None
        if not project_ref:
            raise ValueError(f"Could not parse project_ref from SUPABASE_RUNTIME_URL: {runtime_url}")
        
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
        try:
            return psycopg2.connect(connection_string)
        except psycopg2.OperationalError:
            connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string)
    
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        return psycopg2.connect(database_url)
    
    raise ValueError('Missing RUNTIME_DATABASE_URL or (SUPABASE_RUNTIME_URL + SUPABASE_RUNTIME_DB_PASSWORD)')


def get_module_sources_root() -> Path:
    """Get MODULE_SOURCES_ROOT from env or default."""
    root = os.getenv('MODULE_SOURCES_ROOT', 'storage/module_sources')
    root_path = Path(root)
    if not root_path.is_absolute():
        root_path = Path.cwd() / root_path
    return root_path


def sanitize_basename(name: str) -> str:
    """Sanitize filename for storage."""
    return re.sub(r'[^a-zA-Z0-9._-]', '_', name)


def copy_to_module_storage(
    source_path: Path,
    module_code: str,
    original_name: Optional[str] = None,
    dry_run: bool = False
) -> tuple[Optional[str], Path]:
    """
    Copy file to module storage and return (storage_relpath, dest_path).
    
    Format: raw/<module_code_safe>/<uuid>_<name>
    """
    if not source_path.exists():
        return None, source_path
    
    # Sanitize module code
    safe_code = re.sub(r'[^a-zA-Z0-9_-]', '_', module_code)
    
    # Get original filename or use source path name
    if original_name:
        name = original_name
    else:
        name = source_path.name
    
    # Sanitize filename
    sanitized_name = sanitize_basename(name)
    
    # Generate unique filename: <uuid>_<name>
    uniq = f"{uuid.uuid4().hex[:12]}_{sanitized_name}"
    
    # Build storage_relpath: raw/<module_code>/<uniq>
    storage_relpath = f"raw/{safe_code}/{uniq}"
    
    # Get module storage root
    module_root = get_module_sources_root()
    dest_path = module_root / storage_relpath
    
    if not dry_run:
        # Ensure destination directory exists
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Copy file
        shutil.copy2(source_path, dest_path)
    
    return storage_relpath, dest_path


def find_file_by_path(candidate_path: str, cwd: Path) -> Optional[Path]:
    """Try to find a file given a path (absolute or relative)."""
    path = Path(candidate_path)
    
    # If absolute, check directly
    if path.is_absolute():
        if path.exists():
            return path
        return None
    
    # Try relative to cwd
    rel_path = cwd / path
    if rel_path.exists():
        return rel_path
    
    # Try common research download locations
    # Also check for psa-workspace paths (legacy)
    common_roots = [
        Path.cwd() / 'downloads' / 'research',
        Path.cwd() / 'analytics' / 'research',
        Path.cwd() / 'storage' / 'downloads' / 'research',
        # Legacy psa-workspace locations (if they exist)
        Path('D:/psa-workspace') / 'downloads' / 'research' if Path('D:/psa-workspace').exists() else None,
        Path('D:/psa-workspace') / 'analytics' / 'research' if Path('D:/psa-workspace').exists() else None,
    ]
    
    # Filter out None values
    common_roots = [r for r in common_roots if r is not None]
    
    for root in common_roots:
        candidate = root / path
        if candidate.exists():
            return candidate
    
    return None


def main():
    parser = argparse.ArgumentParser(
        description='Fix module_sources records with invalid storage_relpath'
    )
    parser.add_argument(
        '--module-code',
        help='Module code to fix (e.g., MODULE_EV_PARKING). If not provided, fixes all modules.'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be done without making changes'
    )
    
    args = parser.parse_args()
    
    conn = get_runtime_db_connection()
    cur = conn.cursor()
    
    try:
        # Find records with invalid storage_relpath
        # Invalid paths are those that:
        # - Don't start with "raw/"
        # - Contain "downloads/research" or "downloads\research"
        # - Point to "psa-workspace" (old workspace)
        # Note: Use %% to escape % in LIKE clauses for psycopg2
        query = """
            SELECT 
                id,
                module_code,
                source_label,
                source_url,
                storage_relpath,
                file_path,
                fetch_status
            FROM public.module_sources
            WHERE source_type = 'MODULE_UPLOAD'
                AND storage_relpath IS NOT NULL
                AND (
                    storage_relpath NOT LIKE 'raw/%%'
                    OR storage_relpath LIKE '%%downloads%%research%%'
                    OR storage_relpath LIKE '%%psa-workspace%%'
                    OR file_path LIKE '%%psa-workspace%%'
                )
        """
        
        params = []
        if args.module_code:
            query += " AND module_code = %s"
            params.append(args.module_code.upper())
        
        query += " ORDER BY module_code, created_at"
        
        try:
            cur.execute(query, params if params else None)
            rows = cur.fetchall()
        except Exception as e:
            print(f"[ERROR] Query execution failed: {e}", file=sys.stderr)
            print(f"[DEBUG] Query: {query}", file=sys.stderr)
            print(f"[DEBUG] Params: {params}", file=sys.stderr)
            raise
        
        if not rows:
            print("[INFO] No records with invalid storage_relpath found.")
            return
        
        print(f"[INFO] Found {len(rows)} records with invalid storage_relpath\n")
        
        fixed = 0
        not_found = 0
        errors = 0
        
        cwd = Path.cwd()
        
        for row in rows:
            source_id, module_code, source_label, source_url, storage_relpath, file_path, fetch_status = row
            
            print(f"\n[PROCESSING] {module_code}: {source_label}")
            print(f"  Current storage_relpath: {storage_relpath}")
            print(f"  file_path: {file_path or '(null)'}")
            
            # Try to find the file
            source_file = None
            
            # First try file_path if available
            if file_path:
                source_file = find_file_by_path(file_path, cwd)
            
            # If not found, try storage_relpath (might be absolute or relative)
            if not source_file and storage_relpath:
                source_file = find_file_by_path(storage_relpath, cwd)
            
            # If still not found, try to construct from common patterns
            if not source_file and storage_relpath:
                # Try to extract filename from storage_relpath
                path_parts = Path(storage_relpath).parts
                if len(path_parts) > 0:
                    filename = path_parts[-1]
                    # Try common locations (including legacy psa-workspace)
                    search_roots = [
                        Path.cwd() / 'downloads' / 'research',
                        Path.cwd() / 'analytics' / 'research',
                    ]
                    # Add psa-workspace if it exists
                    if Path('D:/psa-workspace').exists():
                        search_roots.extend([
                            Path('D:/psa-workspace') / 'downloads' / 'research',
                            Path('D:/psa-workspace') / 'analytics' / 'research',
                        ])
                    
                    for root in search_roots:
                        candidate = root / module_code / filename
                        if candidate.exists():
                            source_file = candidate
                            break
                    
                    # Also try without module_code subdirectory (direct filename match)
                    if not source_file:
                        for root in search_roots:
                            # Try direct filename match in research root
                            candidate = root / filename
                            if candidate.exists():
                                source_file = candidate
                                break
            
            if not source_file:
                print(f"  [SKIP] File not found - cannot fix")
                not_found += 1
                if not args.dry_run:
                    # Mark as having invalid path
                    cur.execute("""
                        UPDATE public.module_sources
                        SET fetch_status = 'FAILED',
                            fetch_error = 'File not found at expected location'
                        WHERE id = %s
                    """, (source_id,))
                continue
            
            print(f"  [FOUND] {source_file}")
            
            # Copy to module storage
            try:
                # Extract original filename from URL if possible
                original_name = None
                if source_url:
                    from urllib.parse import urlparse
                    parsed = urlparse(source_url)
                    if parsed.path:
                        original_name = Path(parsed.path).name
                
                new_storage_relpath, dest_path = copy_to_module_storage(
                    source_file,
                    module_code,
                    original_name,
                    dry_run=args.dry_run
                )
                
                if new_storage_relpath:
                    print(f"  [COPY] -> {new_storage_relpath}")
                    
                    if not args.dry_run:
                        cur.execute("""
                            UPDATE public.module_sources
                            SET storage_relpath = %s,
                                fetch_status = 'DOWNLOADED',
                                fetch_error = NULL
                            WHERE id = %s
                        """, (new_storage_relpath, source_id))
                        fixed += 1
                    else:
                        print(f"  [DRY-RUN] Would update storage_relpath to: {new_storage_relpath}")
                        fixed += 1
                else:
                    print(f"  [ERROR] Failed to copy file")
                    errors += 1
                    
            except Exception as e:
                print(f"  [ERROR] {e}")
                errors += 1
        
        if not args.dry_run:
            conn.commit()
            print(f"\n[SUMMARY]")
            print(f"  Fixed: {fixed}")
            print(f"  Not found: {not_found}")
            print(f"  Errors: {errors}")
        else:
            print(f"\n[DRY-RUN SUMMARY]")
            print(f"  Would fix: {fixed}")
            print(f"  Not found: {not_found}")
            print(f"  Errors: {errors}")
            print(f"\nRun without --dry-run to apply changes.")
        
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
