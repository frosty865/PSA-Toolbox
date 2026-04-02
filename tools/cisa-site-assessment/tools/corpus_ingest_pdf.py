#!/usr/bin/env python3
"""
CORPUS PDF Ingestion Script

Ingests a PDF into CORPUS database with:
- SHA-256 hash deduplication
- Page-scoped chunking with overlap
- Ingestion run tracking
- Durable text storage

Writes: CORPUS only (source_registry, corpus_documents, document_chunks, ingestion_runs).
Reads: RUNTIME canonical_sources only when --canonical_source_id is provided (validation).
"""

import os
import sys
import hashlib
import argparse
from pathlib import Path
from typing import Any, Dict, List, Tuple, Optional
from datetime import datetime
import re

import psycopg2
import psycopg2.errors
import json

# pdfplumber for improved text extraction
import pdfplumber

# Import citation extractor
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from model.ingest.pdf_citation_extractor import extract_citation_metadata, is_hash_like_title
from tools.db.corpus_db import get_corpus_conn
from tools.db.runtime_db import get_runtime_conn
from tools.rag_emit import rag_emit_enabled


def _emit_chunk_to_rag(
    cur, chunk_id: str, chunk_text: str, source_file: str, page_range: str,
    rag_tags_override: Optional[Dict[str, Any]] = None,
) -> None:
    """Best-effort emit to RAG store (log-and-continue). Use rag_tags_override for Technology Library (e.g. {"source_type": "CORPUS", "library": "technology"})."""
    if not rag_emit_enabled():
        return
    tags = rag_tags_override if rag_tags_override is not None else {"source_type": "CORPUS"}
    try:
        from services.rag.emit_chunk_to_rag_store import emit_chunk_to_rag_store
        emit_chunk_to_rag_store(
            cur,
            chunk_id=chunk_id,
            chunk_text=chunk_text,
            source_file=source_file,
            page_range=page_range,
            tags=tags,
        )
    except Exception as e:
        print(f"[RAG][WARN] emit failed chunk_id={chunk_id}: {e}")

def get_corpus_db_connection():
    """Backward-compat alias; loads .local.env or .env.local then returns get_corpus_conn()."""
    load_env_file()
    return get_corpus_conn()


def load_env_file(filepath: str = None):
    """Load environment variables from .local.env or .env.local (tries .local.env first)."""
    for p in (filepath,) if filepath else [".local.env", ".env.local"]:
        if p and os.path.exists(p):
            with open(p, "r") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, value = line.split("=", 1)
                        os.environ[key.strip()] = value.strip().strip('"').strip("'")
            return

def fetch_canonical_source(runtime_conn, canonical_source_id: str):
    """Look up canonical_source_id in RUNTIME canonical_sources. Returns row or None."""
    with runtime_conn.cursor() as cur:
        cur.execute(
            "SELECT source_id, title FROM public.canonical_sources WHERE source_id = %s",
            (canonical_source_id,),
        )
        return cur.fetchone()


def sha256_hash(data: bytes) -> str:
    """Calculate SHA256 hash of bytes."""
    return hashlib.sha256(data).hexdigest()

def normalize_text_for_hash(text: str) -> str:
    """Normalize text for hashing."""
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_text_with_ocr(pdf_path: str, page_num: int) -> Optional[str]:
    """
    Extract text from a PDF page using OCR (Tesseract).
    Returns extracted text or None if OCR fails.
    """
    try:
        from pdf2image import convert_from_path
        import pytesseract
        import platform
        from pathlib import Path
        
        # Configure Tesseract path on Windows if needed
        if platform.system() == 'Windows':
            # Common Tesseract installation paths on Windows
            tesseract_paths = [
                r'C:\Program Files\Tesseract-OCR\tesseract.exe',
                r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
            ]
            # Try to detect Tesseract if not already configured
            try:
                # Test if tesseract is accessible (will raise exception if not found)
                pytesseract.get_tesseract_version()
            except Exception:
                # Tesseract not in PATH, try to find it in common locations
                for tesseract_path in tesseract_paths:
                    if Path(tesseract_path).exists():
                        pytesseract.pytesseract.tesseract_cmd = tesseract_path
                        break
        
        # Convert PDF page to image
        images = convert_from_path(pdf_path, first_page=page_num, last_page=page_num, dpi=300)
        
        if not images:
            return None
        
        # Perform OCR on the image
        ocr_text = pytesseract.image_to_string(images[0], lang='eng')
        return ocr_text.strip() if ocr_text else None
        
    except ImportError:
        # OCR libraries not installed
        return None
    except Exception as e:
        print(f"    [WARN] OCR failed for page {page_num}: {e}")
        return None


def _extract_text_with_pymupdf(pdf_path: str) -> Optional[List[Tuple[int, str, Dict]]]:
    """
    Try extracting text using PyMuPDF (fitz). Returns same format as extract_text_from_pdf_pages
    or None if PyMuPDF is not available or extraction fails.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        return None
    try:
        doc = fitz.open(pdf_path)
        pages = []
        for i in range(len(doc)):
            page = doc[i]
            text = (page.get_text() or "").strip()
            char_count = len(text)
            empty_page = char_count == 0
            stats = {
                'extracted_char_count': char_count,
                'empty_page': empty_page,
                'used_ocr': False,
                'extractor_version': 'pymupdf_v1'
            }
            pages.append((i + 1, text, stats))
        doc.close()
        if not pages:
            return None
        return pages
    except Exception:
        return None


def extract_text_from_pdf_pages(pdf_path: str, use_ocr: bool = True) -> List[Tuple[int, str, Dict]]:
    """
    Extract text from PDF preserving page numbers using pdfplumber.
    Falls back to OCR if no text is extracted; if still no text, tries PyMuPDF.
    Returns list of (page_num, text, stats) where stats includes:
    - extracted_char_count
    - empty_page
    - used_ocr
    - extractor_version
    """
    pages = []
    extractor_version = "pdfplumber_v1"
    ocr_used = False
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            
            for page_num in range(1, total_pages + 1):
                page = pdf.pages[page_num - 1]  # 0-indexed
                
                # Try layout=True first (preserves structure)
                text = page.extract_text(layout=True)
                
                # Fallback to simple extraction
                if not text or len(text.strip()) < 10:
                    text = page.extract_text()
                
                text = text.strip() if text else ""
                char_count = len(text)
                empty_page = char_count == 0
                page_used_ocr = False
                
                # If no text extracted and OCR is enabled, try OCR
                if empty_page and use_ocr:
                    print(f"    [OCR] No text extracted from page {page_num}, attempting OCR...")
                    ocr_text = extract_text_with_ocr(pdf_path, page_num)
                    if ocr_text and len(ocr_text.strip()) > 10:
                        text = ocr_text
                        char_count = len(text)
                        empty_page = False
                        page_used_ocr = True
                        ocr_used = True
                        extractor_version = "pdfplumber_v1+ocr"
                
                # Log per-page stats
                stats = {
                    'extracted_char_count': char_count,
                    'empty_page': empty_page,
                    'used_ocr': page_used_ocr,
                    'extractor_version': extractor_version
                }
                
                # Skip ONLY if completely empty (do not stop early)
                if not empty_page:
                    pages.append((page_num, text, stats))
                else:
                    # Still record empty pages for stats
                    pages.append((page_num, "", stats))
        
        if ocr_used:
            print(f"[DEBUG] OCR was used for some pages in this PDF")
        
        # If pdfplumber got no text from any page, try PyMuPDF (some PDFs work with one lib but not the other)
        pages_with_text = sum(1 for _, _, s in pages if not s.get('empty_page'))
        if pages_with_text == 0 and total_pages > 0:
            pymupdf_pages = _extract_text_with_pymupdf(pdf_path)
            if pymupdf_pages:
                pages_with_pymupdf = sum(1 for _, _, s in pymupdf_pages if not s.get('empty_page'))
                if pages_with_pymupdf > 0:
                    print(f"[DEBUG] pdfplumber extracted no text; PyMuPDF recovered text from {pages_with_pymupdf} page(s)")
                    return pymupdf_pages
                    
    except Exception as e:
        raise ValueError(f'Failed to extract text from PDF: {e}')
    
    return pages

def _set_processing_status(conn, cur, document_id, *, status: str, chunk_count: Optional[int] = None, last_error: Optional[str] = None, source_registry_id: Optional[str] = None) -> None:
    if document_id is None:
        return

    # If transaction is aborted (e.g. earlier query failed), rollback so we can run the status update
    try:
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'corpus_documents'
            AND column_name = 'source_registry_id'
        """)
        has_source_registry_id_col = cur.fetchone() is not None
    except psycopg2.errors.InFailedSqlTransaction:
        conn.rollback()
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'corpus_documents'
            AND column_name = 'source_registry_id'
        """)
        has_source_registry_id_col = cur.fetchone() is not None
    
    # If column exists and source_registry_id is provided, include it in UPDATE
    # This ensures constraint is satisfied
    if has_source_registry_id_col and source_registry_id:
        if status in ('PROCESSED', 'FAILED'):
            cur.execute("""
                UPDATE public.corpus_documents
                SET processing_status = %s, chunk_count = COALESCE(%s, chunk_count), processed_at = now(), last_error = %s, source_registry_id = COALESCE(source_registry_id, %s)
                WHERE id = %s
            """, (status, chunk_count, last_error, source_registry_id, document_id))
        else:
            cur.execute("""
                UPDATE public.corpus_documents
                SET processing_status = %s, last_error = %s, source_registry_id = COALESCE(source_registry_id, %s)
                WHERE id = %s
            """, (status, last_error, source_registry_id, document_id))
    else:
        # Original behavior if no source_registry_id column or value
        if status in ('PROCESSED', 'FAILED'):
            cur.execute("""
                UPDATE public.corpus_documents
                SET processing_status = %s, chunk_count = COALESCE(%s, chunk_count), processed_at = now(), last_error = %s
                WHERE id = %s
            """, (status, chunk_count, last_error, document_id))
        else:
            cur.execute("""
                UPDATE public.corpus_documents
                SET processing_status = %s, last_error = %s
                WHERE id = %s
            """, (status, last_error, document_id))


def _set_status_failed_on_error(conn, document_id, err_msg: str) -> None:
    if document_id is None:
        return
    msg = (err_msg or 'Unknown error')[:500]
    try:
        with conn.cursor() as c:
            c.execute("""
                UPDATE public.corpus_documents
                SET processing_status = 'FAILED', last_error = %s, processed_at = now()
                WHERE id = %s
            """, (msg, document_id))
        conn.commit()
    except Exception:
        conn.rollback()


def _get_library_root(use_technology: bool) -> str:
    """Return CORPUS_SOURCES_ROOT or TECHNOLOGY_SOURCES_ROOT (resolved). Same rules for both."""
    if use_technology:
        raw = os.environ.get('TECHNOLOGY_SOURCES_ROOT', 'storage/technology_sources').strip().strip('"').strip("'")
    else:
        raw = os.environ.get('CORPUS_SOURCES_ROOT', 'storage/corpus_sources').strip().strip('"').strip("'")
    if not os.path.isabs(raw):
        return os.path.abspath(os.path.join(os.getcwd(), raw))
    return raw


def _resolve_pdf_path_for_corpus_document(conn, corpus_document_id: str) -> str:
    """Resolve absolute PDF path from corpus_documents + source_registry. Raises if not found."""
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'corpus_documents' AND column_name = 'document_role'
        """)
        has_doc_role = cur.fetchone() is not None
        if has_doc_role:
            cur.execute("""
                SELECT cd.canonical_path, cd.source_registry_id, cd.document_role
                FROM public.corpus_documents cd
                WHERE cd.id = %s
            """, (corpus_document_id,))
        else:
            cur.execute("""
                SELECT cd.canonical_path, cd.source_registry_id, NULL::text
                FROM public.corpus_documents cd
                WHERE cd.id = %s
            """, (corpus_document_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError(f'corpus_document_id {corpus_document_id} not found')
        canonical_path, source_registry_id = row[0], row[1]
        document_role = row[2] if has_doc_role else None
        use_technology = document_role == 'TECHNOLOGY_LIBRARY'
        corpus_root = _get_library_root(use_technology)

        # 1) canonical_path: absolute and exists, or under corpus_root
        if canonical_path:
            if os.path.isabs(canonical_path) and os.path.isfile(canonical_path):
                return canonical_path
            p = os.path.join(corpus_root, canonical_path) if not os.path.isabs(canonical_path) else canonical_path
            if os.path.isfile(p):
                return p

        # 2) source_registry: storage_relpath, local_path
        if source_registry_id:
            cur.execute("""
                SELECT storage_relpath, local_path FROM public.source_registry WHERE id = %s
            """, (source_registry_id,))
            sr = cur.fetchone()
            if sr:
                storage_relpath, local_path = sr[0], sr[1]
                if local_path and os.path.isfile(local_path):
                    return local_path
                if storage_relpath:
                    p = os.path.join(corpus_root, storage_relpath)
                    if os.path.isfile(p):
                        return p

        raise ValueError(
            f'Cannot resolve PDF path for corpus_document_id {corpus_document_id}. '
            'Set canonical_path or source_registry.storage_relpath/local_path.'
        )
    finally:
        cur.close()


def _run_chunk_loop(
    cur, document_id, pages: List[Tuple[int, str]], chunk_chars: int, overlap_chars: int,
    source_file: Optional[str] = None,
    rag_tags_override: Optional[Dict[str, Any]] = None,
) -> int:
    """Insert chunks for pages. Returns chunks_inserted. Uses document_chunks.document_id = corpus_documents.id.
    If source_file is set and RAG_EMIT enabled, emits each chunk to rag_chunks after insert.
    Use rag_tags_override for Technology Library (e.g. {"source_type": "CORPUS", "library": "technology"})."""
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'document_chunks' AND column_name = 'source_set'
    """)
    has_source_set = cur.fetchone() is not None

    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'document_chunks'
        AND column_name IN ('locator_type', 'locator')
    """)
    locator_cols = {row[0] for row in cur.fetchall()}

    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'document_chunks'
        AND column_name IN ('chunk_id', 'id')
    """)
    chunk_id_col = None
    for row in cur.fetchall():
        if row[0] in ('chunk_id', 'id'):
            chunk_id_col = row[0]
            break

    chunks_inserted = 0
    chunk_index = 0
    for page_num, page_text in pages:
        page_chunks = chunk_text_with_overlap(page_text, chunk_chars, overlap_chars)
        for chunk_text in page_chunks:
            chunk_hash = sha256_hash(normalize_text_for_hash(chunk_text).encode('utf-8'))
            cur.execute("""
                SELECT chunk_id FROM public.document_chunks
                WHERE document_id = %s AND chunk_text = %s LIMIT 1
            """, (document_id, chunk_text))
            if cur.fetchone():
                continue
            insert_cols = ['document_id', 'chunk_index', 'page_number', 'chunk_text']
            insert_vals = [document_id, chunk_index, page_num, chunk_text]
            if has_source_set:
                insert_cols.append('source_set')
                insert_vals.append('PILOT_DOCS')
            if 'locator_type' in locator_cols:
                insert_cols.append('locator_type')
                insert_vals.append('PDF')
            if 'locator' in locator_cols:
                insert_cols.append('locator')
                insert_vals.append(f'Page {page_num}')
            placeholders = ', '.join(['%s'] * len(insert_vals))
            chunk_row = None
            if chunk_id_col:
                cur.execute(f"""
                    INSERT INTO public.document_chunks ({', '.join(insert_cols)})
                    VALUES ({placeholders}) RETURNING {chunk_id_col}
                """, tuple(insert_vals))
                chunk_row = cur.fetchone()
            else:
                cur.execute(f"""
                    INSERT INTO public.document_chunks ({', '.join(insert_cols)})
                    VALUES ({placeholders})
                """, tuple(insert_vals))
            if chunk_row and source_file:
                _emit_chunk_to_rag(cur, str(chunk_row[0]), chunk_text, source_file, str(page_num), rag_tags_override)
            chunk_index += 1
            chunks_inserted += 1
    return chunks_inserted


def _ingest_pdf_by_corpus_document_id(
    corpus_document_id: str,
    chunk_chars: int = 1800,
    overlap_chars: int = 200,
) -> Dict:
    """
    REPROCESS MODE: Re-ingest existing corpus_documents row by id.
    
    CRITICAL: This function MUST NEVER INSERT a new corpus_documents row.
    It ONLY:
    - Fetches existing row by id (fails if not found)
    - Verifies source_registry_id is present (fails if NULL)
    - Resolves PDF from source_registry.storage_relpath/local_path (same as normal ingest)
    - Updates existing row: processing_status='PROCESSING', then deletes old chunks
    - Re-extracts PDF and inserts chunks with document_id = existing corpus_document_id
    - Updates existing row: processing_status/chunk_count/last_error/processed_at
    
    This function is completely isolated from the normal ingest_pdf() INSERT path.
    """
    load_env_file()
    conn = get_corpus_conn()
    cur = conn.cursor()
    document_id = corpus_document_id  # same id for chunks - MUST be existing row id, never a new insert
    
    try:
        # GUARD: Verify corpus_document_id is a valid UUID string (defensive)
        if not corpus_document_id or not isinstance(corpus_document_id, str) or len(corpus_document_id.strip()) == 0:
            raise ValueError(f'Invalid corpus_document_id for reprocess: {corpus_document_id}')
        
        # 1) Fetch existing row and verify it exists (NEVER INSERT - this is reprocess mode)
        cur.execute("""
            SELECT id, source_registry_id, COALESCE(inferred_title, file_stem, original_filename) AS document_name,
                   citation_short, citation_full
            FROM public.corpus_documents
            WHERE id = %s
        """, (corpus_document_id,))
        doc_row = cur.fetchone()
        if not doc_row:
            # Exit code 2 for document not found (per TODO 2 spec)
            print(f"Error: corpus_document_id {corpus_document_id} not found in corpus_documents", file=sys.stderr)
            sys.exit(2)
        
        existing_id, source_registry_id, document_name = doc_row[0], doc_row[1], doc_row[2]
        _cit_short = doc_row[3] if len(doc_row) > 3 and doc_row[3] else None
        _cit_full = doc_row[4] if len(doc_row) > 4 and doc_row[4] else None
        document_name = _cit_short or _cit_full or document_name
        
        # 2) Ensure source_registry_id is present (required for reprocess)
        if not source_registry_id:
            # Per TODO 2 spec: if source_registry_id is NULL, mark FAILED and exit(0)
            _set_processing_status(conn, cur, document_id, status='FAILED', chunk_count=0, last_error='Missing source_registry_id')
            cur.execute("UPDATE public.corpus_documents SET processed_at=now() WHERE id=%s", (document_id,))
            conn.commit()
            print(f"Warning: corpus_document_id {corpus_document_id} has NULL source_registry_id. Marked FAILED.", file=sys.stderr)
            sys.exit(0)  # Exit 0 because we handled it gracefully
        
        # 3) Resolve PDF path from source_registry (same logic as normal ingest)
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'corpus_documents' AND column_name = 'document_role'
        """)
        _has_doc_role = cur.fetchone() is not None
        doc_role = None
        if _has_doc_role:
            cur.execute("SELECT document_role FROM public.corpus_documents WHERE id = %s", (document_id,))
            _dr = cur.fetchone()
            doc_role = _dr[0] if _dr else None
        use_technology = doc_role == 'TECHNOLOGY_LIBRARY'
        corpus_root = _get_library_root(use_technology)

        pdf_path_str = None
        cur.execute("""
            SELECT storage_relpath, local_path FROM public.source_registry WHERE id = %s
        """, (source_registry_id,))
        sr_row = cur.fetchone()
        if sr_row:
            storage_relpath, local_path = sr_row[0], sr_row[1]
            if local_path and os.path.isfile(local_path):
                pdf_path_str = local_path
            elif storage_relpath:
                candidate = os.path.join(corpus_root, storage_relpath)
                if os.path.isfile(candidate):
                    pdf_path_str = candidate
        
        # Fallback: try canonical_path if source_registry didn't yield a file
        if not pdf_path_str:
            cur.execute("""
                SELECT canonical_path FROM public.corpus_documents WHERE id = %s
            """, (corpus_document_id,))
            canon_row = cur.fetchone()
            if canon_row and canon_row[0]:
                canonical_path = canon_row[0]
                if os.path.isabs(canonical_path) and os.path.isfile(canonical_path):
                    pdf_path_str = canonical_path
                elif not os.path.isabs(canonical_path):
                    candidate = os.path.join(corpus_root, canonical_path)
                    if os.path.isfile(candidate):
                        pdf_path_str = candidate
        
        if not pdf_path_str:
            _set_processing_status(conn, cur, document_id, status='FAILED', chunk_count=0, last_error=f'Cannot resolve PDF path for corpus_document_id {corpus_document_id}. Check source_registry.storage_relpath/local_path or corpus_documents.canonical_path.')
            conn.commit()
            return {
                'document_id': str(document_id),
                'chunks_count': 0,
                'status': 're-ingested',
                'processing_status': 'FAILED',
                'error': 'PDF path not resolved'
            }
        
        pdf_path = Path(pdf_path_str)
        if not pdf_path.exists():
            _set_processing_status(conn, cur, document_id, status='FAILED', chunk_count=0, last_error=f'PDF file not found: {pdf_path}')
            conn.commit()
            return {
                'document_id': str(document_id),
                'chunks_count': 0,
                'status': 're-ingested',
                'processing_status': 'FAILED',
                'error': 'PDF file not found'
            }

        # 4) Mark PROCESSING and delete old chunks (using existing corpus_document_id)
        _set_processing_status(conn, cur, document_id, status='PROCESSING', last_error=None)
        cur.execute("DELETE FROM public.document_chunks WHERE document_id = %s", (document_id,))

        pages_data = extract_text_from_pdf_pages(str(pdf_path))
        if not pages_data:
            _set_processing_status(conn, cur, document_id, status='FAILED', chunk_count=0, last_error='No pages found in PDF')
            conn.commit()
            return {'document_id': str(document_id), 'chunks_count': 0, 'status': 're-ingested', 'processing_status': 'FAILED'}

        pages = [(pnum, text) for pnum, text, stats in pages_data if not stats.get('empty_page')]
        if not pages:
            _set_processing_status(conn, cur, document_id, status='FAILED', chunk_count=0, last_error='No text extracted from any page')
            conn.commit()
            return {'document_id': str(document_id), 'chunks_count': 0, 'status': 're-ingested', 'processing_status': 'FAILED'}

        # 5) Extract and insert chunks (using existing corpus_document_id - NEVER INSERT corpus_documents)
        # RAG tags: Technology Library documents get library=technology so retrieval can filter
        _reprocess_rag_tags = None
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'corpus_documents' AND column_name = 'document_role'
        """)
        if cur.fetchone():
            cur.execute("SELECT document_role FROM public.corpus_documents WHERE id = %s", (document_id,))
            _dr_row = cur.fetchone()
            if _dr_row and _dr_row[0] == 'TECHNOLOGY_LIBRARY':
                _reprocess_rag_tags = {"source_type": "CORPUS", "library": "technology"}
        chunks_inserted = _run_chunk_loop(
            cur, document_id, pages, chunk_chars, overlap_chars,
            source_file=document_name or "unknown",
            rag_tags_override=_reprocess_rag_tags,
        )
        
        # 6) Count chunks from DB to verify (defensive check)
        cur.execute("""
            SELECT COUNT(*)::int FROM public.document_chunks WHERE document_id = %s
        """, (document_id,))
        actual_count = cur.fetchone()[0] or 0
        
        # 7) Update existing corpus_documents row (NEVER INSERT)
        if actual_count > 0:
            _set_processing_status(conn, cur, document_id, status='PROCESSED', chunk_count=actual_count, last_error=None)
        else:
            _set_processing_status(conn, cur, document_id, status='FAILED', chunk_count=0, last_error='No chunks extracted')
        conn.commit()
        return {
            'document_id': str(document_id),
            'chunks_count': actual_count,
            'status': 're-ingested',
            'processing_status': 'PROCESSED' if actual_count > 0 else 'FAILED',
        }
    except Exception as e:
        conn.rollback()
        _set_status_failed_on_error(conn, document_id, str(e))
        raise
    finally:
        cur.close()
        conn.close()


def chunk_text_with_overlap(
    text: str, 
    chunk_chars: int = 1800, 
    overlap_chars: int = 200,
    min_chunk_chars: int = 200
) -> List[str]:
    """
    Chunk text with overlap. Returns list of chunk strings.
    Targets >= 20 chunks by using smaller chunk size if needed.
    """
    if not text.strip():
        return []
    
    # If text is short, return as single chunk
    if len(text) <= chunk_chars:
        return [text] if text.strip() else []
    
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_chars
        
        # If not at end, try to break at sentence boundary
        if end < len(text):
            # Look for sentence boundary in last 200 chars
            search_start = max(start, end - 200)
            search_text = text[search_start:end]
            
            # Find last sentence boundary
            for punct in ['. ', '.\n', '! ', '!\n', '? ', '?\n', '.\t']:
                last_idx = search_text.rfind(punct)
                if last_idx > 0:
                    end = search_start + last_idx + len(punct)
                    break
        
        chunk = text[start:end].strip()
        if chunk and len(chunk) >= min_chunk_chars:
            chunks.append(chunk)
        
        # Move start forward with overlap
        start = end - overlap_chars
        if start >= len(text):
            break
    
    # If we have very few chunks, try smaller chunk size to get more (but only once)
    if len(chunks) < 10 and len(text) > 2000 and chunk_chars >= 1800:
        # Re-chunk with smaller size (only if we're using default chunk size)
        smaller_chunk = max(800, len(text) // 20)  # Target ~20 chunks
        if smaller_chunk < chunk_chars:  # Only recurse if actually making it smaller
            return chunk_text_with_overlap(text, smaller_chunk, overlap_chars, min_chunk_chars)
    
    return chunks

def ingest_pdf(
    pdf_path: str = None,
    source_name: str = "CISA",
    title: str = None,
    published_at: Optional[str] = None,
    authority_scope: str = None,
    source_registry_id: Optional[str] = None,
    chunk_chars: int = 1800,
    overlap_chars: int = 200,
    module_code: Optional[str] = None,
    canonical_source_id: Optional[str] = None,
    corpus_document_id: Optional[str] = None,
    ingestion_stream: Optional[str] = None,
    sector: Optional[str] = None,
    subsector: Optional[str] = None,
    technology_library: bool = False,
    skip_no_text: bool = False,
) -> Dict:
    """
    Ingest PDF into CORPUS database.
    
    REPROCESS MODE: If corpus_document_id is set, calls _ingest_pdf_by_corpus_document_id
    which ONLY updates existing corpus_documents row and NEVER INSERTs a new row.
    
    NEW INGEST MODE: If corpus_document_id is None, performs normal ingestion which
    may INSERT a new corpus_documents row (requires source_registry_id).
    """
    if corpus_document_id:
        # REPROCESS MODE: Use existing corpus_documents row, never INSERT
        # This early return prevents any INSERT code below from executing
        print(f"[REPROCESS] Using existing corpus_document_id: {corpus_document_id}")
        return _ingest_pdf_by_corpus_document_id(corpus_document_id, chunk_chars, overlap_chars)
    
    # NEW INGEST MODE: Normal flow that may INSERT corpus_documents (below)

    if not pdf_path:
        raise ValueError('pdf_path is required when corpus_document_id is not provided')
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f'PDF not found: {pdf_path}')
    
    # Extract citation metadata
    citation_meta = extract_citation_metadata(str(pdf_path), original_filename=pdf_path.name)
    
    # Use inferred_title if available and confidence is good, else use provided title or fallback.
    # NO hash or hash-like value may be used as title (use placeholder instead).
    _untitled_placeholder = "Untitled document"
    raw_inferred = citation_meta.get('inferred_title')
    if raw_inferred and is_hash_like_title(raw_inferred):
        raw_inferred = None
        citation_meta['inferred_title'] = None
        citation_meta.setdefault('ingestion_warnings', []).append('inferred_title_rejected_hash_like')
    if raw_inferred and citation_meta.get('title_confidence', 0) >= 50:
        effective_title = raw_inferred
    elif title and not is_hash_like_title(title):
        effective_title = title
    elif raw_inferred:
        effective_title = raw_inferred
    elif not is_hash_like_title(pdf_path.stem):
        effective_title = pdf_path.stem
    else:
        effective_title = _untitled_placeholder
        citation_meta.setdefault('ingestion_warnings', []).append('title_from_hash_stem_replaced')
    
    # Read PDF bytes for hash
    with open(pdf_path, 'rb') as f:
        pdf_bytes = f.read()
    
    content_hash = sha256_hash(pdf_bytes)
    
    # Extract text with page numbers and stats
    pages_data = extract_text_from_pdf_pages(str(pdf_path))
    
    if not pages_data:
        raise ValueError('No pages found in PDF')
    
    # Filter out empty pages for processing, but keep for stats
    pages = [(pnum, text) for pnum, text, stats in pages_data if not stats['empty_page']]
    pages_with_text = len(pages)
    total_pages = len(pages_data)
    
    print(f"[DEBUG] Extracted {pages_with_text} pages with text out of {total_pages} total pages")
    
    if not pages:
        _no_text_hint = (
            'No text could be extracted from any page. '
            'The PDF may be image-only (scanned). '
            'For OCR: install pdf2image, pytesseract, and Tesseract-OCR (on Windows also poppler). '
            'Alternatively install PyMuPDF (pip install pymupdf) for a different extractor.'
        )
        if skip_no_text:
            print(f"[SKIP] {pdf_path.name}: {_no_text_hint}", file=sys.stderr)
            return {'skipped': True, 'reason': 'no_text', 'message': _no_text_hint, 'document_id': None}
        raise ValueError(_no_text_hint)
    
    # Calculate extraction coverage
    extraction_coverage = (pages_with_text / total_pages * 100) if total_pages > 0 else 0
    
    load_env_file()
    conn = get_corpus_conn()
    cur = conn.cursor()
    document_id = None  # set in existing/new branch; used for status and in except

    try:
        # HARD GUARD: Check if source_registry_id is required and abort BEFORE parsing/chunking if missing
        # This prevents wasted work if the document cannot be ingested
        cur.execute("""
            SELECT column_name, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name IN ('corpus_documents', 'documents')
            AND column_name = 'source_registry_id'
        """)
        source_registry_cols = cur.fetchall()
        
        if source_registry_cols:
            # Column exists - check if NOT NULL constraint is enforced
            for col_info in source_registry_cols:
                is_nullable = col_info[1]  # 'YES' or 'NO'
                if is_nullable == 'NO':
                    # NOT NULL constraint is enforced - source_registry_id is REQUIRED
                    if not source_registry_id:
                        conn.rollback()
                        raise ValueError(
                            'source_registry_id is REQUIRED but not provided. '
                            'The document header table has a NOT NULL constraint on source_registry_id. '
                            'Aborting ingestion BEFORE parsing/chunking to prevent wasted work.'
                        )
                else:
                    # Column exists but nullable - still check if we should require it
                    # For new uploads, we require source_registry_id even if column is nullable
                    if not source_registry_id:
                        conn.rollback()
                        raise ValueError(
                            'source_registry_id is REQUIRED for new PDF uploads. '
                            'Aborting ingestion BEFORE parsing/chunking to prevent wasted work.'
                        )
        
        # If column doesn't exist yet, that's OK (backward compatibility during migration)
        # But if it exists and source_registry_id is provided, validate it exists in source_registry and is ACTIVE
        # Also check notes, scope_tags, and technology_library flag to determine document_role (module, technology library, or authority)
        is_module_source = False
        is_technology_library = bool(technology_library)
        if source_registry_id:
            # Check if status column exists
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'source_registry' 
                AND column_name = 'status'
            """)
            has_status_column = cur.fetchone() is not None
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'source_registry' 
                AND column_name = 'scope_tags'
            """)
            has_scope_tags_col = cur.fetchone() is not None

            if has_status_column and has_scope_tags_col:
                cur.execute("""
                    SELECT id, status, notes, scope_tags FROM public.source_registry WHERE id = %s
                """, (source_registry_id,))
            elif has_status_column:
                cur.execute("""
                    SELECT id, status, notes FROM public.source_registry WHERE id = %s
                """, (source_registry_id,))
            elif has_scope_tags_col:
                cur.execute("""
                    SELECT id, source_type, notes, scope_tags FROM public.source_registry WHERE id = %s
                """, (source_registry_id,))
            else:
                cur.execute("""
                    SELECT id, source_type, notes FROM public.source_registry WHERE id = %s
                """, (source_registry_id,))

            src_row = cur.fetchone()
            if not src_row:
                conn.rollback()
                raise ValueError(
                    f'source_registry_id {source_registry_id} not found in public.source_registry. '
                    'Aborting ingestion BEFORE parsing/chunking.'
                )

            # Check if ACTIVE (status='ACTIVE' or source_type in ['web', 'pdf', 'doc'])
            is_active = False
            if has_status_column:
                is_active = src_row[1] == 'ACTIVE'
            else:
                # Legacy: allow web, pdf, and doc source types
                is_active = src_row[1] in ['web', 'pdf', 'doc']

            if not is_active:
                conn.rollback()
                raise ValueError(
                    f'source_registry_id {source_registry_id} is not ACTIVE (status: {src_row[1]}). '
                    'Aborting ingestion BEFORE parsing/chunking.'
                )

            # Notes: index 2; scope_tags: index 3 when present
            notes = src_row[2] if len(src_row) > 2 else None
            scope_tags_raw = src_row[3] if has_scope_tags_col and len(src_row) > 3 else None

            # Check if this is a module source by checking notes field
            # Module sources have "Auto-registered from module-curated OFC import" in notes
            if notes and 'Auto-registered from module-curated OFC import' in notes:
                is_module_source = True
                print(f"[DEBUG] Detected module source from source_registry notes: {source_registry_id}")

            # Check if this is a Technology Library source (scope_tags.tags.library = 'technology' or --technology_library)
            if not is_technology_library and scope_tags_raw is not None:
                st = scope_tags_raw
                if isinstance(st, str):
                    try:
                        st = json.loads(st)
                    except Exception:
                        st = {}
                if isinstance(st, dict):
                    tags_obj = st.get('tags') or {}
                    if isinstance(tags_obj, dict) and tags_obj.get('library') == 'technology':
                        is_technology_library = True
                        print(f"[DEBUG] Detected Technology Library source from scope_tags: {source_registry_id}")
            
            # Update scope_tags with ingestion_stream and tags if provided
            if ingestion_stream or module_code or sector or subsector:
                # Fetch current scope_tags
                cur.execute("""
                    SELECT scope_tags FROM public.source_registry WHERE id = %s
                """, (source_registry_id,))
                scope_row = cur.fetchone()
                current_scope_tags = scope_row[0] if scope_row and scope_row[0] else {}
                
                # Build new scope_tags structure
                if isinstance(current_scope_tags, str):
                    try:
                        current_scope_tags = json.loads(current_scope_tags)
                    except:
                        current_scope_tags = {}
                elif not isinstance(current_scope_tags, dict):
                    current_scope_tags = {}
                
                # Build tags object
                tags = current_scope_tags.get('tags', {})
                if module_code:
                    tags['module_code'] = module_code
                if sector:
                    tags['sector'] = sector
                if subsector:
                    tags['subsector'] = subsector
                
                # Set ingestion_stream
                new_scope_tags = {
                    'tags': tags,
                    'ingestion_stream': ingestion_stream or current_scope_tags.get('ingestion_stream', 'GENERAL')
                }
                
                # Preserve other fields (like triage_rule)
                for key in current_scope_tags:
                    if key not in ['tags', 'ingestion_stream']:
                        new_scope_tags[key] = current_scope_tags[key]
                
                # Validate ingestion_stream and tags consistency
                if new_scope_tags['ingestion_stream'] == 'MODULE' and not tags.get('module_code'):
                    raise ValueError(
                        f'ingestion_stream="MODULE" requires module_code, but module_code not provided. '
                        f'Current scope_tags: {current_scope_tags}'
                    )
                if new_scope_tags['ingestion_stream'] == 'SECTOR_SUBSECTOR' and (not tags.get('sector') or not tags.get('subsector')):
                    raise ValueError(
                        f'ingestion_stream="SECTOR_SUBSECTOR" requires sector and subsector, but missing. '
                        f'Current scope_tags: {current_scope_tags}'
                    )
                if new_scope_tags['ingestion_stream'] == 'GENERAL' and (tags.get('module_code') or tags.get('sector') or tags.get('subsector')):
                    raise ValueError(
                        f'ingestion_stream="GENERAL" must not have module_code, sector, or subsector tags. '
                        f'Current scope_tags: {current_scope_tags}'
                    )
                
                # Update scope_tags
                cur.execute("""
                    UPDATE public.source_registry 
                    SET scope_tags = %s::jsonb
                    WHERE id = %s
                """, (json.dumps(new_scope_tags), source_registry_id))
                conn.commit()
                print(f"[DEBUG] Updated scope_tags for source_registry_id {source_registry_id}: {json.dumps(new_scope_tags)}")
        # (B) RUNTIME: if canonical_source_id supplied, validate it exists in RUNTIME canonical_sources
        if canonical_source_id:
            runtime_conn = get_runtime_conn()
            try:
                cs = fetch_canonical_source(runtime_conn, canonical_source_id)
                if not cs:
                    raise ValueError(
                        f"Invalid canonical_source_id '{canonical_source_id}': not found in RUNTIME canonical_sources"
                    )
            finally:
                try:
                    runtime_conn.close()
                except Exception:
                    pass

        # 2. Check if document already exists in corpus_documents (authoritative table)
        cur.execute("""
            SELECT id FROM public.corpus_documents
            WHERE file_hash = %s
        """, (content_hash,))
        
        existing_corpus_doc = cur.fetchone()
        existing_doc = existing_corpus_doc is not None  # Track if document exists for status reporting
        if existing_corpus_doc:
            # Use corpus_documents id for document_id (chunks reference this)
            corpus_document_id = existing_corpus_doc[0]
            document_id = corpus_document_id  # Chunks must reference corpus_documents.id, not legacy document_id
            print(f"Document already exists in corpus_documents: {corpus_document_id} - performing safe re-ingestion")
            
            # For backward compatibility, try to get legacy document_id from documents table (read-only, for logging only)
            # Table may not exist, so wrap in try/except
            try:
                cur.execute("""
                    SELECT document_id FROM public.documents
                    WHERE file_hash = %s
                """, (content_hash,))
                legacy_doc = cur.fetchone()
                if legacy_doc:
                    print(f"Legacy document_id exists: {legacy_doc[0]} (using corpus_document_id: {document_id} for chunks)")
            except (psycopg2.errors.UndefinedTable, psycopg2.errors.InFailedSqlTransaction):
                # Legacy documents table doesn't exist - that's fine, we use corpus_documents
                # Or transaction was aborted - rollback to clear it
                try:
                    conn.rollback()
                except:
                    pass
                pass
            
            # Delete old chunks for this document (using corpus_document_id)
            # First check how many chunks exist
            cur.execute("""
                SELECT COUNT(*) FROM public.document_chunks
                WHERE document_id = %s
            """, (document_id,))
            chunks_before_delete = cur.fetchone()[0]
            
            cur.execute("""
                DELETE FROM public.document_chunks
                WHERE document_id = %s
            """, (document_id,))
            chunks_deleted = cur.rowcount
            
            print(f"Deleted {chunks_deleted} old chunks for document {document_id} (found {chunks_before_delete} before deletion)")
        else:
            document_id = None
            corpus_document_id = None
            
            # Upsert corpus_documents (authoritative) - get or create corpus_document_id
            cur.execute("""
                SELECT id, title_confidence FROM public.corpus_documents WHERE file_hash = %s
            """, (content_hash,))
            existing_corpus = cur.fetchone()
            if existing_corpus:
                existing_doc = True  # Update flag if document found in upsert check
            
            new_confidence = citation_meta.get('title_confidence', 0)
            if existing_corpus:
                corpus_document_id = existing_corpus[0]
                
                # CRITICAL: Check if existing document has NULL source_registry_id and set it if provided
                # This must happen BEFORE any other UPDATEs to avoid constraint violations
                cur.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'corpus_documents'
                    AND column_name = 'source_registry_id'
                """)
                has_source_registry_id_col = cur.fetchone() is not None
                
                if has_source_registry_id_col:
                    # Check current source_registry_id value using document ID (more reliable)
                    cur.execute("""
                        SELECT source_registry_id FROM public.corpus_documents WHERE id = %s
                    """, (corpus_document_id,))
                    existing_sr_id = cur.fetchone()[0]
                    
                    # If NULL and we have a value, set it immediately using document ID
                    # This MUST happen before any other UPDATEs to avoid constraint violations
                    if existing_sr_id is None and source_registry_id:
                        cur.execute("""
                            UPDATE public.corpus_documents
                            SET source_registry_id = %s
                            WHERE id = %s
                        """, (source_registry_id, corpus_document_id))
                        print(f"[DEBUG] Set source_registry_id={source_registry_id} on existing document id={corpus_document_id} (was NULL)")
                        # Verify it was set
                        cur.execute("""
                            SELECT source_registry_id FROM public.corpus_documents WHERE id = %s
                        """, (corpus_document_id,))
                        verify_sr_id = cur.fetchone()[0]
                        if verify_sr_id is None:
                            conn.rollback()
                            raise ValueError(f'Failed to set source_registry_id on document {corpus_document_id}')
                    elif existing_sr_id is None and not source_registry_id:
                        conn.rollback()
                        raise ValueError(
                            'source_registry_id is REQUIRED for existing documents with NULL source_registry_id. '
                            'The document must be linked to Source Registry.'
                        )
                
                # Only update if new confidence is better
                existing_confidence = existing_corpus[1] or 0
                
                if new_confidence > existing_confidence:
                    # Merge warnings (append-only set semantics)
                    cur.execute("""
                        SELECT ingestion_warnings FROM public.corpus_documents WHERE file_hash = %s
                    """, (content_hash,))
                    existing_warnings = cur.fetchone()[0] or []
                    merged_warnings = list(set(existing_warnings + citation_meta.get('ingestion_warnings', [])))
                    
                    update_fields = [
                        'original_filename = %s',
                        'file_stem = %s',
                        'inferred_title = %s',
                        'title_confidence = %s',
                        'pdf_meta_title = COALESCE(%s, pdf_meta_title)',
                        'pdf_meta_author = COALESCE(%s, pdf_meta_author)',
                        'pdf_meta_subject = COALESCE(%s, pdf_meta_subject)',
                        'pdf_meta_creator = COALESCE(%s, pdf_meta_creator)',
                        'pdf_meta_producer = COALESCE(%s, pdf_meta_producer)',
                        'pdf_meta_creation_date = COALESCE(%s, pdf_meta_creation_date)',
                        'pdf_meta_mod_date = COALESCE(%s, pdf_meta_mod_date)',
                        'publisher = COALESCE(%s, publisher)',
                        'publication_date = COALESCE(%s, publication_date)',
                        'source_url = COALESCE(%s, source_url)',
                        'citation_short = COALESCE(%s, citation_short)',
                        'citation_full = COALESCE(%s, citation_full)',
                        'ingestion_warnings = %s'
                    ]
                    update_values = [
                        pdf_path.name,
                        pdf_path.stem,
                        citation_meta.get('inferred_title'),
                        new_confidence,
                        citation_meta.get('pdf_meta_title'),
                        citation_meta.get('pdf_meta_author'),
                        citation_meta.get('pdf_meta_subject'),
                        citation_meta.get('pdf_meta_creator'),
                        citation_meta.get('pdf_meta_producer'),
                        citation_meta.get('pdf_meta_creation_date'),
                        citation_meta.get('pdf_meta_mod_date'),
                        citation_meta.get('publisher'),
                        citation_meta.get('publication_date'),
                        citation_meta.get('source_url'),
                        citation_meta.get('citation_short'),
                        citation_meta.get('citation_full'),
                        json.dumps(merged_warnings)
                    ]
                    
                    # Note: document_role is NOT updated on existing documents (only set on insert)
                    # This preserves existing role assignments
                    
                    update_values.append(content_hash)
                    
                    cur.execute(f"""
                        UPDATE public.corpus_documents
                        SET {', '.join(update_fields)}
                        WHERE file_hash = %s
                    """, tuple(update_values))
            else:
                # Insert new corpus_documents row
                cur.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'corpus_documents'
                    AND column_name = 'source_registry_id'
                """)
                has_source_registry_id_col = cur.fetchone() is not None
                
                insert_cols = [
                    'file_hash', 'original_filename', 'file_stem', 'inferred_title', 'title_confidence',
                    'pdf_meta_title', 'pdf_meta_author', 'pdf_meta_subject', 'pdf_meta_creator',
                    'pdf_meta_producer', 'pdf_meta_creation_date', 'pdf_meta_mod_date',
                    'publisher', 'publication_date', 'source_url',
                    'citation_short', 'citation_full', 'ingestion_warnings'
                ]
                insert_vals = [
                    content_hash,
                    pdf_path.name,
                    pdf_path.stem,
                    citation_meta.get('inferred_title'),
                    new_confidence,
                    citation_meta.get('pdf_meta_title'),
                    citation_meta.get('pdf_meta_author'),
                    citation_meta.get('pdf_meta_subject'),
                    citation_meta.get('pdf_meta_creator'),
                    citation_meta.get('pdf_meta_producer'),
                    citation_meta.get('pdf_meta_creation_date'),
                    citation_meta.get('pdf_meta_mod_date'),
                    citation_meta.get('publisher'),
                    citation_meta.get('publication_date'),
                    citation_meta.get('source_url'),
                    citation_meta.get('citation_short'),
                    citation_meta.get('citation_full'),
                    json.dumps(citation_meta.get('ingestion_warnings', []))
                ]
                
                if has_source_registry_id_col and source_registry_id:
                    insert_cols.append('source_registry_id')
                    insert_vals.append(source_registry_id)
                    print(f"[DEBUG] Including source_registry_id={source_registry_id} in INSERT for new document")
                elif has_source_registry_id_col:
                    print(f"[WARNING] source_registry_id column exists but source_registry_id value is: {source_registry_id} (type: {type(source_registry_id)})")
                
                # Check if document_role column exists and add it
                # Technology Library (scope_tags) > module (notes) > AUTHORITY_SOURCE
                document_role = 'TECHNOLOGY_LIBRARY' if is_technology_library else ('OFC_SOURCE' if is_module_source else 'AUTHORITY_SOURCE')
                cur.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'corpus_documents'
                    AND column_name = 'document_role'
                """)
                has_document_role_col = cur.fetchone() is not None

                if has_document_role_col:
                    insert_cols.append('document_role')
                    insert_vals.append(document_role)
                    print(f"[DEBUG] Setting document_role to {document_role} for source_registry_id {source_registry_id}")
                
                # GUARDRAIL: Ensure source_registry_id is included in INSERT
                if has_source_registry_id_col and not source_registry_id:
                    conn.rollback()
                    raise ValueError(
                        'GUARDRAIL: Refusing to INSERT corpus_documents without source_registry_id. '
                        'All documents must be linked to Source Registry to be traceable.'
                    )
                
                placeholders = ', '.join(['%s'] * len(insert_vals))
                cur.execute(f"""
                    INSERT INTO public.corpus_documents 
                    ({', '.join(insert_cols)})
                    VALUES ({placeholders})
                    RETURNING id
                """, tuple(insert_vals))
                corpus_document_id = cur.fetchone()[0]
                
                # Immediately verify source_registry_id was set correctly (defense in depth)
                if has_source_registry_id_col and source_registry_id:
                    cur.execute("""
                        SELECT source_registry_id FROM public.corpus_documents WHERE id = %s
                    """, (corpus_document_id,))
                    verify_row = cur.fetchone()
                    if verify_row and verify_row[0] != source_registry_id:
                        conn.rollback()
                        raise ValueError(
                            f'INSERT succeeded but source_registry_id mismatch: expected {source_registry_id}, got {verify_row[0]}. '
                            'Aborting BEFORE chunking to prevent wasted work.'
                        )
                    elif verify_row and verify_row[0] is None:
                        conn.rollback()
                        raise ValueError(
                            f'INSERT succeeded but source_registry_id is NULL for document {corpus_document_id}. '
                            'Aborting BEFORE chunking to prevent wasted work.'
                        )
            
            # Use corpus_document_id for document_id (chunks reference this)
            document_id = corpus_document_id
            
            # For backward compatibility, log if legacy documents table has this file_hash (read-only)
            # Check via information_schema first so we never query a missing table (avoids aborted transaction)
            cur.execute("""
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'documents'
            """)
            if cur.fetchone():
                cur.execute("""
                    SELECT document_id FROM public.documents WHERE file_hash = %s
                """, (content_hash,))
                legacy_doc = cur.fetchone()
                if legacy_doc:
                    print(f"Legacy document_id exists: {legacy_doc[0]} (using corpus_document_id: {document_id})")

        _set_processing_status(conn, cur, document_id, status='PROCESSING', last_error=None, source_registry_id=source_registry_id)

        # 4. Create ingestion run with extractor version
        extractor_version = "pdfplumber_v1"
        run_name = f"Manual ingestion: {pdf_path.name} (extractor: {extractor_version})"
        cur.execute("""
            INSERT INTO public.ingestion_runs
            (run_name, status, started_at, completed_at)
            VALUES (%s, %s, %s, %s)
            RETURNING run_id
        """, (run_name, 'COMPLETED', datetime.utcnow(), datetime.utcnow()))
        
        run_id = cur.fetchone()[0]
        
        # 5. Link ingestion run to document (only if document_id exists in legacy documents table)
        # Check via information_schema first so we never query a missing table (avoids aborted transaction)
        legacy_doc_exists = False
        cur.execute("""
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'documents'
        """)
        if cur.fetchone():
            cur.execute("""
                SELECT document_id FROM public.documents WHERE document_id = %s
            """, (document_id,))
            legacy_doc_exists = cur.fetchone() is not None
        
        if legacy_doc_exists:
            cur.execute("""
                INSERT INTO public.ingestion_run_documents
                (run_id, document_id)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
            """, (run_id, document_id))
        else:
            # Document only exists in corpus_documents (new schema), skip ingestion_run_documents link
            # This is OK - ingestion_run_documents is for legacy tracking
            print(f"Note: document_id {document_id} not in legacy documents table, skipping ingestion_run_documents link")
        
        # Guard: Verify document header row has source_registry_id BEFORE chunking (defense in depth)
        # Use document_id (corpus_document_id) for more reliable lookup
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name IN ('corpus_documents', 'documents')
            AND column_name = 'source_registry_id'
        """)
        has_source_registry_id_col = cur.fetchone() is not None
        
        if has_source_registry_id_col and document_id:
            # Check corpus_documents (authoritative) by document_id (more reliable than file_hash)
            cur.execute("""
                SELECT source_registry_id FROM public.corpus_documents WHERE id = %s
            """, (document_id,))
            corpus_doc = cur.fetchone()
            
            # Only check corpus_documents (authoritative) - documents table is read-only
            corpus_has_srid = corpus_doc and corpus_doc[0] is not None
            
            if not corpus_has_srid:
                conn.rollback()
                raise ValueError(
                    f'Document {document_id} (hash: {content_hash}) missing source_registry_id after creation. '
                    'Aborting BEFORE chunking to prevent wasted work.'
                )
        
        # 6. Chunk and insert document_chunks
        chunks_inserted = 0
        chunk_index = 0
        chunk_ids = []  # Collect chunk IDs for module linking
        
        # source_file for RAG emit: prefer citation_short/citation_full (include document name) so citations display properly
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'corpus_documents' AND column_name = 'document_role'
        """)
        _has_doc_role = cur.fetchone() is not None
        if _has_doc_role:
            cur.execute("""
                SELECT COALESCE(inferred_title, file_stem, original_filename), document_role,
                       citation_short, citation_full
                FROM public.corpus_documents WHERE id = %s
            """, (document_id,))
        else:
            cur.execute("""
                SELECT COALESCE(inferred_title, file_stem, original_filename), NULL,
                       citation_short, citation_full
                FROM public.corpus_documents WHERE id = %s
            """, (document_id,))
        _sf_row = cur.fetchone()
        _doc_name_fallback = (_sf_row[0] if _sf_row and _sf_row[0] else "unknown")
        _citation_short = _sf_row[2] if _sf_row and len(_sf_row) > 2 and _sf_row[2] else None
        _citation_full = _sf_row[3] if _sf_row and len(_sf_row) > 3 and _sf_row[3] else None
        source_file_rag = (_citation_short or _citation_full or _doc_name_fallback)
        if isinstance(source_file_rag, str) and len(source_file_rag) > 500:
            source_file_rag = source_file_rag[:497] + "..."
        _doc_role = _sf_row[1] if _has_doc_role and _sf_row and len(_sf_row) > 1 else None
        _rag_tags_override = {"source_type": "CORPUS", "library": "technology"} if _doc_role == "TECHNOLOGY_LIBRARY" else None
        citation_label_for_sr = _citation_short or _citation_full

        print(f"[DEBUG] Starting chunk creation for {len(pages)} pages, document_id={document_id}")
        
        # Determine source_set (default to PILOT_DOCS for PDFs, can be overridden)
        # Check if source_set column exists
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'document_chunks'
            AND column_name = 'source_set'
        """)
        has_source_set = cur.fetchone() is not None
        
        for page_num, page_text in pages:
            # Chunk this page
            page_chunks = chunk_text_with_overlap(page_text, chunk_chars, overlap_chars)
            
            for chunk_text in page_chunks:
                chunk_hash = sha256_hash(normalize_text_for_hash(chunk_text).encode('utf-8'))
                
                # Check for duplicate chunk
                cur.execute("""
                    SELECT chunk_id FROM public.document_chunks
                    WHERE document_id = %s AND chunk_text = %s
                    LIMIT 1
                """, (document_id, chunk_text))
                
                duplicate = cur.fetchone()
                if duplicate:
                    if chunks_inserted == 0 and chunk_index < 3:  # Only log first few duplicates
                        print(f"[DEBUG] Skipping duplicate chunk at index {chunk_index}")
                    continue  # Skip duplicate
                
                # Build INSERT with optional columns
                insert_cols = ['document_id', 'chunk_index', 'page_number', 'chunk_text']
                insert_vals = [document_id, chunk_index, page_num, chunk_text]
                
                # Add source_set if column exists (explicitly set PILOT_DOCS for PDFs, never UNSPECIFIED)
                if has_source_set:
                    insert_cols.append('source_set')
                    insert_vals.append('PILOT_DOCS')  # Explicit default for PDF uploads - never UNSPECIFIED
                
                # Check if locator columns exist
                cur.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'document_chunks'
                    AND column_name IN ('locator_type', 'locator')
                """)
                locator_cols = {row[0] for row in cur.fetchall()}
                
                if 'locator_type' in locator_cols:
                    insert_cols.append('locator_type')
                    insert_vals.append('PDF')
                
                if 'locator' in locator_cols:
                    insert_cols.append('locator')
                    insert_vals.append(f'Page {page_num}')
                
                # Build and execute INSERT
                placeholders = ', '.join(['%s'] * len(insert_vals))
                
                # Check if chunk_id column exists (some schemas use id, some use chunk_id)
                cur.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'document_chunks'
                    AND column_name IN ('chunk_id', 'id')
                """)
                chunk_id_col = None
                for row in cur.fetchall():
                    if row[0] in ['chunk_id', 'id']:
                        chunk_id_col = row[0]
                        break
                
                if chunk_id_col:
                    # Return chunk_id from INSERT
                    insert_query = f"""
                        INSERT INTO public.document_chunks
                        ({', '.join(insert_cols)})
                        VALUES ({placeholders})
                        RETURNING {chunk_id_col}
                    """
                    cur.execute(insert_query, tuple(insert_vals))
                    chunk_row = cur.fetchone()
                    if chunk_row:
                        chunk_ids.append(str(chunk_row[0]))
                        _emit_chunk_to_rag(cur, str(chunk_row[0]), chunk_text, source_file_rag, str(page_num), _rag_tags_override)
                else:
                    # No chunk_id column, insert without returning
                    # Try to query back the chunk_id after insert
                    insert_query = f"""
                        INSERT INTO public.document_chunks
                        ({', '.join(insert_cols)})
                        VALUES ({placeholders})
                    """
                    cur.execute(insert_query, tuple(insert_vals))
                    
                    # Try to get chunk_id back by querying
                    cur.execute("""
                        SELECT chunk_id FROM public.document_chunks
                        WHERE document_id = %s AND chunk_index = %s
                        ORDER BY created_at DESC NULLS LAST
                        LIMIT 1
                    """, (document_id, chunk_index))
                    chunk_row = cur.fetchone()
                    if chunk_row and chunk_row[0]:
                        chunk_ids.append(str(chunk_row[0]))
                        _emit_chunk_to_rag(cur, str(chunk_row[0]), chunk_text, source_file_rag, str(page_num), _rag_tags_override)
                
                chunk_index += 1
                chunks_inserted += 1

        if chunks_inserted > 0:
            _set_processing_status(conn, cur, document_id, status='PROCESSED', chunk_count=chunks_inserted, last_error=None, source_registry_id=source_registry_id)
            # Backfill source_registry.scope_tags.citation_label so admin UI and citations show document name
            if source_registry_id and citation_label_for_sr:
                try:
                    cur.execute("""
                        SELECT scope_tags FROM public.source_registry WHERE id = %s
                    """, (source_registry_id,))
                    sr_row = cur.fetchone()
                    if sr_row and sr_row[0] is not None:
                        raw = sr_row[0]
                        if isinstance(raw, dict):
                            merged = dict(raw)
                            merged["citation_label"] = citation_label_for_sr[:500] if len(citation_label_for_sr) > 500 else citation_label_for_sr
                        elif isinstance(raw, list):
                            # Preserve existing sector/subsector tags; add citation_label for display only
                            merged = {"citation_label": citation_label_for_sr[:500] if len(citation_label_for_sr) > 500 else citation_label_for_sr, "tags": raw}
                        elif isinstance(raw, str):
                            try:
                                parsed = json.loads(raw)
                                if isinstance(parsed, dict):
                                    merged = dict(parsed)
                                    merged["citation_label"] = citation_label_for_sr[:500] if len(citation_label_for_sr) > 500 else citation_label_for_sr
                                elif isinstance(parsed, list):
                                    merged = {"citation_label": citation_label_for_sr[:500] if len(citation_label_for_sr) > 500 else citation_label_for_sr, "tags": parsed}
                                else:
                                    merged = {"citation_label": citation_label_for_sr[:500] if len(citation_label_for_sr) > 500 else citation_label_for_sr}
                            except (TypeError, ValueError):
                                merged = {"citation_label": citation_label_for_sr[:500] if len(citation_label_for_sr) > 500 else citation_label_for_sr}
                        else:
                            merged = {"citation_label": citation_label_for_sr[:500] if len(citation_label_for_sr) > 500 else citation_label_for_sr}
                    else:
                        merged = {"citation_label": citation_label_for_sr[:500] if len(citation_label_for_sr) > 500 else citation_label_for_sr}
                    cur.execute("""
                        UPDATE public.source_registry SET scope_tags = %s::jsonb, updated_at = now() WHERE id = %s
                    """, (json.dumps(merged), source_registry_id))
                except Exception as e:
                    print(f"[WARN] Could not update source_registry citation_label: {e}", file=sys.stderr)
            # Mark source as ACTIVE after successful ingestion (if status column exists)
            if source_registry_id:
                try:
                    cur.execute("""
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = 'source_registry' AND column_name = 'status'
                    """)
                    if cur.fetchone():
                        cur.execute("""
                            UPDATE public.source_registry SET status = 'ACTIVE', updated_at = now() WHERE id = %s
                        """, (source_registry_id,))
                except Exception as e:
                    print(f"[WARN] Could not set source_registry status to ACTIVE: {e}", file=sys.stderr)
        else:
            _set_processing_status(conn, cur, document_id, status='FAILED', chunk_count=0, last_error='No chunks extracted', source_registry_id=source_registry_id)
        
        print(f"[DEBUG] Created {chunks_inserted} chunks, collected {len(chunk_ids)} chunk_ids")
        conn.commit()
        
        return {
            'document_id': str(document_id),
            'run_id': str(run_id),
            'chunks_count': chunks_inserted,
            'chunk_ids': chunk_ids,  # List of chunk UUIDs for module linking
            'pages_total': total_pages,
            'pages_extracted': pages_with_text,
            'extraction_coverage_pct': round(extraction_coverage, 1),
            'content_hash': content_hash,
            'extractor_version': extractor_version,
            'authority_scope': authority_scope,  # Note: stored in metadata, not DB column
            'status': 're-ingested' if existing_doc else 'ingested',
            'publication_date': citation_meta.get('publication_date'),
        }
        
    except Exception as e:
        conn.rollback()
        _set_status_failed_on_error(conn, document_id, str(e))
        raise
    finally:
        cur.close()
        conn.close()

def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(description='Ingest PDF into CORPUS database')
    parser.add_argument('--pdf_path', help='Path to PDF file (omit when using --corpus_document_id or --reprocess-corpus-document-id)')
    parser.add_argument('--corpus_document_id', help='Re-ingest by corpus_documents.id; resolves PDF from canonical_path or source_registry')
    parser.add_argument('--reprocess-corpus-document-id', dest='reprocess_corpus_document_id', help='Same as --corpus_document_id; re-ingest existing corpus_documents row by id')
    parser.add_argument('--source_name', default='CISA', help='Source name (default: CISA)')
    parser.add_argument('--title', help='Document title (required when not using --corpus_document_id or --reprocess-corpus-document-id)')
    parser.add_argument('--published_at', help='Published date (ISO format)')
    parser.add_argument('--authority_scope', help='Authority scope e.g. BASELINE_AUTHORITY (required when not using --corpus_document_id or --reprocess-corpus-document-id)')
    parser.add_argument('--source_registry_id', required=False, help='Source registry UUID (REQUIRED for new ingests, optional for reprocess mode)')
    parser.add_argument('--canonical_source_id', help='Optional UUID to validate in RUNTIME canonical_sources')
    parser.add_argument('--module-code', dest='module_code', help='Module code (required for MODULE ingestion stream)')
    parser.add_argument('--chunk_chars', type=int, default=1800, help='Chunk size in characters (default: 1800)')
    parser.add_argument('--overlap_chars', type=int, default=200, help='Overlap size in characters (default: 200)')
    parser.add_argument('--ingestion-stream', dest='ingestion_stream', 
                       choices=['GENERAL', 'MODULE', 'SECTOR_SUBSECTOR'],
                       help='Ingestion stream: GENERAL, MODULE, or SECTOR_SUBSECTOR')
    parser.add_argument('--sector', help='Sector code (required for SECTOR_SUBSECTOR stream)')
    parser.add_argument('--subsector', help='Subsector code (required for SECTOR_SUBSECTOR stream)')
    parser.add_argument('--technology_library', type=int, default=0, help='If 1, treat as Technology Library (document_role=TECHNOLOGY_LIBRARY, use TECHNOLOGY_SOURCES_ROOT for path resolution)')
    parser.add_argument('--skip-no-text', dest='skip_no_text', action='store_true', help='If set, skip PDFs from which no text can be extracted instead of failing (exit 0)')
    
    args = parser.parse_args()

    cid = (getattr(args, 'reprocess_corpus_document_id', None) or args.corpus_document_id or '').strip() or None
    if not cid and not args.pdf_path:
        parser.error('Provide --pdf_path or --corpus_document_id or --reprocess-corpus-document-id')
    if not cid and (not args.title or not args.authority_scope):
        parser.error('--title and --authority_scope required when not using --corpus_document_id or --reprocess-corpus-document-id')
    # HARD REQUIREMENT: source_registry_id is required for new ingests (not reprocess mode)
    if not cid and not args.source_registry_id:
        parser.error('--source_registry_id is REQUIRED for new ingests. All corpus_documents must be linked to Source Registry to be traceable.')

    # Validate ingestion_stream requirements
    if args.ingestion_stream == 'MODULE' and not args.module_code:
        parser.error('--module-code is required when --ingestion-stream=MODULE')
    if args.ingestion_stream == 'SECTOR_SUBSECTOR' and (not args.sector or not args.subsector):
        parser.error('--sector and --subsector are required when --ingestion-stream=SECTOR_SUBSECTOR')
    
    try:
        result = ingest_pdf(
            pdf_path=args.pdf_path,
            source_name=args.source_name,
            title=args.title,
            published_at=args.published_at,
            authority_scope=args.authority_scope,
            source_registry_id=args.source_registry_id,
            chunk_chars=args.chunk_chars,
            overlap_chars=args.overlap_chars,
            canonical_source_id=args.canonical_source_id,
            corpus_document_id=cid,
            ingestion_stream=args.ingestion_stream,
            module_code=args.module_code,
            sector=args.sector,
            subsector=args.subsector,
            technology_library=(getattr(args, 'technology_library', 0) == 1),
            skip_no_text=getattr(args, 'skip_no_text', False),
        )
        
        if result.get('skipped'):
            print(result.get('message', 'Skipped (no text extracted)'), file=sys.stderr)
            sys.exit(0)
        
        import json
        print(json.dumps(result, indent=2))
        
        # Print document_id for next step
        print(f"\n✅ Document ingested: {result['document_id']}")
        print(f"   Chunks: {result['chunks_count']}")
        print(f"   Pages: {result.get('pages_extracted', result.get('pages_total', 0))} extracted / {result.get('pages_total', 0)} total")
        print(f"   Extraction coverage: {result.get('extraction_coverage_pct', 0)}%")
        print(f"   Extractor: {result.get('extractor_version', 'unknown')}")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

