#!/usr/bin/env python3
"""
Clean Non-Ingested Module Sources

Removes module_sources entries that have not been ingested into CORPUS.
A source is considered "ingested" if it has a corresponding entry in 
CORPUS.module_source_documents.

Non-ingested sources are those that:
- Have source_type = 'MODULE_UPLOAD'
- Have storage_relpath IS NOT NULL
- Do NOT have an entry in module_source_documents

Usage:
    python tools/admin/clean_non_ingested_module_sources.py [--module-code MODULE_EV_PARKING] [--apply] [--dry-run]
"""

import argparse
import os
import sys
from pathlib import Path
from typing import List, Dict, Optional

# Project root (psa_rebuild)
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

# Load .env.local first
def _load_env():
    for p in (project_root / ".env.local", project_root / ".local.env"):
        if p.exists():
            with open(p, "r") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ[k.strip()] = v.strip().strip('"').strip("'")
    return

_load_env()

import psycopg2
from psycopg2.extras import RealDictCursor


def get_runtime_conn():
    """Get RUNTIME database connection."""
    dsn = os.environ.get("RUNTIME_DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    
    from urllib.parse import urlparse
    url = os.environ.get("SUPABASE_RUNTIME_URL")
    pw = os.environ.get("SUPABASE_RUNTIME_DB_PASSWORD")
    if not url or not pw:
        raise RuntimeError(
            "Set RUNTIME_DATABASE_URL or (SUPABASE_RUNTIME_URL and SUPABASE_RUNTIME_DB_PASSWORD)"
        )
    clean = pw.strip().strip('"').strip("'").replace("\\", "")
    u = urlparse(url.strip().strip('"').replace("\\", ""))
    ref = u.hostname.split(".")[0] if u.hostname else None
    if not ref:
        raise ValueError("Could not parse project_ref from SUPABASE_RUNTIME_URL")
    dsn = f"postgresql://postgres.{ref}:{clean}@{u.hostname}:{u.port or 5432}/postgres"
    return psycopg2.connect(dsn)


def get_corpus_conn():
    """Get CORPUS database connection."""
    dsn = os.environ.get("CORPUS_DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    
    from urllib.parse import urlparse
    url = os.environ.get("SUPABASE_CORPUS_URL")
    pw = os.environ.get("SUPABASE_CORPUS_DB_PASSWORD")
    if not url or not pw:
        raise RuntimeError(
            "Set CORPUS_DATABASE_URL or (SUPABASE_CORPUS_URL and SUPABASE_CORPUS_DB_PASSWORD)"
        )
    clean = pw.strip().strip('"').strip("'").replace("\\", "")
    u = urlparse(url.strip().strip('"').replace("\\", ""))
    ref = u.hostname.split(".")[0] if u.hostname else None
    if not ref:
        raise ValueError("Could not parse project_ref from SUPABASE_CORPUS_URL")
    dsn = f"postgresql://postgres.{ref}:{clean}@{u.hostname}:{u.port or 5432}/postgres"
    return psycopg2.connect(dsn)


def find_non_ingested_sources(
    runtime_conn,
    corpus_conn,
    module_code: Optional[str] = None
) -> List[Dict]:
    """
    Find module_sources that have not been ingested.
    
    A source is non-ingested if:
    - source_type = 'MODULE_UPLOAD'
    - storage_relpath IS NOT NULL
    - No entry in CORPUS.module_source_documents
    """
    with runtime_conn.cursor(cursor_factory=RealDictCursor) as rcur:
        # Get all MODULE_UPLOAD sources with storage_relpath
        query = """
            SELECT 
                id,
                module_code,
                source_label,
                source_url,
                storage_relpath,
                sha256,
                content_type,
                created_at
            FROM public.module_sources
            WHERE source_type = 'MODULE_UPLOAD'
                AND storage_relpath IS NOT NULL
        """
        params = []
        
        if module_code:
            query += " AND module_code = %s"
            params.append(module_code)
        
        query += " ORDER BY module_code, created_at"
        
        rcur.execute(query, params)
        all_sources = rcur.fetchall()
    
    if not all_sources:
        return []
    
    # Get all ingested module_source_ids from CORPUS
    with corpus_conn.cursor() as ccur:
        # Get list of module_source_ids that have been ingested
        # Note: module_source_id is stored as TEXT in CORPUS (cross-database reference)
        ingested_ids = set()
        
        # Check if module_source_documents table exists
        ccur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'module_source_documents'
            )
        """)
        table_exists = ccur.fetchone()[0]
        
        if table_exists:
            # Get all module_source_ids that have been ingested
            ccur.execute("""
                SELECT DISTINCT module_source_id::text
                FROM public.module_source_documents
                WHERE module_source_id IS NOT NULL
            """)
            ingested_ids = {str(row[0]) for row in ccur.fetchall()}
    
    # Filter to non-ingested sources
    non_ingested = [
        dict(row) for row in all_sources
        if str(row['id']) not in ingested_ids
    ]
    
    return non_ingested


def delete_sources(
    runtime_conn,
    source_ids: List[str],
    dry_run: bool = False
) -> int:
    """Delete module_sources by IDs."""
    if not source_ids:
        return 0
    
    if dry_run:
        print(f"[DRY-RUN] Would delete {len(source_ids)} module_sources")
        return 0
    
    with runtime_conn.cursor() as cur:
        # Delete in batches to avoid parameter limit
        batch_size = 100
        deleted = 0
        
        for i in range(0, len(source_ids), batch_size):
            batch = source_ids[i:i + batch_size]
            placeholders = ",".join(["%s"] * len(batch))
            cur.execute(
                f"DELETE FROM public.module_sources WHERE id IN ({placeholders})",
                batch
            )
            deleted += cur.rowcount
        
        runtime_conn.commit()
        return deleted


def main():
    parser = argparse.ArgumentParser(
        description="Clean non-ingested module sources from module_sources table"
    )
    parser.add_argument(
        "--module-code",
        help="Filter by specific module code (e.g., MODULE_EV_PARKING). If not provided, cleans all modules."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually delete the sources (default is dry-run)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be deleted without actually deleting (default behavior)"
    )
    args = parser.parse_args()
    
    dry_run = not args.apply
    
    if args.apply and args.dry_run:
        parser.error("Cannot use both --apply and --dry-run")
    
    print(f"\n{'='*60}")
    print("Clean Non-Ingested Module Sources")
    print(f"{'='*60}")
    print(f"Mode: {'DRY-RUN' if dry_run else 'LIVE DELETE'}")
    if args.module_code:
        print(f"Module filter: {args.module_code}")
    else:
        print("Module filter: ALL modules")
    print(f"{'='*60}\n")
    
    try:
        runtime_conn = get_runtime_conn()
        corpus_conn = get_corpus_conn()
    except Exception as e:
        print(f"[ERROR] Failed to connect to databases: {e}")
        return 1
    
    try:
        # Find non-ingested sources
        print("[1] Finding non-ingested module sources...")
        non_ingested = find_non_ingested_sources(
            runtime_conn,
            corpus_conn,
            module_code=args.module_code
        )
        
        if not non_ingested:
            print("[OK] No non-ingested sources found.")
            return 0
        
        # Group by module_code for reporting
        by_module = {}
        for source in non_ingested:
            mod_code = source['module_code']
            if mod_code not in by_module:
                by_module[mod_code] = []
            by_module[mod_code].append(source)
        
        print(f"\n[FOUND] {len(non_ingested)} non-ingested sources across {len(by_module)} module(s):\n")
        
        for mod_code, sources in sorted(by_module.items()):
            print(f"  {mod_code}: {len(sources)} sources")
            for src in sources[:5]:  # Show first 5
                label = src.get('source_label') or src.get('source_url') or 'Unknown'
                relpath = src.get('storage_relpath') or 'N/A'
                print(f"    - {label[:60]} ({relpath[:40]})")
            if len(sources) > 5:
                print(f"    ... and {len(sources) - 5} more")
        
        # Delete sources
        print(f"\n[2] {'Would delete' if dry_run else 'Deleting'} {len(non_ingested)} sources...")
        source_ids = [str(s['id']) for s in non_ingested]
        deleted = delete_sources(runtime_conn, source_ids, dry_run=dry_run)
        
        if dry_run:
            print(f"\n[DRY-RUN] Would delete {deleted} sources.")
            print("Run with --apply to actually delete.")
        else:
            print(f"\n[OK] Deleted {deleted} non-ingested module sources.")
        
        return 0
        
    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        runtime_conn.close()
        corpus_conn.close()


if __name__ == "__main__":
    sys.exit(main())
