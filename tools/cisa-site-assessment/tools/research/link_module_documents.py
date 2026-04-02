#!/usr/bin/env python3
"""
Module Document Linking Helper

Links ingested corpus_documents and document_chunks to modules via module research tables.
This is called after ingestion to create the module-scoped links.

Usage:
    Called internally by ingest_research_downloads.py when --module_code is provided
"""

import os
import sys
from pathlib import Path
from typing import List, Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import psycopg2
from urllib.parse import urlparse

# Import corpus connection helper
try:
    from corpus_ingest_pdf import get_corpus_db_connection
except ImportError:
    # Fallback if import fails
    def get_corpus_db_connection():
        """Get CORPUS database connection."""
        load_env_file('.env.local')
        
        corpus_url = os.getenv('SUPABASE_CORPUS_URL')
        corpus_password = os.getenv('SUPABASE_CORPUS_DB_PASSWORD')
        
        if not corpus_url or not corpus_password:
            raise ValueError('SUPABASE_CORPUS_URL and SUPABASE_CORPUS_DB_PASSWORD must be set')
        
        clean_password = corpus_password.strip().strip('"').strip("'").replace('\\', '')
        url = urlparse(corpus_url)
        project_ref = url.hostname.split('.')[0]
        
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
        try:
            return psycopg2.connect(connection_string)
        except psycopg2.OperationalError:
            connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string)


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
        from tools.db.dsn_sanitize import sanitize_psycopg2_dsn
        runtime_dsn = sanitize_psycopg2_dsn(runtime_dsn)
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
        from tools.db.dsn_sanitize import sanitize_psycopg2_dsn
        database_url = sanitize_psycopg2_dsn(database_url)
        return psycopg2.connect(database_url)
    
    raise ValueError('Missing RUNTIME_DATABASE_URL or (SUPABASE_RUNTIME_URL + SUPABASE_RUNTIME_DB_PASSWORD)')


def link_document_to_module(
    module_code: str,
    source_url: str,
    sha256: str,
    corpus_document_id: str,
    chunk_ids: List[str],
    link_module_code: Optional[str] = None,
) -> dict:
    """
    Link an ingested document and its chunks to a module.
    
    Uses RUNTIME database for module_sources lookup (by module_code), CORPUS database for link tables.
    link_module_code: if set, use for CORPUS module_source_documents/module_chunk_links (e.g. when
    mirroring MODULE_PENDING sources for a target module); otherwise use module_code.
    
    Returns:
        {
            'module_source_id': str,
            'linked_documents': int,
            'linked_chunks': int
        }
    """
    link_code = link_module_code if link_module_code is not None else module_code
    # Step 1: Get module_source_id from RUNTIME database
    runtime_conn = get_runtime_db_connection()
    runtime_cur = runtime_conn.cursor()
    
    try:
        # Find module_source by URL or sha256 (module_code is the row's module_code, e.g. MODULE_PENDING)
        runtime_cur.execute("""
            SELECT id FROM public.module_sources
            WHERE module_code = %s AND (source_url = %s OR sha256 = %s)
            LIMIT 1
        """, (module_code, source_url, sha256))
        
        source_row = runtime_cur.fetchone()
        if not source_row:
            # Module source not found - this shouldn't happen if import_download_manifest_to_module_sources was run first
            print(f"WARNING: module_source not found for {source_url} in {module_code}")
            return {
                'module_source_id': None,
                'linked_documents': 0,
                'linked_chunks': 0
            }
        
        module_source_id = source_row[0]
    finally:
        runtime_cur.close()
        runtime_conn.close()
    
    # Step 2: Insert links into CORPUS database (use link_code for comprehension/filtering)
    corpus_conn = get_corpus_db_connection()
    corpus_cur = corpus_conn.cursor()
    
    try:
        # Link document (with module_code denormalized for fast filtering)
        corpus_cur.execute("""
            INSERT INTO public.module_source_documents
            (module_source_id, corpus_document_id, module_code)
            VALUES (%s, %s, %s)
            ON CONFLICT (module_source_id, corpus_document_id) DO NOTHING
        """, (module_source_id, corpus_document_id, link_code))
        
        linked_documents = 1 if corpus_cur.rowcount > 0 else 0
        
        # Link chunks
        linked_chunks = 0
        for chunk_id in chunk_ids:
            corpus_cur.execute("""
                INSERT INTO public.module_chunk_links
                (module_code, chunk_id)
                VALUES (%s, %s)
                ON CONFLICT (module_code, chunk_id) DO NOTHING
            """, (link_code, chunk_id))
            if corpus_cur.rowcount > 0:
                linked_chunks += 1
        
        corpus_conn.commit()
        
        return {
            'module_source_id': str(module_source_id),
            'linked_documents': linked_documents,
            'linked_chunks': linked_chunks
        }
        
    except Exception as e:
        corpus_conn.rollback()
        raise
    finally:
        corpus_cur.close()
        corpus_conn.close()


if __name__ == "__main__":
    # This module is primarily imported, but can be tested standalone
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument('--module_code', required=True)
    parser.add_argument('--source_url', required=True)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--corpus_document_id', required=True)
    parser.add_argument('--chunk_ids', nargs='+', default=[])
    
    args = parser.parse_args()
    
    result = link_document_to_module(
        args.module_code,
        args.source_url,
        args.sha256,
        args.corpus_document_id,
        args.chunk_ids
    )
    
    print(f"Linked: {result['linked_documents']} documents, {result['linked_chunks']} chunks")
