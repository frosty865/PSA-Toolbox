#!/usr/bin/env python3
"""
Import Download Manifest to Module Sources

Reads a research download manifest JSON and creates/updates module_sources rows
in the RUNTIME database. Files are copied from the research download directory
to module storage (MODULE_SOURCES_ROOT/raw/<module_code>/<uuid>_<name>), and
storage_relpath is set correctly.

Usage:
    python tools/research/import_download_manifest_to_module_sources.py \
        --module_code MODULE_EV_PARKING \
        --manifest analytics/research/MODULE_EV_PARKING_download_manifest.json

Note: Files referenced in the manifest must exist at the saved_path location.
If files are missing, the record will be created without storage_relpath.
"""

import argparse
import json
import os
import re
import shutil
import sys
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

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
    """Get RUNTIME database connection (for module_sources table)."""
    load_env_file('.env.local')
    
    # Try direct RUNTIME_DATABASE_URL first (full connection string)
    runtime_dsn = os.getenv('RUNTIME_DATABASE_URL')
    if runtime_dsn:
        return psycopg2.connect(runtime_dsn)
    
    # Fallback to SUPABASE_RUNTIME_URL + password pattern
    runtime_url = os.getenv('SUPABASE_RUNTIME_URL')
    runtime_password = os.getenv('SUPABASE_RUNTIME_DB_PASSWORD')
    
    if runtime_url and runtime_password:
        clean_password = runtime_password.strip().strip('"').strip("'").replace('\\', '')
        clean_url = runtime_url.strip().strip('"').strip("'").replace('\\', '').replace(' ', '')
        url = urlparse(clean_url)
        project_ref = url.hostname.split('.')[0] if url.hostname else None
        if not project_ref:
            raise ValueError(f"Could not parse project_ref from SUPABASE_RUNTIME_URL: {runtime_url}")
        
        # Try transaction pooler port 6543 first
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
        try:
            return psycopg2.connect(connection_string)
        except psycopg2.OperationalError:
            # Fall back to direct port 5432
            connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string)
    
    # Last resort: try DATABASE_URL
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        return psycopg2.connect(database_url)
    
    raise ValueError('Missing RUNTIME_DATABASE_URL or (SUPABASE_RUNTIME_URL + SUPABASE_RUNTIME_DB_PASSWORD)')


def extract_label_from_url(url: str) -> str:
    """Extract a label from URL for display."""
    parsed = urlparse(url)
    path = parsed.path
    
    # Use filename stem if available
    if path:
        stem = Path(path).stem
        if stem and stem not in ['', 'index', 'default']:
            return stem.replace('-', ' ').replace('_', ' ').title()
    
    # Fallback to domain
    domain = parsed.netloc.replace('www.', '')
    return domain


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
    original_name: Optional[str] = None
) -> tuple[str, Path]:
    """
    Copy file to module storage and return (storage_relpath, dest_path).
    
    Format: raw/<module_code_safe>/<uuid>_<name>
    """
    if not source_path.exists():
        raise FileNotFoundError(f"Source file not found: {source_path}")
    
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
    
    # Ensure destination directory exists
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Copy file
    shutil.copy2(source_path, dest_path)
    
    return storage_relpath, dest_path


def main():
    parser = argparse.ArgumentParser(
        description='Import download manifest into module_sources table'
    )
    parser.add_argument(
        '--module_code',
        required=True,
        help='Module code (e.g., MODULE_EV_PARKING)'
    )
    parser.add_argument(
        '--manifest',
        required=True,
        help='Path to download manifest JSON'
    )
    
    args = parser.parse_args()
    
    # Load manifest
    manifest_path = Path(args.manifest)
    if not manifest_path.exists():
        print(f"ERROR: Manifest file not found: {manifest_path}", file=sys.stderr)
        sys.exit(1)
    
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    
    module_code = args.module_code.strip().upper()
    
    # Verify module_code matches manifest
    if manifest.get('module_code') and manifest.get('module_code') != module_code:
        print(f"WARNING: Manifest module_code ({manifest.get('module_code')}) != provided module_code ({module_code})")
        print(f"Using provided module_code: {module_code}")
    
    downloaded = manifest.get('downloaded', [])
    failed = manifest.get('failed', [])
    
    if not downloaded and not failed:
        print("ERROR: No downloaded or failed entries in manifest", file=sys.stderr)
        sys.exit(1)
    
    print(f"[IMPORT] Processing {len(downloaded)} downloaded + {len(failed)} failed entries for {module_code}")
    
    # Connect to RUNTIME database
    conn = get_runtime_db_connection()
    cur = conn.cursor()
    
    try:
        # Verify module exists
        cur.execute("""
            SELECT module_code FROM public.assessment_modules
            WHERE module_code = %s
        """, (module_code,))
        
        if not cur.fetchone():
            print(f"ERROR: Module {module_code} not found in assessment_modules", file=sys.stderr)
            sys.exit(1)
        
        imported = 0
        updated = 0
        
        # Process downloaded entries
        for item in downloaded:
            url = item.get('url', '')
            saved_path = item.get('saved_path', '')
            sha256 = item.get('sha256', '')
            content_type = item.get('content_type', '')
            
            if not url:
                continue
            
            source_label = extract_label_from_url(url)
            
            # Check if exists by URL or sha256
            cur.execute("""
                SELECT id, fetch_status, storage_relpath FROM public.module_sources
                WHERE module_code = %s AND (source_url = %s OR sha256 = %s)
                LIMIT 1
            """, (module_code, url, sha256))
            
            existing = cur.fetchone()
            
            # Copy file to module storage if saved_path is provided
            storage_relpath = None
            if saved_path:
                source_file = Path(saved_path)
                if not source_file.is_absolute():
                    # If relative, assume it's relative to the manifest's directory
                    source_file = manifest_path.parent / source_file
                
                if source_file.exists():
                    try:
                        # Extract original filename from URL if possible
                        parsed_url = urlparse(url)
                        original_name = Path(parsed_url.path).name if parsed_url.path else None
                        
                        storage_relpath, _ = copy_to_module_storage(
                            source_file,
                            module_code,
                            original_name
                        )
                        print(f"  [COPY] {source_file.name} -> {storage_relpath}")
                    except Exception as e:
                        print(f"  [WARN] Failed to copy {saved_path}: {e}", file=sys.stderr)
                        # Continue without storage_relpath - file might be missing
                else:
                    print(f"  [WARN] Source file not found: {source_file}", file=sys.stderr)
            
            if existing:
                source_id = existing[0]
                existing_storage_relpath = existing[2] if len(existing) > 2 else None
                
                # Only update storage_relpath if we successfully copied a new file
                # and the existing record doesn't have one
                update_storage_relpath = storage_relpath if storage_relpath and not existing_storage_relpath else None
                
                # Update if status changed or new info available
                if update_storage_relpath:
                    cur.execute("""
                        UPDATE public.module_sources
                        SET 
                            source_type = 'MODULE_UPLOAD',
                            fetch_status = 'DOWNLOADED',
                            content_type = COALESCE(%s, content_type),
                            file_path = COALESCE(%s, file_path),
                            storage_relpath = %s,
                            sha256 = COALESCE(%s, sha256),
                            fetched_at = COALESCE(%s, fetched_at),
                            fetch_error = NULL
                        WHERE id = %s
                    """, (
                        content_type if content_type else None,
                        saved_path if saved_path else None,
                        update_storage_relpath,
                        sha256 if sha256 else None,
                        item.get('fetched_at_utc'),
                        source_id
                    ))
                else:
                    cur.execute("""
                        UPDATE public.module_sources
                        SET 
                            source_type = 'MODULE_UPLOAD',
                            fetch_status = 'DOWNLOADED',
                            content_type = COALESCE(%s, content_type),
                            file_path = COALESCE(%s, file_path),
                            sha256 = COALESCE(%s, sha256),
                            fetched_at = COALESCE(%s, fetched_at),
                            fetch_error = NULL
                        WHERE id = %s
                    """, (
                        content_type if content_type else None,
                        saved_path if saved_path else None,
                        sha256 if sha256 else None,
                        item.get('fetched_at_utc'),
                        source_id
                    ))
                updated += 1
            else:
                # Insert new
                cur.execute("""
                    INSERT INTO public.module_sources
                    (module_code, source_type, source_url, source_label, content_type, file_path, storage_relpath, sha256, fetch_status, fetched_at)
                    VALUES (%s, 'MODULE_UPLOAD', %s, %s, %s, %s, %s, %s, 'DOWNLOADED', %s)
                    RETURNING id
                """, (
                    module_code,
                    url,
                    source_label,
                    content_type if content_type else None,
                    saved_path if saved_path else None,
                    storage_relpath,
                    sha256 if sha256 else None,
                    item.get('fetched_at_utc')
                ))
                imported += 1
        
        # Process failed entries
        for item in failed:
            url = item.get('url', '')
            error = item.get('error', 'Unknown error')
            
            if not url:
                continue
            
            source_label = extract_label_from_url(url)
            
            # Check if exists
            cur.execute("""
                SELECT id FROM public.module_sources
                WHERE module_code = %s AND source_url = %s
                LIMIT 1
            """, (module_code, url))
            
            existing = cur.fetchone()
            
            if existing:
                # Update to FAILED
                cur.execute("""
                    UPDATE public.module_sources
                    SET fetch_status = 'FAILED', fetch_error = %s
                    WHERE id = %s
                """, (str(error)[:500], existing[0]))
            else:
                # Insert as FAILED
                cur.execute("""
                    INSERT INTO public.module_sources
                    (module_code, source_url, source_label, fetch_status, fetch_error)
                    VALUES (%s, %s, %s, %s, %s)
                """, (module_code, url, source_label, 'FAILED', str(error)[:500]))
                imported += 1
        
        conn.commit()
        
        print(f"\n[SUMMARY]")
        print(f"  Imported: {imported} new sources")
        print(f"  Updated: {updated} existing sources")
        print(f"  Total processed: {len(downloaded) + len(failed)}")
        
    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
