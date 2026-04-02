#!/usr/bin/env python3
"""
Archive Orphaned Module Corpus Data

After cleaning module entries from source_registry, there may be orphaned
corpus_documents and document_chunks that were created during incorrect module ingestion.

This script:
1. Finds corpus_documents linked to deleted/module source_registry entries
2. Finds document_chunks linked to those corpus_documents
3. Archives them to archive_corpus_documents and archive_document_chunks
4. Optionally deletes the archived data

Usage:
    python tools/admin/archive_orphaned_module_corpus_data.py [--apply] [--delete]
"""

import os
import sys
import argparse
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

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
try:
    from dotenv import load_dotenv
    env_path = project_root / ".env.local"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass

def get_corpus_connection():
    """Get CORPUS database connection"""
    corpus_url = os.getenv("CORPUS_DATABASE_URL")
    if not corpus_url:
        raise ValueError("CORPUS_DATABASE_URL environment variable is required")
    return psycopg2.connect(corpus_url)

def create_archive_tables(conn, dry_run: bool = True):
    """Create archive tables if they don't exist"""
    if dry_run:
        print("[DRY RUN] Would create archive tables if they don't exist")
        return
    
    with conn.cursor() as cur:
        # Create archive schema if it doesn't exist
        cur.execute("CREATE SCHEMA IF NOT EXISTS archive")
        
        # Create archive_corpus_documents table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS archive.archive_corpus_documents (
                LIKE public.corpus_documents INCLUDING ALL
            )
        """)
        
        # Add archive metadata columns
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'archive' 
                    AND table_name = 'archive_corpus_documents'
                    AND column_name = 'archived_at'
                ) THEN
                    ALTER TABLE archive.archive_corpus_documents
                    ADD COLUMN archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
                END IF;
                
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'archive' 
                    AND table_name = 'archive_corpus_documents'
                    AND column_name = 'archive_reason'
                ) THEN
                    ALTER TABLE archive.archive_corpus_documents
                    ADD COLUMN archive_reason TEXT;
                END IF;
            END $$;
        """)
        
        # Create archive_document_chunks table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS archive.archive_document_chunks (
                LIKE public.document_chunks INCLUDING ALL
            )
        """)
        
        # Add archive metadata columns
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'archive' 
                    AND table_name = 'archive_document_chunks'
                    AND column_name = 'archived_at'
                ) THEN
                    ALTER TABLE archive.archive_document_chunks
                    ADD COLUMN archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
                END IF;
                
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'archive' 
                    AND table_name = 'archive_document_chunks'
                    AND column_name = 'archive_reason'
                ) THEN
                    ALTER TABLE archive.archive_document_chunks
                    ADD COLUMN archive_reason TEXT;
                END IF;
            END $$;
        """)
        
        conn.commit()
        print("[OK] Archive tables created/verified")

def find_orphaned_documents(conn) -> List[Dict[str, Any]]:
    """Find corpus_documents linked to module source_registry entries or orphaned"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Find documents linked to module source_registry entries
        # OR documents with source_registry_id that no longer exists
        cur.execute("""
            SELECT 
                cd.id,
                cd.source_registry_id,
                cd.inferred_title as title,
                cd.canonical_path as file_path,
                cd.file_hash,
                cd.processing_status,
                cd.chunk_count,
                cd.created_at,
                CASE 
                    WHEN sr.id IS NULL THEN 'ORPHANED'
                    WHEN sr.scope_tags->'tags'->>'module_code' IS NOT NULL THEN 'MODULE_SOURCE'
                    WHEN sr.scope_tags->>'ingestion_stream' = 'MODULE' THEN 'MODULE_STREAM'
                    ELSE 'UNKNOWN'
                END as orphan_reason
            FROM public.corpus_documents cd
            LEFT JOIN public.source_registry sr ON sr.id = cd.source_registry_id
            WHERE sr.id IS NULL  -- Orphaned (source_registry deleted)
               OR sr.scope_tags->'tags'->>'module_code' IS NOT NULL  -- Module source
               OR sr.scope_tags->>'ingestion_stream' = 'MODULE'  -- Module stream
            ORDER BY cd.created_at DESC
        """)
        return cur.fetchall()

def find_orphaned_chunks(conn, document_ids: List[str]) -> List[Dict[str, Any]]:
    """Find document_chunks linked to orphaned documents"""
    if not document_ids:
        return []
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        placeholders = ','.join(['%s'] * len(document_ids))
        cur.execute(f"""
            SELECT 
                dc.chunk_id,
                dc.document_id,
                dc.chunk_index,
                dc.page_number,
                dc.chunk_text,
                dc.locator_type,
                dc.locator,
                dc.created_at
            FROM public.document_chunks dc
            WHERE dc.document_id IN ({placeholders})
            ORDER BY dc.document_id, dc.chunk_index
        """, document_ids)
        return cur.fetchall()

def archive_orphaned_data(
    conn,
    documents: List[Dict[str, Any]],
    chunks: List[Dict[str, Any]],
    dry_run: bool = True,
    delete_after_archive: bool = False
) -> Dict[str, int]:
    """Archive orphaned documents and chunks"""
    if not documents:
        return {"documents_archived": 0, "chunks_archived": 0, "documents_deleted": 0, "chunks_deleted": 0}
    
    if dry_run:
        return {
            "documents_archived": len(documents),
            "chunks_archived": len(chunks),
            "documents_deleted": len(documents) if delete_after_archive else 0,
            "chunks_deleted": len(chunks) if delete_after_archive else 0,
        }
    
    with conn.cursor() as cur:
        # Archive documents
        document_ids = [str(doc['id']) for doc in documents]
        placeholders = ','.join(['%s'] * len(document_ids))
        
        # Insert into archive table (exclude archived_at and archive_reason from source, add them explicitly)
        cur.execute(f"""
            INSERT INTO archive.archive_corpus_documents
            SELECT 
                cd.*,
                NOW() as archived_at,
                'MODULE_INGESTION_ORPHANED' as archive_reason
            FROM public.corpus_documents cd
            WHERE cd.id IN ({placeholders})
            ON CONFLICT (id) DO NOTHING
        """, document_ids)
        documents_archived = cur.rowcount
        
        # Archive chunks
        chunks_archived = 0
        if chunks:
            chunk_ids = [str(chunk['chunk_id']) for chunk in chunks]
            chunk_placeholders = ','.join(['%s'] * len(chunk_ids))
            
            cur.execute(f"""
                INSERT INTO archive.archive_document_chunks
                SELECT 
                    dc.*,
                    NOW() as archived_at,
                    'MODULE_INGESTION_ORPHANED' as archive_reason
                FROM public.document_chunks dc
                WHERE dc.chunk_id IN ({chunk_placeholders})
                ON CONFLICT (chunk_id) DO NOTHING
            """, chunk_ids)
            chunks_archived = cur.rowcount
        
        # Delete if requested (after archiving)
        documents_deleted = 0
        chunks_deleted = 0
        
        if delete_after_archive:
            # Delete chunks first (FK constraint)
            if chunks:
                cur.execute(f"""
                    DELETE FROM public.document_chunks
                    WHERE chunk_id IN ({chunk_placeholders})
                """, chunk_ids)
                chunks_deleted = cur.rowcount
            
            # Delete documents
            cur.execute(f"""
                DELETE FROM public.corpus_documents
                WHERE id IN ({placeholders})
            """, document_ids)
            documents_deleted = cur.rowcount
        
        conn.commit()
        
        return {
            "documents_archived": documents_archived,
            "chunks_archived": chunks_archived,
            "documents_deleted": documents_deleted,
            "chunks_deleted": chunks_deleted,
        }

def main():
    parser = argparse.ArgumentParser(
        description="Archive orphaned module corpus data"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually archive data (default is dry-run)"
    )
    parser.add_argument(
        "--delete",
        action="store_true",
        help="Delete archived data after archiving (requires --apply)"
    )
    args = parser.parse_args()
    
    dry_run = not args.apply
    delete_after = args.delete and args.apply
    
    print("=" * 60)
    print("Archive Orphaned Module Corpus Data")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE ARCHIVE'}")
    if delete_after:
        print(f"Delete after archive: YES")
    print()
    
    try:
        conn = get_corpus_connection()
        
        # Create archive tables
        print("[1] Creating/verifying archive tables...")
        create_archive_tables(conn, dry_run=dry_run)
        
        # Find orphaned documents
        print("[2] Finding orphaned corpus_documents...")
        documents = find_orphaned_documents(conn)
        
        if not documents:
            print("[OK] No orphaned documents found.")
            return
        
        print(f"[FOUND] {len(documents)} orphaned document(s):")
        by_reason = {}
        for doc in documents:
            reason = doc['orphan_reason']
            if reason not in by_reason:
                by_reason[reason] = []
            by_reason[reason].append(doc)
        
        for reason, docs in sorted(by_reason.items()):
            print(f"  {reason}: {len(docs)} document(s)")
            for doc in docs[:3]:  # Show first 3
                print(f"    - {doc['id']}: {doc['title']} ({doc.get('chunk_count', 0)} chunks)")
            if len(docs) > 3:
                print(f"    ... and {len(docs) - 3} more")
        
        print()
        
        # Find orphaned chunks
        print("[3] Finding orphaned document_chunks...")
        document_ids = [str(doc['id']) for doc in documents]
        chunks = find_orphaned_chunks(conn, document_ids)
        
        print(f"[FOUND] {len(chunks)} orphaned chunk(s)")
        print()
        
        # Archive data
        print("[4] Archiving orphaned data...")
        result = archive_orphaned_data(conn, documents, chunks, dry_run=dry_run, delete_after_archive=delete_after)
        
        if dry_run:
            print(f"[DRY RUN] Would archive:")
            print(f"  - {result['documents_archived']} document(s)")
            print(f"  - {result['chunks_archived']} chunk(s)")
            if delete_after:
                print(f"[DRY RUN] Would delete after archiving:")
                print(f"  - {result['documents_deleted']} document(s)")
                print(f"  - {result['chunks_deleted']} chunk(s)")
            print()
            print("To actually archive, run with --apply flag:")
            print("  python tools/admin/archive_orphaned_module_corpus_data.py --apply")
            if delete_after:
                print("To also delete after archiving:")
                print("  python tools/admin/archive_orphaned_module_corpus_data.py --apply --delete")
        else:
            print(f"[OK] Archived:")
            print(f"  - {result['documents_archived']} document(s) -> archive.archive_corpus_documents")
            print(f"  - {result['chunks_archived']} chunk(s) -> archive.archive_document_chunks")
            if delete_after:
                print(f"[OK] Deleted after archiving:")
                print(f"  - {result['documents_deleted']} document(s)")
                print(f"  - {result['chunks_deleted']} chunk(s)")
        
        conn.close()
        
    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
