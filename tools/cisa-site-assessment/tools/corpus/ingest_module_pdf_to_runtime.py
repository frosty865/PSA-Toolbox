#!/usr/bin/env python3
"""
Ingest Module PDF into RUNTIME module_documents and module_chunks

Module uploads should NEVER go into CORPUS. This script ingests PDFs directly
into RUNTIME.module_documents and RUNTIME.module_chunks.

Storage: PDFs go under raw/<sha256>.pdf (flat raw/, no additional folders).
Ingestion lands in incoming/ then files are copied to raw/.

Usage:
    python tools/corpus/ingest_module_pdf_to_runtime.py \
        --pdf-path <path> \
        --module-code MODULE_EV_PARKING \
        --label "Document Title"
"""

import os
import sys
import hashlib
import argparse
from pathlib import Path
from typing import List, Tuple, Optional, Dict
from urllib.parse import urlparse
import json

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

# Import PDF extraction from corpus_ingest_pdf
try:
    from tools.corpus_ingest_pdf import extract_text_from_pdf_pages, chunk_text_with_overlap
except ImportError:
    print("ERROR: Could not import from corpus_ingest_pdf. Make sure tools/corpus_ingest_pdf.py exists.")
    sys.exit(1)

try:
    from model.ingest.pdf_citation_extractor import scrape_source_metadata_from_content
except ImportError:
    scrape_source_metadata_from_content = None

def get_runtime_connection():
    """Get RUNTIME database connection with SSL support"""
    # Try RUNTIME_DATABASE_URL or DATABASE_URL first
    runtime_url = os.getenv("RUNTIME_DATABASE_URL") or os.getenv("DATABASE_URL")

    if runtime_url:
        from tools.db.dsn_sanitize import sanitize_psycopg2_dsn
        runtime_url = sanitize_psycopg2_dsn(runtime_url)
        return psycopg2.connect(runtime_url)
    
    # Fallback to SUPABASE_RUNTIME_URL + password pattern
    supabase_url = os.getenv("SUPABASE_RUNTIME_URL")
    supabase_password = os.getenv("SUPABASE_RUNTIME_DB_PASSWORD")
    
    if supabase_url and supabase_password:
        clean_password = supabase_password.strip().strip('"').strip("'").replace("\\", "")
        clean_url = supabase_url.strip().strip('"').strip("'").replace("\\", "").replace(" ", "")
        url = urlparse(clean_url)
        project_ref = url.hostname.split(".")[0] if url.hostname else None
        
        if not project_ref:
            raise ValueError(f"Could not parse project_ref from SUPABASE_RUNTIME_URL: {supabase_url}")
        
        # Try pooler port 6543 first, then direct port 5432
        for port in (6543, 5432):
            try:
                connection_string = f"postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:{port}/postgres?sslmode=require"
                return psycopg2.connect(connection_string)
            except psycopg2.OperationalError as e:
                if port == 5432:  # Last attempt
                    raise
                continue
        
        raise RuntimeError("Could not connect to RUNTIME DB on either port")
    
    raise ValueError("RUNTIME_DATABASE_URL, DATABASE_URL, or (SUPABASE_RUNTIME_URL + SUPABASE_RUNTIME_DB_PASSWORD) environment variable is required")

def sha256_file(file_path: Path) -> str:
    """Calculate SHA256 hash of file"""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def _get_module_sources_root() -> Path:
    """Root for module storage (raw/_blobs/ lives under this)."""
    root = os.environ.get("MODULE_SOURCES_ROOT")
    if root:
        return Path(root)
    return project_root / "storage" / "module_sources"


def _sanitize_for_filename(s: str, max_len: int = 120) -> str:
    """Sanitize a string for use in filenames: safe chars only, no path separators."""
    if not s or not isinstance(s, str):
        return ""
    s = s.replace("\\", "_").replace("/", "_").replace(":", "-").replace("*", "_")
    s = s.replace("?", "_").replace('"', "_").replace("<", "_").replace(">", "_").replace("|", "_")
    s = " ".join(s.split()).strip()
    if len(s) > max_len:
        s = s[:max_len].rstrip()
    return s or ""


def _parsed_blob_basename(title: Optional[str], publisher: Optional[str], year: Optional[int]) -> Optional[str]:
    """Build parsed basename: Title-Author-Year (no extension). Returns None if no usable title."""
    title_clean = _sanitize_for_filename(title, max_len=100) if title else ""
    author_clean = _sanitize_for_filename(publisher, max_len=80) if publisher else ""
    year_str = str(year) if year and 1900 <= year <= 2100 else ""
    if not title_clean:
        return None
    parts = [title_clean]
    if author_clean:
        parts.append(author_clean)
    if year_str:
        parts.append(year_str)
    return "-".join(parts) if parts else None


def _blob_relpath(sha256: str) -> str:
    """Canonical relpath: raw/<sha256>.pdf (no additional folders under raw)."""
    return f"raw/{sha256}.pdf"


def _resolve_blob_relpath(pdf_path: Path, sha256: str, cur) -> str:
    """
    Use flat raw/ path: raw/<sha256>.pdf. No _blobs or prefix subdirs.
    """
    return _blob_relpath(sha256)


def ingest_module_pdf(
    pdf_path: str,
    module_code: str,
    label: str,
    chunk_chars: int = 1800,
    overlap_chars: int = 200,
) -> Dict:
    """
    Ingest PDF into RUNTIME module_documents and module_chunks.
    
    Returns dict with:
    - module_document_id: UUID of created module_document
    - chunks_count: Number of chunks created
    - status: 'ingested' or 'error'
    - error: Error message if status is 'error'
    """
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        return {
            "status": "error",
            "error": f"PDF not found: {pdf_path}",
            "module_document_id": None,
            "chunks_count": 0,
        }
    
    conn = get_runtime_connection()
    try:
        with conn.cursor() as cur:
            # Calculate SHA256
            sha256 = sha256_file(pdf_path)
            root = _get_module_sources_root()

            # Resolve document_blob: one storage location per SHA256 (shared across modules)
            blob_storage_relpath = None
            cur.execute(
                "SELECT id, storage_relpath FROM public.document_blobs WHERE sha256 = %s LIMIT 1",
                (sha256,),
            )
            blob_row = cur.fetchone()
            if blob_row:
                blob_id, blob_storage_relpath = blob_row[0], blob_row[1]
                blob_abs = root / blob_storage_relpath.replace("\\", "/")
                read_path = pdf_path if not blob_abs.exists() else blob_abs
            else:
                blob_id = None
                # Copy to canonical blob location: parsed name Title-Author-Year.pdf or fallback hash path
                relpath = _resolve_blob_relpath(pdf_path, sha256, cur)
                blob_storage_relpath = relpath
                blob_abs = root / relpath.replace("\\", "/")
                blob_abs.parent.mkdir(parents=True, exist_ok=True)
                if not blob_abs.exists() or blob_abs.resolve() != pdf_path.resolve():
                    import shutil
                    shutil.copy2(pdf_path, blob_abs)
                cur.execute(
                    "INSERT INTO public.document_blobs (sha256, storage_relpath) VALUES (%s, %s) ON CONFLICT (sha256) DO NOTHING RETURNING id",
                    (sha256, relpath),
                )
                row = cur.fetchone()
                if row:
                    blob_id = row[0]
                else:
                    cur.execute("SELECT id FROM public.document_blobs WHERE sha256 = %s LIMIT 1", (sha256,))
                    blob_id = cur.fetchone()[0]
                read_path = blob_abs

            # Check if already ingested for this module
            cur.execute("""
                SELECT id, status FROM public.module_documents
                WHERE module_code = %s AND sha256 = %s
                LIMIT 1
            """, (module_code, sha256))
            
            existing = cur.fetchone()
            if existing:
                doc_id = existing[0]
                status = existing[1]
                if status == 'INGESTED':
                    # Count existing chunks
                    cur.execute("""
                        SELECT COUNT(*) FROM public.module_chunks
                        WHERE module_document_id = %s
                    """, (doc_id,))
                    chunks_count = cur.fetchone()[0]
                    return {
                        "status": "already_ingested",
                        "module_document_id": str(doc_id),
                        "chunks_count": chunks_count,
                    }
                # If status is not INGESTED, we'll re-ingest below
            
            # Extract text from PDF (read from canonical blob path when available)
            print(f"[EXTRACT] Extracting text from {read_path.name}...")
            pages = extract_text_from_pdf_pages(str(read_path), use_ocr=False)
            
            if not pages:
                return {
                    "status": "error",
                    "error": "No text extracted from PDF",
                    "module_document_id": None,
                    "chunks_count": 0,
                }
            
            # Combine all pages into single text for chunking
            full_text = "\n\n".join([text for _, text, _ in pages])
            
            # Chunk text
            print(f"[CHUNK] Chunking text (target: {chunk_chars} chars, overlap: {overlap_chars})...")
            chunks = chunk_text_with_overlap(full_text, chunk_chars, overlap_chars)
            
            if not chunks:
                return {
                    "status": "error",
                    "error": "No chunks created from PDF text",
                    "module_document_id": None,
                    "chunks_count": 0,
                }
            
            print(f"[CHUNK] Created {len(chunks)} chunks")
            
            # Resolved storage path for backward compat (local_path): relative path when we have blob (so it stays valid after moves)
            local_path_str = blob_storage_relpath.replace("\\", "/") if blob_storage_relpath else str(read_path)

            # Scrape publisher from PDF for module_documents.publisher (if column exists)
            publisher = None
            if scrape_source_metadata_from_content:
                try:
                    meta = scrape_source_metadata_from_content(str(read_path))
                    publisher = (meta.get("publisher") or "").strip() or None
                except Exception:
                    pass

            # Create or update module_document (one row per module; document_blob_id links to single file)
            if existing:
                doc_id = existing[0]
                cur.execute("""
                    UPDATE public.module_documents
                    SET label = %s, local_path = %s, sha256 = %s, document_blob_id = %s, status = 'INGESTED', updated_at = NOW(), publisher = %s
                    WHERE id = %s
                """, (label, local_path_str, sha256, blob_id, publisher, doc_id))
                
                # Delete existing chunks
                cur.execute("""
                    DELETE FROM public.module_chunks
                    WHERE module_document_id = %s
                """, (doc_id,))
            else:
                cur.execute("""
                    INSERT INTO public.module_documents
                    (module_code, label, source_type, local_path, sha256, document_blob_id, status, publisher)
                    VALUES (%s, %s, 'MODULE_UPLOAD', %s, %s, %s, 'INGESTED', %s)
                    RETURNING id
                """, (module_code, label, local_path_str, sha256, blob_id, publisher))
                doc_id = cur.fetchone()[0]
            
            # Insert chunks
            print(f"[INSERT] Inserting {len(chunks)} chunks...")
            chunks_inserted = 0
            for chunk_index, chunk_text in enumerate(chunks):
                # Determine page number for locator (find which page this chunk likely came from)
                # Simple heuristic: map chunk position to page
                text_position = sum(len(chunks[i]) for i in range(chunk_index))
                page_num = None
                for page_idx, (page_num_val, page_text, _) in enumerate(pages, 1):
                    page_start = sum(len(pages[i][1]) for i in range(page_idx - 1))
                    page_end = page_start + len(page_text)
                    if page_start <= text_position < page_end:
                        page_num = page_num_val
                        break
                
                # Build locator JSONB
                locator = None
                if page_num:
                    locator = json.dumps({
                        "type": "PDF_PAGE",
                        "page": page_num
                    })
                
                cur.execute("""
                    INSERT INTO public.module_chunks
                    (module_document_id, chunk_index, text, locator)
                    VALUES (%s, %s, %s, %s::jsonb)
                """, (doc_id, chunk_index, chunk_text, locator))
                chunks_inserted += 1
            
            conn.commit()
            
            print(f"[OK] Ingested {chunks_inserted} chunks into module_document {doc_id}")
            
            return {
                "status": "ingested",
                "module_document_id": str(doc_id),
                "chunks_count": chunks_inserted,
            }
            
    except Exception as e:
        conn.rollback()
        import traceback
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        print(f"[ERROR] Ingestion failed: {error_msg}")
        return {
            "status": "error",
            "error": error_msg,
            "module_document_id": None,
            "chunks_count": 0,
        }
    finally:
        conn.close()

def main():
    parser = argparse.ArgumentParser(
        description="Ingest module PDF into RUNTIME module_documents and module_chunks"
    )
    parser.add_argument("--pdf-path", required=True, help="Path to PDF file")
    parser.add_argument("--module-code", required=True, help="Module code (e.g., MODULE_EV_PARKING)")
    parser.add_argument("--label", required=True, help="Document label/title")
    parser.add_argument("--chunk-chars", type=int, default=1800, help="Target chunk size in characters")
    parser.add_argument("--overlap-chars", type=int, default=200, help="Overlap between chunks")
    
    args = parser.parse_args()
    
    result = ingest_module_pdf(
        pdf_path=args.pdf_path,
        module_code=args.module_code,
        label=args.label,
        chunk_chars=args.chunk_chars,
        overlap_chars=args.overlap_chars,
    )
    
    if result["status"] == "error":
        print(f"ERROR: {result['error']}")
        sys.exit(1)
    elif result["status"] == "already_ingested":
        print(f"Already ingested: {result['module_document_id']} ({result['chunks_count']} chunks)")
    else:
        print(f"Success: {result['module_document_id']} ({result['chunks_count']} chunks)")

if __name__ == "__main__":
    main()
