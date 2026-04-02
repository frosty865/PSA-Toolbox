#!/usr/bin/env python3
"""
CORPUS Document Ingestion Script

Ingests a single document (PDF or HTML) into CORPUS database:
1. Upserts canonical_sources row
2. Inserts documents row with content_hash
3. Extracts text and chunks it (200-800 words per chunk)
4. Inserts document_chunks with locator and text_hash

HARD RULE: Only writes to CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
import hashlib
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import re

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import psycopg2
from urllib.parse import urlparse
import json

# Import citation extractor
from model.ingest.pdf_citation_extractor import extract_citation_metadata, is_hash_like_title

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

def get_corpus_db_connection():
    """Get CORPUS database connection."""
    load_env_file('.env.local')
    
    corpus_url = os.getenv('SUPABASE_CORPUS_URL')
    corpus_password = os.getenv('SUPABASE_CORPUS_DB_PASSWORD')
    
    if not corpus_url or not corpus_password:
        raise ValueError('SUPABASE_CORPUS_URL and SUPABASE_CORPUS_DB_PASSWORD must be set')
    
    # Construct connection string
    url = urlparse(corpus_url)
    project_ref = url.hostname.split('.')[0]
    connection_string = f'postgresql://postgres:{corpus_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
    
    return psycopg2.connect(connection_string)

def sha256_hash(data: bytes) -> str:
    """Calculate SHA256 hash of bytes."""
    return hashlib.sha256(data).hexdigest()

def normalize_text_for_hash(text: str) -> str:
    """Normalize text for hashing (remove extra whitespace)."""
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_text_from_pdf(pdf_path: str) -> List[Tuple[int, str]]:
    """Extract text from PDF, returning list of (page_number, text)."""
    try:
        import PyPDF2
    except ImportError:
        try:
            import pdfplumber
        except ImportError:
            raise ImportError('Need PyPDF2 or pdfplumber: pip install PyPDF2 pdfplumber')
    
    pages = []
    
    # Try pdfplumber first (better quality)
    try:
        import pdfplumber
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages, 1):
                text = page.extract_text()
                if text:
                    pages.append((i, text))
        if pages:
            return pages
    except:
        pass
    
    # Fallback to PyPDF2
    try:
        import PyPDF2
        with open(pdf_path, 'rb') as f:
            pdf_reader = PyPDF2.PdfReader(f)
            for i, page in enumerate(pdf_reader.pages, 1):
                text = page.extract_text()
                if text:
                    pages.append((i, text))
    except Exception as e:
        raise ValueError(f'Failed to extract text from PDF: {e}')
    
    return pages

def extract_text_from_html(html_path: str) -> List[Tuple[Optional[int], str]]:
    """Extract text from HTML, returning list of (section_id, text)."""
    from html.parser import HTMLParser
    
    class TextExtractor(HTMLParser):
        def __init__(self):
            super().__init__()
            self.text_parts = []
            self.current_section = None
            self.current_text = []
            
        def handle_starttag(self, tag, attrs):
            if tag in ['h1', 'h2', 'h3', 'section', 'div']:
                self.current_section = tag
            elif tag == 'p':
                self.current_text = []
                
        def handle_data(self, data):
            if data.strip():
                self.current_text.append(data.strip())
                
        def handle_endtag(self, tag):
            if tag == 'p' and self.current_text:
                text = ' '.join(self.current_text)
                if len(text) > 50:  # Only keep substantial paragraphs
                    self.text_parts.append((self.current_section, text))
                self.current_text = []
    
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    parser = TextExtractor()
    parser.feed(content)
    
    return parser.text_parts

def chunk_text(text: str, target_words: int = 500, min_words: int = 200, max_words: int = 800) -> List[str]:
    """Chunk text into 200-800 word chunks."""
    words = text.split()
    
    if len(words) <= min_words:
        return [text] if text.strip() else []
    
    chunks = []
    current_chunk = []
    current_word_count = 0
    
    for word in words:
        current_chunk.append(word)
        current_word_count += 1
        
        # Try to break on sentence boundaries when approaching target
        if current_word_count >= target_words:
            # Look for sentence end in last 50 words
            chunk_text = ' '.join(current_chunk)
            if len(current_chunk) > 50:
                # Find last sentence boundary
                last_50 = ' '.join(current_chunk[-50:])
                for punct in ['. ', '! ', '? ', '.\n', '!\n', '?\n']:
                    if punct in last_50:
                        # Split at this boundary
                        split_idx = chunk_text.rfind(punct)
                        if split_idx > len(chunk_text) * 0.5:  # Don't split too early
                            chunks.append(chunk_text[:split_idx + 1].strip())
                            current_chunk = current_chunk[split_idx // 10:]  # Approximate
                            current_word_count = len(current_chunk)
                            break
            
            # If no sentence boundary or max size reached, force split
            if current_word_count >= max_words:
                chunks.append(' '.join(current_chunk).strip())
                current_chunk = []
                current_word_count = 0
    
    # Add remaining chunk
    if current_chunk:
        chunk_text = ' '.join(current_chunk).strip()
        if len(chunk_text.split()) >= min_words:
            chunks.append(chunk_text)
    
    return chunks

def ingest_document(
    file_path: str,
    title: Optional[str] = None,
    author: Optional[str] = None,
    publisher: Optional[str] = None,
    published_date: Optional[str] = None,
    sector: Optional[str] = None,
    subsector: Optional[str] = None
) -> Dict:
    """Ingest a document into CORPUS database."""
    
    file_path = Path(file_path)
    if not file_path.exists():
        raise FileNotFoundError(f'File not found: {file_path}')
    
    # Read file bytes for hash
    with open(file_path, 'rb') as f:
        file_bytes = f.read()
    
    file_hash = sha256_hash(file_bytes)
    file_ext = file_path.suffix.lower()
    
    # Determine source type
    if file_ext == '.pdf':
        source_type = 'PDF'
        pages = extract_text_from_pdf(str(file_path))
        
        # Extract citation metadata for PDFs
        citation_meta = extract_citation_metadata(str(file_path), original_filename=file_path.name)
        
        # Use inferred_title if available and confidence is good, else use provided title or fallback. NO hash as title.
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
        elif not is_hash_like_title(file_path.stem):
            effective_title = file_path.stem
        else:
            effective_title = "Untitled document"
            citation_meta.setdefault('ingestion_warnings', []).append('title_from_hash_stem_replaced')
    elif file_ext in ['.html', '.htm']:
        source_type = 'HTML'
        pages = extract_text_from_html(str(file_path))
        citation_meta = {}  # No citation extraction for HTML
        effective_title = title or (file_path.stem if not is_hash_like_title(file_path.stem) else "Untitled document")
    else:
        raise ValueError(f'Unsupported file type: {file_ext}')
    
    # Use effective title
    if not title:
        title = effective_title
    
    # Extract all text
    all_text = []
    for page_num, text in pages:
        all_text.append(text)
    
    full_text = '\n\n'.join(all_text)
    
    # Chunk the text
    chunks = []
    for page_num, page_text in pages:
        page_chunks = chunk_text(page_text)
        for chunk_idx, chunk_text_content in enumerate(page_chunks):
            chunks.append({
                'page_number': page_num if isinstance(page_num, int) else None,
                'chunk_index': len(chunks),
                'text': chunk_text_content,
                'text_hash': sha256_hash(normalize_text_for_hash(chunk_text_content).encode('utf-8'))
            })
    
    # Connect to CORPUS database
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # 1. Upsert canonical_sources
        # Use inferred metadata if available (for PDFs)
        canonical_title = effective_title if file_ext == '.pdf' else title
        canonical_author = citation_meta.get('pdf_meta_author') or author if file_ext == '.pdf' else author
        canonical_publisher = citation_meta.get('publisher') or publisher if file_ext == '.pdf' else publisher
        canonical_published_date = citation_meta.get('publication_date') or published_date if file_ext == '.pdf' else published_date
        
        citation_text = canonical_title
        if canonical_author:
            citation_text = f"{canonical_author}, {citation_text}"
        if canonical_published_date:
            citation_text = f"{citation_text}, {canonical_published_date}"
        
        cur.execute("""
            INSERT INTO public.canonical_sources 
            (title, author, publisher, published_date, source_type, uri, citation_text, content_hash)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
            RETURNING source_id
        """, (canonical_title, canonical_author, canonical_publisher, canonical_published_date, source_type, citation_meta.get('source_url') if file_ext == '.pdf' else None, citation_text, file_hash))
        
        result = cur.fetchone()
        if result:
            source_id = result[0]
        else:
            # Source already exists, fetch it
            cur.execute("""
                SELECT source_id FROM public.canonical_sources 
                WHERE content_hash = %s
            """, (file_hash,))
            result = cur.fetchone()
            if not result:
                raise ValueError('Failed to get source_id')
            source_id = result[0]
        
        # 2. Insert documents row (legacy, for backward compatibility)
        if file_ext == '.pdf':
            cur.execute("""
                INSERT INTO public.documents 
                (source_id, title, file_path, file_hash, page_count, sector, subsector,
                 original_filename, file_stem, inferred_title, title_confidence,
                 pdf_meta_title, pdf_meta_author, pdf_meta_subject, pdf_meta_creator,
                 pdf_meta_producer, pdf_meta_creation_date, pdf_meta_mod_date,
                 publisher, publication_date, source_url,
                 citation_short, citation_full, ingestion_warnings)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING document_id
            """, (
                source_id,
                title,  # Keep title for backward compatibility
                str(file_path),
                file_hash,
                len(pages) if pages else None,
                sector,
                subsector,
                file_path.name,
                file_path.stem,
                citation_meta.get('inferred_title'),
                citation_meta.get('title_confidence', 0),
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
            ))
            
            # Insert into corpus_documents (authoritative, PDFs only)
            # GUARDRAIL: Check if source_registry_id column exists and require it
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'corpus_documents'
                AND column_name = 'source_registry_id'
            """)
            has_source_registry_id_col = cur.fetchone() is not None
            
            if has_source_registry_id_col:
                # This script does not support source_registry_id - it's legacy
                # Refuse to create untraceable documents
                conn.rollback()
                raise ValueError(
                    'GUARDRAIL: This script (ingest_one_document.py) does not support source_registry_id. '
                    'Use corpus_ingest_pdf.py with --source_registry_id instead. '
                    'Refusing to create untraceable corpus_documents.'
                )
            
            cur.execute("""
                INSERT INTO public.corpus_documents 
                (file_hash, original_filename, file_stem, inferred_title, title_confidence,
                 pdf_meta_title, pdf_meta_author, pdf_meta_subject, pdf_meta_creator,
                 pdf_meta_producer, pdf_meta_creation_date, pdf_meta_mod_date,
                 publisher, publication_date, source_url,
                 citation_short, citation_full, ingestion_warnings)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (file_hash) DO UPDATE SET
                    original_filename = EXCLUDED.original_filename,
                    file_stem = EXCLUDED.file_stem,
                    inferred_title = CASE 
                        WHEN EXCLUDED.title_confidence > corpus_documents.title_confidence 
                        THEN EXCLUDED.inferred_title 
                        ELSE corpus_documents.inferred_title 
                    END,
                    title_confidence = GREATEST(EXCLUDED.title_confidence, corpus_documents.title_confidence),
                    pdf_meta_title = COALESCE(EXCLUDED.pdf_meta_title, corpus_documents.pdf_meta_title),
                    pdf_meta_author = COALESCE(EXCLUDED.pdf_meta_author, corpus_documents.pdf_meta_author),
                    pdf_meta_subject = COALESCE(EXCLUDED.pdf_meta_subject, corpus_documents.pdf_meta_subject),
                    pdf_meta_creator = COALESCE(EXCLUDED.pdf_meta_creator, corpus_documents.pdf_meta_creator),
                    pdf_meta_producer = COALESCE(EXCLUDED.pdf_meta_producer, corpus_documents.pdf_meta_producer),
                    pdf_meta_creation_date = COALESCE(EXCLUDED.pdf_meta_creation_date, corpus_documents.pdf_meta_creation_date),
                    pdf_meta_mod_date = COALESCE(EXCLUDED.pdf_meta_mod_date, corpus_documents.pdf_meta_mod_date),
                    publisher = COALESCE(EXCLUDED.publisher, corpus_documents.publisher),
                    publication_date = COALESCE(EXCLUDED.publication_date, corpus_documents.publication_date),
                    source_url = COALESCE(EXCLUDED.source_url, corpus_documents.source_url),
                    citation_short = COALESCE(EXCLUDED.citation_short, corpus_documents.citation_short),
                    citation_full = COALESCE(EXCLUDED.citation_full, corpus_documents.citation_full),
                    ingestion_warnings = (
                        SELECT jsonb_agg(DISTINCT elem)
                        FROM jsonb_array_elements(corpus_documents.ingestion_warnings || EXCLUDED.ingestion_warnings) elem
                    )
            """, (
                file_hash,
                file_path.name,
                file_path.stem,
                citation_meta.get('inferred_title'),
                citation_meta.get('title_confidence', 0),
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
            ))
        else:
            cur.execute("""
                INSERT INTO public.documents 
                (source_id, title, file_path, file_hash, page_count, sector, subsector)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING document_id
            """, (source_id, title, str(file_path), file_hash, len(pages) if pages else None, sector, subsector))
        
        document_id = cur.fetchone()[0]
        
        # 3. Insert document_chunks
        for chunk in chunks:
            cur.execute("""
                INSERT INTO public.document_chunks 
                (document_id, chunk_index, page_number, chunk_text)
                VALUES (%s, %s, %s, %s)
            """, (document_id, chunk['chunk_index'], chunk['page_number'], chunk['text']))
        
        conn.commit()
        
        return {
            'source_id': str(source_id),
            'document_id': str(document_id),
            'chunks_count': len(chunks),
            'pages_count': len(pages) if pages else 0,
            'file_hash': file_hash
        }
        
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

def main():
    """CLI entry point."""
    if len(sys.argv) < 2:
        print("Usage: python ingest_one_document.py <file_path> [--title TITLE] [--author AUTHOR] [--publisher PUBLISHER] [--date DATE] [--sector SECTOR] [--subsector SUBSECTOR]")
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    # Parse optional arguments
    title = None
    author = None
    publisher = None
    published_date = None
    sector = None
    subsector = None
    
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--title' and i + 1 < len(sys.argv):
            title = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--author' and i + 1 < len(sys.argv):
            author = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--publisher' and i + 1 < len(sys.argv):
            publisher = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--date' and i + 1 < len(sys.argv):
            published_date = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--sector' and i + 1 < len(sys.argv):
            sector = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--subsector' and i + 1 < len(sys.argv):
            subsector = sys.argv[i + 1]
            i += 2
        else:
            i += 1
    
    try:
        result = ingest_document(
            file_path=file_path,
            title=title,
            author=author,
            publisher=publisher,
            published_date=published_date,
            sector=sector,
            subsector=subsector
        )
        
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()

