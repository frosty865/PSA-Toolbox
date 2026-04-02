#!/usr/bin/env python3
"""
Clean Module Data from CORPUS source_registry

Removes all entries from CORPUS.source_registry that have module_code in scope_tags.
Module uploads should NEVER be in CORPUS - they belong in RUNTIME.module_documents only.

Usage:
    python tools/admin/clean_module_data_from_corpus.py [--apply]
"""

import os
import sys
import argparse
from pathlib import Path
from typing import List, Dict, Any

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

# Load .env.local
from dotenv import load_dotenv
env_path = project_root / ".env.local"
if env_path.exists():
    load_dotenv(env_path)
else:
    print("WARNING: .env.local not found, using environment variables")

def get_corpus_connection():
    """Get CORPUS database connection"""
    corpus_url = os.getenv("CORPUS_DATABASE_URL")
    if not corpus_url:
        raise ValueError("CORPUS_DATABASE_URL environment variable is required")
    return psycopg2.connect(corpus_url)

def find_module_entries_in_corpus(conn) -> List[Dict[str, Any]]:
    """Find all source_registry entries with module_code in scope_tags"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT 
                id,
                source_key,
                title,
                scope_tags->'tags'->>'module_code' as module_code,
                scope_tags->>'ingestion_stream' as ingestion_stream,
                doc_sha256,
                local_path,
                created_at
            FROM public.source_registry
            WHERE scope_tags->'tags'->>'module_code' IS NOT NULL
               OR (scope_tags->>'ingestion_stream') = 'MODULE'
            ORDER BY created_at DESC
        """)
        return cur.fetchall()

def delete_module_entries(conn, entry_ids: List[str], dry_run: bool = True) -> int:
    """Delete module entries from source_registry"""
    if not entry_ids:
        return 0
    
    if dry_run:
        print(f"[DRY RUN] Would delete {len(entry_ids)} entries")
        return len(entry_ids)
    
    with conn.cursor() as cur:
        # Delete in batches to avoid parameter limit
        batch_size = 100
        deleted = 0
        for i in range(0, len(entry_ids), batch_size):
            batch = entry_ids[i:i + batch_size]
            placeholders = ','.join(['%s'] * len(batch))
            cur.execute(
                f"DELETE FROM public.source_registry WHERE id IN ({placeholders})",
                batch
            )
            deleted += cur.rowcount
        
        conn.commit()
        return deleted

def main():
    parser = argparse.ArgumentParser(
        description="Clean module data from CORPUS source_registry"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually delete entries (default is dry-run)"
    )
    args = parser.parse_args()
    
    dry_run = not args.apply
    
    print("=" * 60)
    print("Clean Module Data from CORPUS source_registry")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE DELETE'}")
    print()
    
    try:
        conn = get_corpus_connection()
        
        print("[1] Finding module entries in CORPUS source_registry...")
        entries = find_module_entries_in_corpus(conn)
        
        if not entries:
            print("[OK] No module entries found in CORPUS source_registry.")
            return
        
        print(f"[FOUND] {len(entries)} module entry/entries in CORPUS source_registry:")
        print()
        
        # Group by module_code
        by_module = {}
        for entry in entries:
            module_code = entry['module_code'] or 'UNKNOWN'
            if module_code not in by_module:
                by_module[module_code] = []
            by_module[module_code].append(entry)
        
        for module_code, module_entries in sorted(by_module.items()):
            print(f"  {module_code}: {len(module_entries)} entry/entries")
            for entry in module_entries[:5]:  # Show first 5
                print(f"    - {entry['source_key']}: {entry['title']}")
            if len(module_entries) > 5:
                print(f"    ... and {len(module_entries) - 5} more")
        
        print()
        print("[2] Deleting module entries...")
        entry_ids = [str(entry['id']) for entry in entries]
        deleted = delete_module_entries(conn, entry_ids, dry_run=dry_run)
        
        if dry_run:
            print(f"[DRY RUN] Would delete {deleted} entries")
            print()
            print("To actually delete, run with --apply flag:")
            print("  python tools/admin/clean_module_data_from_corpus.py --apply")
            print()
            print("After deleting source_registry entries, archive orphaned data:")
            print("  python tools/admin/archive_orphaned_module_corpus_data.py --apply")
        else:
            print(f"[OK] Deleted {deleted} entries from CORPUS source_registry")
            print()
            print("NOTE: Associated corpus_documents and document_chunks may still exist.")
            print("      They are now orphaned. Archive them with:")
            print("      python tools/admin/archive_orphaned_module_corpus_data.py --apply")
        
        conn.close()
        
    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
