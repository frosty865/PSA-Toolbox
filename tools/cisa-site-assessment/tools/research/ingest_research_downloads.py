#!/usr/bin/env python3
"""
Research Downloads Ingestion Script

Reads a research download manifest and ingests all downloaded files into CORPUS:
1. Creates/updates source registry entries from URLs
2. Ingests PDFs using corpus_ingest_pdf.py logic
3. Ingests HTML files (basic text extraction)
4. Links everything via source_registry_id

Usage:
    python tools/research/ingest_research_downloads.py \
        --manifest analytics/research/MODULE_EV_CHARGING_download_manifest.json \
        [--authority_scope BASELINE_AUTHORITY] \
        [--dry-run]
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse
from datetime import datetime

# Add parent directory to path for imports
# corpus_ingest_pdf.py is in tools/ directory (parent of research/)
sys.path.insert(0, str(Path(__file__).parent.parent))

import psycopg2
from urllib.parse import urlparse

# Import PDF ingestion function
from corpus_ingest_pdf import (
    get_corpus_db_connection,
    ingest_pdf,
    sha256_hash as pdf_sha256_hash,
)


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


def normalize_source_key(url: str, title: Optional[str] = None) -> str:
    """
    Generate deterministic source_key from URL or title.
    Rules: uppercase, alphanumeric + underscore, 6-50 chars (prefer shorter), starts with letter.
    """
    # Use title if available, else derive from URL
    if title:
        base = title
    else:
        parsed = urlparse(url)
        # Use domain + path stem
        domain = parsed.netloc.replace('www.', '').split('.')[0]
        path_stem = Path(parsed.path).stem or 'source'
        base = f"{domain}_{path_stem}"
    
    # Normalize: uppercase, alphanumeric + underscore only
    normalized = re.sub(r'[^A-Z0-9_]', '_', base.upper())
    normalized = re.sub(r'_+', '_', normalized).strip('_')
    
    # Ensure starts with letter
    if normalized and normalized[0].isdigit():
        normalized = f"SRC_{normalized}"
    
    # Ensure minimum length
    if len(normalized) < 6:
        normalized = normalized + "_DOC"
    
    # Truncate to max 50 characters (prefer shorter keys)
    if len(normalized) > 50:
        # Try to truncate at a word boundary (underscore)
        truncated = normalized[:50]
        last_underscore = truncated.rfind('_')
        if last_underscore > 30:
            # Use boundary if it's not too short
            normalized = truncated[:last_underscore]
        else:
            normalized = truncated
    
    return normalized


def extract_publisher_from_url(url: str) -> str:
    """Extract publisher name from URL domain."""
    parsed = urlparse(url)
    domain = parsed.netloc.replace('www.', '')
    
    # Try to extract organization name
    parts = domain.split('.')
    if len(parts) >= 2:
        org = parts[-2]  # e.g., "fema" from "fema.gov"
        return org.upper().replace('-', ' ')
    
    return domain.upper()


def extract_title_from_url(url: str) -> str:
    """Extract title from URL path."""
    parsed = urlparse(url)
    path = parsed.path
    
    # Use filename stem
    stem = Path(path).stem
    if stem:
        # Clean up: replace dashes/underscores with spaces, title case
        title = stem.replace('-', ' ').replace('_', ' ')
        return title.title()
    
    # Fallback to domain
    return extract_publisher_from_url(url)


def upsert_source_registry(
    conn,
    url: str,
    title: Optional[str] = None,
    publisher: Optional[str] = None,
    published_date: Optional[str] = None,
    authority_scope: str = "BASELINE_AUTHORITY",
    dry_run: bool = False
) -> Optional[str]:
    """
    Upsert source registry entry. Returns source_registry_id UUID.
    """
    cur = conn.cursor()
    
    # Generate deterministic fields
    source_key = normalize_source_key(url, title)
    effective_title = title or extract_title_from_url(url)
    effective_publisher = publisher or extract_publisher_from_url(url)
    
    # Map authority_scope to tier
    tier_map = {
        "BASELINE_AUTHORITY": 1,
        "SECTOR_AUTHORITY": 2,
        "SUBSECTOR_AUTHORITY": 3,
    }
    tier = tier_map.get(authority_scope, 2)  # Default to tier 2
    
    # Determine source_type from URL
    parsed = urlparse(url)
    if parsed.path.lower().endswith('.pdf'):
        source_type = 'pdf'
    elif parsed.scheme in ['http', 'https']:
        source_type = 'web'
    else:
        source_type = 'doc'
    
    if dry_run:
        print(f"  [DRY-RUN] Would upsert source_registry:")
        print(f"    source_key: {source_key}")
        print(f"    title: {effective_title}")
        print(f"    publisher: {effective_publisher}")
        print(f"    url: {url}")
        return None
    
    # Check if exists by source_key
    cur.execute("""
        SELECT id, canonical_url FROM public.source_registry
        WHERE source_key = %s
    """, (source_key,))
    
    existing = cur.fetchone()
    
    if existing:
        source_registry_id = existing[0]
        # Update URL if different
        if existing[1] != url:
            cur.execute("""
                UPDATE public.source_registry
                SET canonical_url = %s, updated_at = NOW()
                WHERE id = %s
            """, (url, source_registry_id))
            conn.commit()
        
        # Ensure status is ACTIVE if status column exists
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'source_registry' 
            AND column_name = 'status'
        """)
        has_status_column = cur.fetchone() is not None
        
        if has_status_column:
            cur.execute("""
                UPDATE public.source_registry
                SET status = 'ACTIVE', updated_at = NOW()
                WHERE id = %s AND (status IS NULL OR status != 'ACTIVE')
            """, (source_registry_id,))
            conn.commit()
        
        return str(source_registry_id)
    
    # Insert new entry
    # Check if status column exists
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'source_registry' 
        AND column_name = 'status'
    """)
    has_status_column = cur.fetchone() is not None
    
    if has_status_column:
        # Use status column (new schema)
        cur.execute("""
            INSERT INTO public.source_registry
            (source_key, publisher, tier, title, publication_date, source_type, canonical_url, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            source_key,
            effective_publisher,
            tier,
            effective_title,
            published_date,
            source_type,
            url,
            'ACTIVE'  # Set status to ACTIVE for new entries
        ))
    else:
        # Use source_type only (legacy schema)
        cur.execute("""
            INSERT INTO public.source_registry
            (source_key, publisher, tier, title, publication_date, source_type, canonical_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            source_key,
            effective_publisher,
            tier,
            effective_title,
            published_date,
            source_type,
            url
        ))
    
    source_registry_id = cur.fetchone()[0]
    conn.commit()
    
    return str(source_registry_id)


def ingest_html_file(
    html_path: str,
    source_registry_id: str,
    url: str,
    title: Optional[str] = None,
    rendered_path: Optional[str] = None,
    dry_run: bool = False
) -> Dict:
    """
    HTML ingestion with support for rendered HTML (JS-rendered pages).
    Uses BeautifulSoup for better text extraction.
    Returns same structure as ingest_pdf for consistency.
    """
    import hashlib
    
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        raise SystemExit("ERROR: BeautifulSoup4 not installed. Install with: pip install beautifulsoup4")
    
    # Prefer rendered HTML if available
    actual_html_path = Path(rendered_path) if rendered_path and Path(rendered_path).exists() else Path(html_path)
    
    if not actual_html_path.exists():
        raise FileNotFoundError(f'HTML file not found: {actual_html_path}')
    
    # Read HTML
    with open(actual_html_path, 'rb') as f:
        html_bytes = f.read()
    
    content_hash = hashlib.sha256(html_bytes).hexdigest()
    
    # Parse with BeautifulSoup
    soup = BeautifulSoup(html_bytes, 'html.parser')
    
    # Remove script, style, nav, footer, header tags
    for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'noscript']):
        tag.decompose()
    
    # Try to find main content container
    # Prefer <article> if present, else look for main content div
    main_content = None
    if soup.find('article'):
        main_content = soup.find('article')
    elif soup.find('main'):
        main_content = soup.find('main')
    elif soup.find('div', class_=re.compile(r'content|main|article|post', re.I)):
        main_content = soup.find('div', class_=re.compile(r'content|main|article|post', re.I))
    else:
        # Fallback to body
        main_content = soup.find('body') or soup
    
    # Extract text
    if main_content:
        full_text = main_content.get_text(separator='\n\n', strip=True)
    else:
        full_text = soup.get_text(separator='\n\n', strip=True)
    
    # Clean up: remove excessive whitespace
    lines = [line.strip() for line in full_text.split('\n') if line.strip()]
    full_text = '\n\n'.join(lines)
    
    # Heuristic: if extracted text is too short, likely JS not captured or empty page
    if len(full_text) < 500:
        raise ValueError(
            f'Extracted text too short ({len(full_text)} chars). '
            f'Likely JavaScript-rendered content not captured. '
            f'Try using --render_html flag when downloading.'
        )
    
    if not full_text.strip():
        raise ValueError('No text extracted from HTML after cleanup')
    
    if dry_run:
        return {
            'document_id': None,
            'source_id': None,
            'chunks_count': len(full_text) // 1800,  # Estimate
            'content_hash': content_hash,
            'status': 'dry-run'
        }
    
    # Use corpus_ingest_pdf logic but adapt for HTML
    # For now, we'll create a simplified ingestion
    # TODO: Implement full HTML chunking similar to PDF
    
    # Connect to CORPUS database
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Check if document already exists
        cur.execute("""
            SELECT id FROM public.corpus_documents
            WHERE file_hash = %s
        """, (content_hash,))
        
        existing = cur.fetchone()
        if existing:
            document_id = existing[0]
            print(f"  [SKIP] Document already exists: {document_id}")
            return {
                'document_id': str(document_id),
                'chunks_count': 0,
                'content_hash': content_hash,
                'status': 'exists'
            }
        
        # Insert corpus_documents row
        effective_title = title or extract_title_from_url(url)
        
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'corpus_documents'
            AND column_name = 'source_registry_id'
        """)
        has_source_registry_id_col = cur.fetchone() is not None
        
        insert_cols = [
            'file_hash', 'original_filename', 'file_stem', 'inferred_title',
            'title_confidence', 'source_url'
        ]
        insert_vals = [
            content_hash,
            actual_html_path.name,
            actual_html_path.stem,
            effective_title,
            30,  # Low confidence for HTML
            url
        ]
        
        # GUARDRAIL: Ensure source_registry_id is included in INSERT
        if has_source_registry_id_col:
            if not source_registry_id:
                conn.rollback()
                raise ValueError(
                    'GUARDRAIL: Refusing to INSERT corpus_documents without source_registry_id. '
                    'All documents must be linked to Source Registry to be traceable.'
                )
            insert_cols.append('source_registry_id')
            insert_vals.append(source_registry_id)
        
        placeholders = ', '.join(['%s'] * len(insert_vals))
        cur.execute(f"""
            INSERT INTO public.corpus_documents 
            ({', '.join(insert_cols)})
            VALUES ({placeholders})
            RETURNING id
        """, tuple(insert_vals))
        
        document_id = cur.fetchone()[0]
        
        # Chunk text (simple chunking)
        chunk_size = 1800
        overlap = 200
        chunks = []
        start = 0
        
        while start < len(full_text):
            end = start + chunk_size
            if end < len(full_text):
                # Try to break at sentence
                search_start = max(start, end - 200)
                for punct in ['. ', '.\n', '! ', '?\n']:
                    last_idx = full_text[search_start:end].rfind(punct)
                    if last_idx > 0:
                        end = search_start + last_idx + len(punct)
                        break
            
            chunk_text = full_text[start:end].strip()
            if len(chunk_text) >= 200:
                chunks.append(chunk_text)
            
            start = end - overlap
            if start >= len(full_text):
                break
        
        # Check if locator columns exist
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'document_chunks'
            AND column_name IN ('locator_type', 'locator')
        """)
        locator_cols = {row[0] for row in cur.fetchall()}
        
        # Insert chunks
        chunks_inserted = 0
        chunk_ids = []  # Collect chunk IDs for module linking
        for idx, chunk_text in enumerate(chunks):
            insert_cols = ['document_id', 'chunk_index', 'page_number', 'chunk_text']
            insert_vals = [document_id, idx, 1, chunk_text]
            
            if 'locator_type' in locator_cols:
                insert_cols.append('locator_type')
                insert_vals.append('HTML')
            
            if 'locator' in locator_cols:
                insert_cols.append('locator')
                insert_vals.append(f'Section {idx + 1}')
            
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
                insert_cols_str = ', '.join(insert_cols)
                cur.execute(f"""
                    INSERT INTO public.document_chunks
                    ({insert_cols_str})
                    VALUES ({placeholders})
                    RETURNING {chunk_id_col}
                """, tuple(insert_vals))
                chunk_row = cur.fetchone()
                if chunk_row:
                    chunk_ids.append(str(chunk_row[0]))
            else:
                # No chunk_id column, insert without returning
                cur.execute(f"""
                    INSERT INTO public.document_chunks
                    ({', '.join(insert_cols)})
                    VALUES ({placeholders})
                """, tuple(insert_vals))
            
            chunks_inserted += 1
        
        conn.commit()
        
        return {
            'document_id': str(document_id),
            'chunks_count': chunks_inserted,
            'chunk_ids': chunk_ids,  # List of chunk UUIDs for module linking
            'content_hash': content_hash,
            'status': 'ingested'
        }
        
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description='Ingest research download manifest into CORPUS database'
    )
    parser.add_argument(
        '--manifest',
        required=True,
        help='Path to download manifest JSON (e.g., analytics/research/MODULE_EV_CHARGING_download_manifest.json)'
    )
    parser.add_argument(
        '--authority_scope',
        default='BASELINE_AUTHORITY',
        choices=['BASELINE_AUTHORITY', 'SECTOR_AUTHORITY', 'SUBSECTOR_AUTHORITY'],
        help='Authority scope for source registry (default: BASELINE_AUTHORITY)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Print what would be done without making changes'
    )
    parser.add_argument(
        '--module_code',
        help='Module code for linking ingested documents/chunks to module (e.g., MODULE_EV_PARKING)'
    )
    
    args = parser.parse_args()
    
    # Load manifest
    manifest_path = Path(args.manifest)
    if not manifest_path.exists():
        print(f"ERROR: Manifest file not found: {manifest_path}", file=sys.stderr)
        sys.exit(1)
    
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    
    manifest_module_code = manifest.get('module_code', 'UNKNOWN')
    module_code = args.module_code or manifest_module_code
    
    if args.module_code and args.module_code != manifest_module_code:
        print(f"WARNING: Provided module_code ({args.module_code}) != manifest module_code ({manifest_module_code})")
        print(f"Using provided module_code: {module_code}")
    
    downloaded = manifest.get('downloaded', [])
    
    if not downloaded:
        print("ERROR: No downloaded files in manifest", file=sys.stderr)
        sys.exit(1)
    
    print(f"[INGESTION] Processing {len(downloaded)} files for {module_code}")
    if args.dry_run:
        print("[DRY-RUN] No database changes will be made")
    
    # Import linking helper
    try:
        from link_module_documents import link_document_to_module
        linking_enabled = True
    except ImportError:
        print("WARNING: Module linking disabled (link_module_documents not found)")
        linking_enabled = False
    
    # Connect to CORPUS database (only if not dry-run)
    conn = None
    if not args.dry_run:
        load_env_file('.env.local')
        conn = get_corpus_db_connection()
    
    results = {
        'ingested': [],
        'skipped': [],
        'failed': []
    }
    
    for idx, item in enumerate(downloaded, 1):
        url = item.get('url', '')
        saved_path = item.get('saved_path', '')
        content_type = item.get('content_type', '')
        sha256 = item.get('sha256', '')
        
        if not saved_path or not Path(saved_path).exists():
            print(f"[{idx}/{len(downloaded)}] SKIP: File not found: {saved_path}")
            results['skipped'].append({'url': url, 'reason': 'file_not_found'})
            continue
        
        print(f"[{idx}/{len(downloaded)}] Processing: {Path(saved_path).name}")
        
        try:
            # 1. Upsert source registry
            if conn:
                source_registry_id = upsert_source_registry(
                    conn,
                    url=url,
                    authority_scope=args.authority_scope,
                    dry_run=args.dry_run
                )
            else:
                source_registry_id = None
            
            if args.dry_run:
                source_registry_id = "dry-run-uuid"
            
            # 2. Ingest file based on type
            if saved_path.lower().endswith('.pdf'):
                if args.dry_run:
                    print(f"  [DRY-RUN] Would ingest PDF: {saved_path}")
                    results['ingested'].append({
                        'url': url,
                        'type': 'pdf',
                        'status': 'dry-run'
                    })
                else:
                    # Extract title from URL for now
                    title = extract_title_from_url(url)
                    
                    result = ingest_pdf(
                        pdf_path=saved_path,
                        source_name=extract_publisher_from_url(url),
                        title=title,
                        authority_scope=args.authority_scope,
                        source_registry_id=source_registry_id,
                        module_code=module_code if linking_enabled else None
                    )
                    print(f"  [OK] Ingested PDF: {result['document_id']} ({result['chunks_count']} chunks)")
                    
                    # Link to module if enabled
                    if linking_enabled and module_code and result.get('document_id'):
                        try:
                            link_result = link_document_to_module(
                                module_code=module_code,
                                source_url=url,
                                sha256=sha256,
                                corpus_document_id=result.get('document_id'),
                                chunk_ids=result.get('chunk_ids', [])
                            )
                            print(f"  [LINK] Linked to module: {link_result['linked_documents']} docs, {link_result['linked_chunks']} chunks")
                            result['module_linked'] = link_result
                        except Exception as link_err:
                            print(f"  WARNING: Failed to link to module: {link_err}")
                    
                    results['ingested'].append({
                        'url': url,
                        'type': 'pdf',
                        'document_id': result['document_id'],
                        'chunks_count': result['chunks_count']
                    })
            
            elif saved_path.lower().endswith(('.html', '.htm')) or saved_path.lower().endswith('.rendered.html'):
                if args.dry_run:
                    print(f"  [DRY-RUN] Would ingest HTML: {saved_path}")
                    results['ingested'].append({
                        'url': url,
                        'type': 'html',
                        'status': 'dry-run'
                    })
                else:
                    title = extract_title_from_url(url)
                    # Check if rendered HTML is available
                    rendered_path = item.get('rendered_path')
                    if rendered_path and Path(rendered_path).exists():
                        print(f"  [INFO] Using rendered HTML: {Path(rendered_path).name}")
                    
                    result = ingest_html_file(
                        html_path=saved_path,
                        source_registry_id=source_registry_id,
                        url=url,
                        title=title,
                        rendered_path=rendered_path,
                        dry_run=args.dry_run
                    )
                    print(f"  [OK] Ingested HTML: {result['document_id']} ({result['chunks_count']} chunks)")
                    
                    # Link to module if enabled
                    if linking_enabled and module_code and result.get('document_id'):
                        try:
                            link_result = link_document_to_module(
                                module_code=module_code,
                                source_url=url,
                                sha256=sha256,
                                corpus_document_id=result.get('document_id'),
                                chunk_ids=result.get('chunk_ids', [])
                            )
                            print(f"  [LINK] Linked to module: {link_result['linked_documents']} docs, {link_result['linked_chunks']} chunks")
                            result['module_linked'] = link_result
                        except Exception as link_err:
                            print(f"  WARNING: Failed to link to module: {link_err}")
                    
                    results['ingested'].append({
                        'url': url,
                        'type': 'html',
                        'document_id': result['document_id'],
                        'chunks_count': result['chunks_count']
                    })
            
            else:
                print(f"  [SKIP] Unsupported file type: {content_type}")
                results['skipped'].append({
                    'url': url,
                    'reason': f'unsupported_type: {content_type}'
                })
        
        except Exception as e:
            print(f"  [FAIL] Error: {str(e)}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            results['failed'].append({
                'url': url,
                'error': str(e)
            })
    
    if conn:
        conn.close()
    
    # Summary
    print(f"\n[SUMMARY]")
    print(f"  Ingested: {len(results['ingested'])}")
    print(f"  Skipped: {len(results['skipped'])}")
    print(f"  Failed: {len(results['failed'])}")
    
    if results['failed']:
        print(f"\n[FAILURES]")
        for fail in results['failed']:
            print(f"  - {fail['url']}: {fail['error']}")
    
    # Save results
    results_path = manifest_path.parent / f"{module_code}_ingestion_results.json"
    with open(results_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    print(f"\n[OK] Results saved to: {results_path}")


if __name__ == '__main__':
    main()
