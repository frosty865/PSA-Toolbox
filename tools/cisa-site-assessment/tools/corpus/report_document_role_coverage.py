#!/usr/bin/env python3
"""
Report document role coverage statistics.

Shows counts of documents and chunks by document_role,
and OFC candidates extracted by role.
"""
import json
import os
import sys
from pathlib import Path
from collections import defaultdict

def load_env_file(filepath: str):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip().strip('"').strip("'")

def get_corpus_db():
    import psycopg2
    load_env_file('.env.local')
    dsn = os.environ.get('CORPUS_DATABASE_URL') or os.environ.get('DATABASE_URL')
    if dsn:
        return psycopg2.connect(dsn)
    die("Missing CORPUS_DATABASE_URL")

def die(msg: str):
    print(f"[FAIL] {msg}", file=sys.stderr)
    sys.exit(1)

def main():
    conn = get_corpus_db()
    cur = conn.cursor()
    
    # Check if corpus_documents table exists
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema='public' AND table_name='corpus_documents'
        )
    """)
    if not cur.fetchone()[0]:
        die("corpus_documents table not found")
    
    # Check if document_role column exists
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' 
            AND table_name='corpus_documents'
            AND column_name='document_role'
        )
    """)
    has_document_role = cur.fetchone()[0]
    
    if not has_document_role:
        die("document_role column not found. Run migration first: migrations/20260203_add_document_role_to_corpus_documents.sql")
    
    # Get document counts by role
    cur.execute("""
        SELECT 
            document_role,
            COUNT(*) as doc_count
        FROM public.corpus_documents
        GROUP BY document_role
        ORDER BY document_role
    """)
    doc_counts = {row[0]: row[1] for row in cur.fetchall()}
    
    # Get chunk counts by role
    # Handle both cases: chunks may reference corpus_documents.id directly OR documents.document_id (legacy)
    cur.execute("""
        SELECT 
            COALESCE(cd.document_role, cd2.document_role, 'LEGACY') as document_role,
            COUNT(dc.chunk_id) as chunk_count
        FROM public.document_chunks dc
        LEFT JOIN public.corpus_documents cd ON dc.document_id = cd.id
        LEFT JOIN public.documents d ON dc.document_id = d.document_id
        LEFT JOIN public.corpus_documents cd2 ON d.file_hash = cd2.file_hash
        GROUP BY COALESCE(cd.document_role, cd2.document_role, 'LEGACY')
        ORDER BY COALESCE(cd.document_role, cd2.document_role, 'LEGACY')
    """)
    chunk_counts = {row[0]: row[1] for row in cur.fetchall()}
    
    # Get OFC candidate counts by role (via document_chunks -> corpus_documents)
    # Citations are stored directly in ofc_candidate_queue via document_chunk_id (direct FK)
    cur.execute("""
        SELECT 
            COALESCE(cd.document_role, cd2.document_role, 'LEGACY') as document_role,
            COUNT(DISTINCT ocq.candidate_id) as ofc_count
        FROM public.ofc_candidate_queue ocq
        JOIN public.document_chunks dc ON ocq.document_chunk_id = dc.chunk_id
        LEFT JOIN public.corpus_documents cd ON dc.document_id = cd.id
        LEFT JOIN public.documents d ON dc.document_id = d.document_id
        LEFT JOIN public.corpus_documents cd2 ON d.file_hash = cd2.file_hash
        WHERE ocq.document_chunk_id IS NOT NULL
        GROUP BY COALESCE(cd.document_role, cd2.document_role, 'LEGACY')
        ORDER BY COALESCE(cd.document_role, cd2.document_role, 'LEGACY')
    """)
    ofc_counts = {row[0]: row[1] for row in cur.fetchall()}
    
    # Get total counts
    cur.execute("SELECT COUNT(*) FROM public.corpus_documents")
    total_docs = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM public.document_chunks")
    total_chunks = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM public.ofc_candidate_queue")
    total_ofcs = cur.fetchone()[0]
    
    # Build report
    report = {
        "generated_at": str(Path(__file__).stat().st_mtime),
        "total_documents": total_docs,
        "total_chunks": total_chunks,
        "total_ofc_candidates": total_ofcs,
        "documents_by_role": {
            "OFC_SOURCE": doc_counts.get("OFC_SOURCE", 0),
            "AUTHORITY_SOURCE": doc_counts.get("AUTHORITY_SOURCE", 0),
            "NULL": doc_counts.get(None, 0) if None in doc_counts else 0
        },
        "chunks_by_role": {
            "OFC_SOURCE": chunk_counts.get("OFC_SOURCE", 0),
            "AUTHORITY_SOURCE": chunk_counts.get("AUTHORITY_SOURCE", 0),
            "LEGACY": chunk_counts.get("LEGACY", 0),
            "NULL": chunk_counts.get(None, 0) if None in chunk_counts else 0
        },
        "ofc_candidates_by_role": {
            "OFC_SOURCE": ofc_counts.get("OFC_SOURCE", 0),
            "AUTHORITY_SOURCE": ofc_counts.get("AUTHORITY_SOURCE", 0),
            "LEGACY": ofc_counts.get("LEGACY", 0),
            "NULL": ofc_counts.get(None, 0) if None in ofc_counts else 0
        },
        "interpretation": {
            "note": "AUTHORITY_SOURCE documents showing 0 OFCs is expected and not a failure.",
            "mining_eligibility": "Only OFC_SOURCE documents are eligible for OFC mining.",
            "authority_purpose": "AUTHORITY_SOURCE documents are retained for citations and authority support, not OFC creation."
        }
    }
    
    # Write report
    Path("analytics/reports").mkdir(parents=True, exist_ok=True)
    report_path = Path("analytics/reports/document_role_coverage.json")
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    
    print(json.dumps(report, indent=2))
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
