#!/usr/bin/env python3
"""
CORPUS: Ingest CISA Mass Gathering PDFs

Ingests CISA mass gathering security planning PDFs into CORPUS.
All files from PSA_SYSTEM_ROOT/data/incoming with source_set=CISA_MASS_GATHERING.

HARD RULE: Only writes to CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
import re
import json
import hashlib
from pathlib import Path
from typing import List, Tuple

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import pdfplumber
from tools.corpus.source_set import get_corpus_db_connection
from tools.corpus.heading_extractor import extract_heading

# Use PSA_SYSTEM_ROOT environment variable or default to D:\PSA_System
PSA_SYSTEM_ROOT = Path(os.environ.get('PSA_SYSTEM_ROOT', r'D:\PSA_System'))
PDF_DIR = str(PSA_SYSTEM_ROOT / "data" / "incoming")
SOURCE_SET = "CISA_MASS_GATHERING"

PDF_NAMES = [
    "MassGatheringSecurityPlanningTool_BlankQuestionSet.pdf",
    "Vehicle_Incident_Prevention_and_Mitigation_Security_Guide_508_20240418.pdf",
    "CISA_AASB_Security_Planning_Workbook_508_Compliant_20230929.pdf",
    "Public_20Venue_20Credentialing_20Guide_508.pdf",
    "Vehicle Ramming - Security Awareness for ST-CP.pdf",
]

def sha256_text(s: str) -> str:
    """Calculate SHA256 hash of text."""
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def clean_text(s: str) -> str:
    """Clean extracted text."""
    s = s.replace("\u00ad", "")  # soft hyphen
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()

def extract_pages(pdf_path: str) -> List[Tuple[int, str]]:
    """Extract text from PDF pages."""
    pages: List[Tuple[int, str]] = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages, start=1):
                txt = page.extract_text(layout=True) or page.extract_text() or ""
                txt = clean_text(txt)
                if txt:
                    pages.append((i, txt))
    except Exception as e:
        print(f"⚠️  Error extracting from {pdf_path}: {e}", file=sys.stderr)
    return pages

def upsert_document(cur, title: str, file_path: str, content_hash: str, source_id: str) -> str:
    """Upsert document record."""
    # Check if document exists by file_hash and source_set
    cur.execute("""
        SELECT document_id FROM public.documents
        WHERE file_hash = %s AND source_set = %s
        LIMIT 1
    """, (content_hash, SOURCE_SET))
    
    existing = cur.fetchone()
    if existing:
        return str(existing[0])
    
    # Create new document
    cur.execute("""
        INSERT INTO public.documents (
            source_id, title, file_path, file_hash,
            source_set, ingested_at
        )
        VALUES (%s, %s, %s, %s, %s, now())
        RETURNING document_id
    """, (source_id, title, file_path, content_hash, SOURCE_SET))
    
    return str(cur.fetchone()[0])

def upsert_chunk(cur, document_id: str, page_no: int, text: str) -> str:
    """Upsert document chunk."""
    locator_type = "PDF"
    locator = f"Page {page_no}"
    
    # HEADING_SUPPORT_V1: Extract section heading from page text
    section_heading = extract_heading(text)
    
    # Check if chunk exists
    cur.execute("""
        SELECT chunk_id FROM public.document_chunks
        WHERE document_id = %s
            AND source_set = %s
            AND locator_type = %s
            AND locator = %s
        LIMIT 1
    """, (document_id, SOURCE_SET, locator_type, locator))
    
    existing = cur.fetchone()
    if existing:
        # Update existing chunk
        cur.execute("""
            UPDATE public.document_chunks
            SET chunk_text = %s, section_heading = %s, updated_at = now()
            WHERE chunk_id = %s
        """, (text, section_heading, existing[0]))
        return str(existing[0])
    
    # Insert new chunk
    cur.execute("""
        INSERT INTO public.document_chunks (
            document_id, chunk_index, page_number, chunk_text,
            source_set, locator_type, locator, section_heading, created_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now())
        RETURNING chunk_id
    """, (document_id, page_no, page_no, text, SOURCE_SET, locator_type, locator, section_heading))
    
    return str(cur.fetchone()[0])

def main() -> None:
    """Main ingestion function."""
    pdf_paths = [os.path.join(PDF_DIR, name) for name in PDF_NAMES]
    missing = [p for p in pdf_paths if not os.path.exists(p)]
    
    if missing:
        print(f"❌ Missing PDFs (check spelling/path):", file=sys.stderr)
        for p in missing:
            print(f"  {p}", file=sys.stderr)
        sys.exit(1)
    
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Get or create canonical source for CISA
        cur.execute("""
            SELECT source_id FROM public.canonical_sources
            WHERE title = 'CISA Mass Gathering Security Planning' AND source_type = 'GUIDE'
            LIMIT 1
        """)
        
        source_row = cur.fetchone()
        if source_row:
            source_id = source_row[0]
        else:
            cur.execute("""
                INSERT INTO public.canonical_sources (
                    title, source_type, citation_text
                )
                VALUES ('CISA Mass Gathering Security Planning', 'GUIDE', 'CISA Mass Gathering Security Planning Documents')
                RETURNING source_id
            """)
            source_id = cur.fetchone()[0]
        
        docs_processed = 0
        chunks_upserted = 0
        
        for pdf_path in pdf_paths:
            title = os.path.basename(pdf_path)
            print(f"Processing: {title}")
            
            pages = extract_pages(pdf_path)
            
            if not pages:
                print(f"  ⚠️  No pages extracted from {title}")
                continue
            
            # Create content hash from filename + page count + first page prefix
            first_prefix = pages[0][1][:800] if pages else ""
            content_hash = sha256_text(f"{title}|pages={len(pages)}|{first_prefix}")
            
            document_id = upsert_document(
                cur, title=title, file_path=pdf_path,
                content_hash=content_hash, source_id=source_id
            )
            docs_processed += 1
            
            for page_no, page_text in pages:
                _ = upsert_chunk(cur, document_id=document_id, page_no=page_no, text=page_text)
                chunks_upserted += 1
            
            print(f"  ✅ {len(pages)} pages processed")
        
        conn.commit()
        
        result = {
            "source_set": SOURCE_SET,
            "pdf_dir": PDF_DIR,
            "documents_processed": docs_processed,
            "chunks_created_or_updated": chunks_upserted
        }
        
        print()
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error during ingestion: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()

