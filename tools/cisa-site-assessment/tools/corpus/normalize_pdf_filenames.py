#!/usr/bin/env python3
"""
Normalize PDF filenames in PSA_SYSTEM_ROOT/data/incoming using source_registry metadata.

This script:
1. Scans all PDFs in the target directory
2. Computes SHA256 hash for each PDF
3. Matches to source_registry by doc_sha256 or local_path
4. Extracts and validates title from PDF first few pages
5. Compares extracted title with source_registry title (warns on mismatch)
6. Renames files to normalized format: {PUBLISHER}_{SOURCE_KEY}.pdf
7. Updates source_registry.local_path if needed

Format: {PUBLISHER}_{SOURCE_KEY}.pdf
- Publisher is normalized (uppercase, alphanumeric + underscore)
- Source key is already normalized (from source_registry)
- Max length: 255 chars (Windows limit)

Validation:
- Extracts title from PDF first few pages using citation extractor
- Compares with source_registry title and warns if mismatch detected
- Uses similarity scoring (exact match, substring match, or Jaccard similarity)
"""

import os
import sys
import hashlib
import re
from pathlib import Path
from typing import Dict, Optional, Tuple
import argparse

# Add project root to path for imports
# Script is in tools/corpus/, so go up 2 levels to project root
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

import psycopg2
from urllib.parse import urlparse
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

# Use PSA_SYSTEM_ROOT environment variable or default to D:\PSA_System
PSA_SYSTEM_ROOT = Path(os.environ.get('PSA_SYSTEM_ROOT', r'D:\PSA_System'))
PDF_DIR = str(PSA_SYSTEM_ROOT / "data" / "incoming")

def get_corpus_db_connection():
    """Get CORPUS database connection."""
    load_env_file('.env.local')
    
    corpus_url = os.getenv('SUPABASE_CORPUS_URL')
    corpus_password = os.getenv('SUPABASE_CORPUS_DB_PASSWORD')
    
    if not corpus_url or not corpus_password:
        raise ValueError('SUPABASE_CORPUS_URL and SUPABASE_CORPUS_DB_PASSWORD must be set')
    
    # Clean password
    clean_password = corpus_password.strip().strip('"').strip("'").replace('\\', '')
    
    url = urlparse(corpus_url)
    project_ref = url.hostname.split('.')[0]
    
    # Try transaction pooler port 6543 first, then direct port 5432
    connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
    
    try:
        return psycopg2.connect(connection_string)
    except psycopg2.OperationalError as e:
        if '6543' in connection_string:
            print(f"[WARN] Connection to port 6543 failed, trying direct port 5432...")
            connection_string_direct = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string_direct)
        raise

def sha256_hash(data: bytes) -> str:
    """Calculate SHA256 hash of bytes."""
    return hashlib.sha256(data).hexdigest()

def normalize_publisher_for_filename(publisher: str) -> str:
    """
    Normalize publisher name for use in filename.
    Rules: uppercase, alphanumeric + underscore only, max 30 chars.
    """
    # Remove common suffixes/prefixes
    normalized = publisher.upper()
    normalized = re.sub(r'\s+(INC|LLC|CORP|CORPORATION|GOV|GOVERNMENT|AGENCY|DEPARTMENT|DEPT|DIVISION|DIV)', '', normalized)
    
    # Normalize: uppercase, alphanumeric + underscore only
    normalized = re.sub(r'[^A-Z0-9_]', '_', normalized)
    normalized = re.sub(r'_+', '_', normalized).strip('_')
    
    # Truncate to max 30 chars (leave room for source_key and .pdf)
    if len(normalized) > 30:
        normalized = normalized[:30].rstrip('_')
    
    # Ensure minimum length
    if len(normalized) < 2:
        normalized = "SRC"
    
    return normalized

def sanitize_filename(filename: str, max_length: int = 250) -> str:
    """
    Sanitize filename for Windows filesystem.
    Removes invalid characters and ensures length limit.
    """
    # Remove invalid Windows filename characters: < > : " / \ | ? *
    sanitized = re.sub(r'[<>:"/\\|?*]', '_', filename)
    
    # Remove leading/trailing dots and spaces (Windows doesn't allow)
    sanitized = sanitized.strip('. ')
    
    # Ensure .pdf extension
    if not sanitized.lower().endswith('.pdf'):
        sanitized = sanitized + '.pdf'
    
    # Truncate if too long (leave room for .pdf)
    if len(sanitized) > max_length:
        base = sanitized[:-4]  # Remove .pdf
        sanitized = base[:max_length - 4] + '.pdf'
    
    return sanitized

def compute_file_hash(file_path: Path) -> str:
    """Compute SHA256 hash of file."""
    with open(file_path, 'rb') as f:
        return sha256_hash(f.read())

def find_source_registry_match(conn, file_hash: str, file_path: str) -> Optional[Dict]:
    """
    Find matching source_registry entry by doc_sha256 or local_path.
    Returns dict with id, publisher, source_key, title, local_path, or None.
    """
    cur = conn.cursor()
    
    # Try matching by doc_sha256 first (most reliable)
    cur.execute("""
        SELECT id, publisher, source_key, title, local_path, doc_sha256
        FROM public.source_registry
        WHERE doc_sha256 = %s
    """, (file_hash,))
    
    row = cur.fetchone()
    if row:
        return {
            'id': row[0],
            'publisher': row[1],
            'source_key': row[2],
            'title': row[3],
            'local_path': row[4],
            'doc_sha256': row[5]
        }
    
    # Try matching by local_path (exact match or filename match)
    file_name = Path(file_path).name
    cur.execute("""
        SELECT id, publisher, source_key, title, local_path, doc_sha256
        FROM public.source_registry
        WHERE local_path = %s OR local_path LIKE %s
    """, (file_path, f'%{file_name}'))
    
    row = cur.fetchone()
    if row:
        return {
            'id': row[0],
            'publisher': row[1],
            'source_key': row[2],
            'title': row[3],
            'local_path': row[4],
            'doc_sha256': row[5]
        }
    
    return None

def generate_normalized_filename(publisher: str, source_key: str) -> str:
    """
    Generate normalized filename: {PUBLISHER}_{SOURCE_KEY}.pdf
    """
    norm_publisher = normalize_publisher_for_filename(publisher)
    # Source key is already normalized, but ensure it's safe for filename
    norm_source_key = source_key.replace(' ', '_').replace('/', '_').replace('\\', '_')
    
    filename = f"{norm_publisher}_{norm_source_key}.pdf"
    return sanitize_filename(filename)

def normalize_text_for_comparison(text: str) -> str:
    """Normalize text for comparison (lowercase, remove punctuation/spaces)."""
    normalized = re.sub(r'[^\w]', '', text.lower())
    return normalized

def titles_match(title1: str, title2: str, threshold: float = 0.7) -> Tuple[bool, float]:
    """
    Check if two titles match using normalized comparison.
    Returns (matches, similarity_score).
    """
    norm1 = normalize_text_for_comparison(title1)
    norm2 = normalize_text_for_comparison(title2)
    
    if not norm1 or not norm2:
        return False, 0.0
    
    # Exact match
    if norm1 == norm2:
        return True, 1.0
    
    # Check if one contains the other (substring match)
    if norm1 in norm2 or norm2 in norm1:
        # Calculate similarity based on length ratio
        shorter = min(len(norm1), len(norm2))
        longer = max(len(norm1), len(norm2))
        similarity = shorter / longer if longer > 0 else 0.0
        return similarity >= threshold, similarity
    
    # Calculate Jaccard similarity (word overlap)
    words1 = set(norm1)
    words2 = set(norm2)
    intersection = words1 & words2
    union = words1 | words2
    similarity = len(intersection) / len(union) if union else 0.0
    
    return similarity >= threshold, similarity

def extract_title_from_pdf(file_path: Path) -> Tuple[Optional[str], int]:
    """
    Extract title from PDF first few pages.
    Returns (extracted_title, confidence_score).
    """
    try:
        citation_meta = extract_citation_metadata(str(file_path), original_filename=file_path.name)
        inferred_title = citation_meta.get('inferred_title')
        title_confidence = citation_meta.get('title_confidence', 0)
        
        if inferred_title and title_confidence >= 50:
            return inferred_title, title_confidence
        
        return None, 0
    except Exception as e:
        print(f"    [WARN] Failed to extract title from PDF: {e}")
        return None, 0

def infer_publisher_from_filename(filename: str) -> Optional[str]:
    """
    Infer publisher from filename patterns.
    """
    filename_upper = filename.upper()
    
    # Check for common prefixes
    if filename_upper.startswith('CISA_') or 'CISA-' in filename_upper:
        return 'CISA'
    if filename_upper.startswith('DHS_') or filename_upper.startswith('DHS-') or 'DHS_' in filename_upper:
        return 'DHS'
    if filename_upper.startswith('FEMA_') or filename_upper.startswith('FEMA-') or 'FEMA_' in filename_upper:
        return 'FEMA'
    if filename_upper.startswith('ISC_') or filename_upper.startswith('ISC-') or 'ISC_' in filename_upper:
        return 'ISC'
    if filename_upper.startswith('NIST_') or filename_upper.startswith('NIST-'):
        return 'NIST'
    if 'USSS' in filename_upper or filename_upper.startswith('USSS_'):
        return 'USSS'
    if filename_upper.startswith('UFC_') or 'UFC_' in filename_upper:
        return 'DoD'
    if filename_upper.startswith('DODD_') or 'DODD' in filename_upper:
        return 'DoD'
    if filename_upper.startswith('DODM_') or 'DODM' in filename_upper:
        return 'DoD'
    if 'COPS' in filename_upper or filename_upper.startswith('COPS-'):
        return 'COPS'
    
    return None

def infer_publisher_enhanced(file_path: Path, citation_meta: Dict, extracted_title: Optional[str]) -> str:
    """
    Enhanced publisher inference using multiple sources:
    1. Filename patterns
    2. Citation metadata publisher
    3. Title content
    4. First page text (from citation_meta if available)
    """
    # 1. Try filename first (most reliable for these files)
    filename_publisher = infer_publisher_from_filename(file_path.name)
    if filename_publisher:
        return filename_publisher
    
    # 2. Try citation metadata publisher
    if citation_meta.get('publisher'):
        return citation_meta.get('publisher')
    
    # 3. Check title content for publisher mentions
    if extracted_title:
        title_upper = extracted_title.upper()
        if 'CISA' in title_upper or 'CYBERSECURITY AND INFRASTRUCTURE' in title_upper:
            return 'CISA'
        if 'DHS' in title_upper or 'DEPARTMENT OF HOMELAND SECURITY' in title_upper:
            return 'DHS'
        if 'FEMA' in title_upper or 'FEDERAL EMERGENCY MANAGEMENT' in title_upper:
            return 'FEMA'
        if 'ISC' in title_upper or 'INTERAGENCY SECURITY COMMITTEE' in title_upper:
            return 'ISC'
        if 'USSS' in title_upper or 'U.S. SECRET SERVICE' in title_upper or 'UNITED STATES SECRET SERVICE' in title_upper:
            return 'USSS'
        if 'DOD' in title_upper or 'DEPARTMENT OF DEFENSE' in title_upper:
            return 'DoD'
        if 'COPS' in title_upper or 'COMMUNITY ORIENTED POLICING' in title_upper:
            return 'COPS'
    
    # 4. Try to get first page text from citation extractor (if available)
    # The citation extractor already checks first page, so if it didn't find publisher,
    # we'll default to Unknown
    
    return 'Unknown'

def normalize_source_key_for_registry(title: str, publisher: str) -> str:
    """
    Generate deterministic source_key from title and publisher.
    Rules: uppercase, alphanumeric + underscore, 6-50 chars, starts with letter.
    """
    # Use publisher_title as base
    base = f"{publisher}_{title}" if publisher else title
    
    # Normalize: uppercase, alphanumeric + underscore only
    normalized = re.sub(r'[^A-Z0-9_]', '_', base.upper())
    normalized = re.sub(r'_+', '_', normalized).strip('_')
    
    # Ensure starts with letter
    if normalized and normalized[0].isdigit():
        normalized = f"SRC_{normalized}"
    
    # Ensure minimum length
    if len(normalized) < 6:
        normalized = normalized + "_DOC"
    
    # Truncate to max 50 characters
    if len(normalized) > 50:
        truncated = normalized[:50]
        last_underscore = truncated.rfind('_')
        if last_underscore > 30:
            normalized = truncated[:last_underscore]
        else:
            normalized = truncated
    
    return normalized

def register_pdf_in_source_registry(
    conn, 
    file_path: Path, 
    file_hash: str,
    extracted_title: Optional[str],
    title_confidence: int,
    citation_meta: Dict,
    dry_run: bool = False
) -> Optional[Dict]:
    """
    Register an unregistered PDF in source_registry.
    Returns dict with id, publisher, source_key, title, local_path, or None if failed.
    """
    cur = conn.cursor()
    
    # Extract metadata (never use hash-like stem as title)
    _raw_title = extracted_title or citation_meta.get('inferred_title') or file_path.stem.replace('_', ' ').replace('-', ' ')
    title = _raw_title if (_raw_title and not is_hash_like_title(_raw_title)) else "Untitled document"
    publisher = citation_meta.get('publisher') or 'Unknown'
    publication_date = citation_meta.get('publication_date')
    
    # Generate source_key
    source_key = normalize_source_key_for_registry(title, publisher)
    
    # Determine tier based on publisher (default to tier 3)
    tier = 3
    publisher_upper = publisher.upper()
    if 'CISA' in publisher_upper or 'DHS' in publisher_upper or 'USSS' in publisher_upper or 'NATIONAL LAB' in publisher_upper:
        tier = 1
    elif 'FEMA' in publisher_upper or 'ISC' in publisher_upper or 'NIST' in publisher_upper or 'DOD' in publisher_upper:
        tier = 2
    
    if dry_run:
        print(f"    [DRY-RUN] Would register in source_registry:")
        print(f"      source_key: {source_key}")
        print(f"      title: {title[:60]}...")
        print(f"      publisher: {publisher}")
        print(f"      tier: {tier}")
        return None
    
    # Check if source_key already exists
    cur.execute("""
        SELECT id, publisher, source_key, title, local_path, doc_sha256
        FROM public.source_registry
        WHERE source_key = %s
    """, (source_key,))
    
    existing = cur.fetchone()
    if existing:
        return {
            'id': existing[0],
            'publisher': existing[1],
            'source_key': existing[2],
            'title': existing[3],
            'local_path': existing[4],
            'doc_sha256': existing[5]
        }
    
    # Check if status column exists
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'source_registry' AND column_name = 'status'
    """)
    has_status_column = cur.fetchone() is not None
    
    # Insert new source_registry entry
    local_path = str(file_path)
    
    if has_status_column:
        cur.execute("""
            INSERT INTO public.source_registry
            (source_key, publisher, tier, title, publication_date, source_type, local_path, doc_sha256, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, publisher, source_key, title, local_path, doc_sha256
        """, (
            source_key,
            publisher[:120],  # Truncate to max length
            tier,
            title[:200],  # Truncate to max length
            publication_date,
            'pdf',
            local_path,
            file_hash,
            'ACTIVE'
        ))
    else:
        cur.execute("""
            INSERT INTO public.source_registry
            (source_key, publisher, tier, title, publication_date, source_type, local_path, doc_sha256)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, publisher, source_key, title, local_path, doc_sha256
        """, (
            source_key,
            publisher[:120],
            tier,
            title[:200],
            publication_date,
            'pdf',
            local_path,
            file_hash
        ))
    
    row = cur.fetchone()
    conn.commit()
    cur.close()
    
    return {
        'id': row[0],
        'publisher': row[1],
        'source_key': row[2],
        'title': row[3],
        'local_path': row[4],
        'doc_sha256': row[5]
    }

def register_pdf_in_source_registry(
    conn, 
    file_path: Path, 
    file_hash: str,
    extracted_title: Optional[str],
    title_confidence: int,
    citation_meta: Dict,
    dry_run: bool = False
) -> Optional[Dict]:
    """
    Register an unregistered PDF in source_registry.
    Returns dict with id, publisher, source_key, title, local_path, or None if failed.
    """
    cur = conn.cursor()
    
    # Extract metadata (never use hash-like stem as title)
    _raw_title = extracted_title or citation_meta.get('inferred_title') or file_path.stem.replace('_', ' ').replace('-', ' ')
    title = _raw_title if (_raw_title and not is_hash_like_title(_raw_title)) else "Untitled document"
    publisher = infer_publisher_enhanced(file_path, citation_meta, extracted_title)
    publication_date = citation_meta.get('publication_date')
    
    # Generate source_key
    source_key = normalize_source_key_for_registry(title, publisher)
    
    # Determine tier based on publisher (default to tier 3)
    tier = 3
    publisher_upper = publisher.upper()
    if 'CISA' in publisher_upper or 'DHS' in publisher_upper or 'USSS' in publisher_upper or 'NATIONAL LAB' in publisher_upper:
        tier = 1
    elif 'FEMA' in publisher_upper or 'ISC' in publisher_upper or 'NIST' in publisher_upper or 'DOD' in publisher_upper:
        tier = 2
    
    if dry_run:
        print(f"    [DRY-RUN] Would register in source_registry:")
        print(f"      source_key: {source_key}")
        print(f"      title: {title}")
        print(f"      publisher: {publisher}")
        print(f"      tier: {tier}")
        return None
    
    # Check if source_key already exists
    cur.execute("""
        SELECT id, publisher, source_key, title, local_path, doc_sha256
        FROM public.source_registry
        WHERE source_key = %s
    """, (source_key,))
    
    existing = cur.fetchone()
    if existing:
        return {
            'id': existing[0],
            'publisher': existing[1],
            'source_key': existing[2],
            'title': existing[3],
            'local_path': existing[4],
            'doc_sha256': existing[5]
        }
    
    # Check if status column exists
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'source_registry' AND column_name = 'status'
    """)
    has_status_column = cur.fetchone() is not None
    
    # Insert new source_registry entry
    local_path = str(file_path)
    
    if has_status_column:
        cur.execute("""
            INSERT INTO public.source_registry
            (source_key, publisher, tier, title, publication_date, source_type, local_path, doc_sha256, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, publisher, source_key, title, local_path, doc_sha256
        """, (
            source_key,
            publisher[:120],  # Truncate to max length
            tier,
            title[:200],  # Truncate to max length
            publication_date,
            'pdf',
            local_path,
            file_hash,
            'ACTIVE'
        ))
    else:
        cur.execute("""
            INSERT INTO public.source_registry
            (source_key, publisher, tier, title, publication_date, source_type, local_path, doc_sha256)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, publisher, source_key, title, local_path, doc_sha256
        """, (
            source_key,
            publisher[:120],
            tier,
            title[:200],
            publication_date,
            'pdf',
            local_path,
            file_hash
        ))
    
    row = cur.fetchone()
    conn.commit()
    
    return {
        'id': row[0],
        'publisher': row[1],
        'source_key': row[2],
        'title': row[3],
        'local_path': row[4],
        'doc_sha256': row[5]
    }

def normalize_pdf_file(file_path: Path, conn, dry_run: bool = False, auto_register: bool = False) -> Tuple[bool, str]:
    """
    Normalize a single PDF file.
    Returns (success, message).
    
    Args:
        auto_register: If True, automatically register unregistered PDFs in source_registry
    """
    try:
        # Compute hash
        file_hash = compute_file_hash(file_path)
        
        # Extract title from PDF first (needed for both matching and registration)
        extracted_title, title_confidence = extract_title_from_pdf(file_path)
        citation_meta = {}
        if extracted_title:
            # Get full citation metadata
            try:
                citation_meta = extract_citation_metadata(str(file_path), original_filename=file_path.name)
            except:
                pass
        
        # Find matching source_registry entry
        match = find_source_registry_match(conn, file_hash, str(file_path))
        
        # If not found and auto_register is enabled, register it
        if not match and auto_register:
            match = register_pdf_in_source_registry(
                conn, file_path, file_hash, extracted_title, title_confidence, citation_meta, dry_run
            )
            if match:
                return normalize_pdf_file(file_path, conn, dry_run, auto_register=False)  # Retry with registered entry
            else:
                return False, f"Failed to register PDF in source_registry (dry-run mode)"
        
        if not match:
            if auto_register:
                return False, f"No source_registry match found and auto-registration failed (hash: {file_hash[:16]}...)"
            else:
                return False, f"No source_registry match found (hash: {file_hash[:16]}...). Use --auto-register to register automatically."
        
        # Extract title from PDF first few pages for validation
        extracted_title, title_confidence = extract_title_from_pdf(file_path)
        validation_warnings = []
        
        if extracted_title:
            # Compare extracted title with source_registry title
            db_title = match.get('title', '')
            matches, similarity = titles_match(extracted_title, db_title)
            
            if not matches:
                validation_warnings.append(
                    f"Title mismatch: DB='{db_title[:50]}...' vs PDF='{extracted_title[:50]}...' (similarity: {similarity:.2f})"
                )
            elif similarity < 0.9:
                validation_warnings.append(
                    f"Title similarity: {similarity:.2f} (DB vs PDF may differ slightly)"
                )
        elif title_confidence == 0:
            validation_warnings.append("Could not extract title from PDF (low confidence)")
        
        # Generate normalized filename
        new_filename = generate_normalized_filename(match['publisher'], match['source_key'])
        new_path = file_path.parent / new_filename
        
        # Skip if already normalized
        if file_path.name == new_filename:
            if validation_warnings:
                return True, f"Already normalized: {file_path.name} | {'; '.join(validation_warnings)}"
            return True, f"Already normalized: {file_path.name}"
        
        # Check if target filename already exists (different file)
        if new_path.exists() and new_path != file_path:
            return False, f"Target filename already exists: {new_filename}"
        
        # Build message with validation info
        rename_msg = f"Would rename: {file_path.name} -> {new_filename}" if dry_run else f"Renamed: {file_path.name} -> {new_filename}"
        
        if validation_warnings:
            rename_msg += f" | {'; '.join(validation_warnings)}"
        elif extracted_title:
            rename_msg += f" | Title validated: '{extracted_title[:50]}...' (confidence: {title_confidence})"
        
        if dry_run:
            return True, rename_msg
        
        # Rename file
        file_path.rename(new_path)
        
        # Update source_registry fields for parity (keep DB in sync with file)
        cur = conn.cursor()
        updates = []
        params = []
        
        # Update local_path if changed
        if match['local_path'] != str(new_path):
            updates.append("local_path = %s")
            params.append(str(new_path))
        
        # Update title if extracted title is better (higher confidence or more accurate)
        if extracted_title and title_confidence >= 70:
            db_title = match.get('title', '')
            matches, similarity = titles_match(extracted_title, db_title)
            
            # Update title if:
            # 1. Titles don't match well (similarity < 0.8) - extracted is likely more accurate
            # 2. Extracted title has high confidence (>= 90) and differs
            # 3. DB title is empty or very short
            should_update_title = (
                (not matches or similarity < 0.8) or
                (title_confidence >= 90 and similarity < 0.95) or
                (not db_title or len(db_title.strip()) < 10)
            )
            
            if should_update_title:
                updates.append("title = %s")
                params.append(extracted_title)
                rename_msg += f" | Updated title in DB: '{extracted_title[:50]}...'"
        
        # Update doc_sha256 if not already set (for future matching)
        if not match.get('doc_sha256'):
            updates.append("doc_sha256 = %s")
            params.append(file_hash)
        
        # Execute updates if any
        if updates:
            params.append(match['id'])  # WHERE clause parameter
            cur.execute(f"""
                UPDATE public.source_registry
                SET {', '.join(updates)}, updated_at = now()
                WHERE id = %s
            """, params)
            conn.commit()
        
        cur.close()
        
        return True, rename_msg
        
    except Exception as e:
        return False, f"Error: {str(e)}"

def main():
    """Main normalization function."""
    parser = argparse.ArgumentParser(description='Normalize PDF filenames using source_registry metadata')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be renamed without actually renaming')
    parser.add_argument('--limit', type=int, help='Limit number of files to process (for testing)')
    parser.add_argument('--auto-register', action='store_true', help='Automatically register unregistered PDFs in source_registry before normalizing')
    args = parser.parse_args()
    
    pdf_dir = Path(PDF_DIR)
    if not pdf_dir.exists():
        print(f"❌ PDF directory not found: {PDF_DIR}")
        return
    
    # Find all PDFs
    pdfs = sorted(pdf_dir.glob("*.pdf"))
    
    if not pdfs:
        print(f"❌ No PDFs found in {PDF_DIR}")
        return
    
    if args.limit:
        pdfs = pdfs[:args.limit]
        print(f"⚠️  Limited to first {args.limit} PDFs (for testing)")
    
    print(f"Found {len(pdfs)} PDF files to process")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    if args.auto_register:
        print(f"Auto-register: ENABLED (will register unregistered PDFs)")
    print()
    
    # Connect to database
    try:
        conn = get_corpus_db_connection()
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return
    
    results = {
        'total': len(pdfs),
        'successful': [],
        'failed': [],
        'skipped': []
    }
    
    # Process each PDF
    for i, pdf_path in enumerate(pdfs, 1):
        print(f"[{i}/{len(pdfs)}] {pdf_path.name}")
        
        success, message = normalize_pdf_file(pdf_path, conn, dry_run=args.dry_run, auto_register=args.auto_register)
        
        if success:
            if 'Already normalized' in message:
                results['skipped'].append({
                    'file': str(pdf_path),
                    'reason': 'already_normalized'
                })
            else:
                results['successful'].append({
                    'file': str(pdf_path),
                    'message': message
                })
        else:
            results['failed'].append({
                'file': str(pdf_path),
                'error': message
            })
        
        print(f"  {message}")
        print()
    
    # Close connection
    conn.close()
    
    # Print summary
    print("=" * 60)
    print("NORMALIZATION SUMMARY")
    print("=" * 60)
    print(f"Total PDFs: {results['total']}")
    print(f"Successful: {len(results['successful'])}")
    print(f"Failed: {len(results['failed'])}")
    print(f"Skipped: {len(results['skipped'])}")
    print()
    
    if results['failed']:
        print("Failed PDFs:")
        for item in results['failed']:
            print(f"  - {Path(item['file']).name}: {item['error']}")
        print()
    
    if args.dry_run:
        print("⚠️  DRY RUN MODE - No files were actually renamed")
        print("Run without --dry-run to apply changes")

if __name__ == '__main__':
    main()
