#!/usr/bin/env python3
"""
CORPUS: Bulk Ingest PDFs with Auto-Registration

This script:
1. Scans a PDF directory for PDFs
2. Auto-registers unregistered PDFs in source_registry (if needed)
3. Ingests all PDFs into CORPUS database
4. Handles deduplication and error reporting

HARD RULE: Only writes to CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
from pathlib import Path
from typing import List, Dict, Optional
import json

# Add project root to path for imports
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Import ingestion function
import importlib.util
tools_dir = Path(__file__).parent.parent
spec = importlib.util.spec_from_file_location("corpus_ingest_pdf", tools_dir / "corpus_ingest_pdf.py")
corpus_ingest_pdf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(corpus_ingest_pdf)

# Import normalization functions for auto-registration
sys.path.insert(0, str(Path(__file__).parent))
from normalize_pdf_filenames import (
    get_corpus_db_connection, compute_file_hash,
    find_source_registry_match, register_pdf_in_source_registry,
    extract_title_from_pdf
)
from model.ingest.pdf_citation_extractor import extract_citation_metadata

# Use PSA_SYSTEM_ROOT environment variable or default to D:\PSA_System
PSA_SYSTEM_ROOT = Path(os.environ.get('PSA_SYSTEM_ROOT', r'D:\PSA_System'))
PDF_DIR = str(PSA_SYSTEM_ROOT / "data" / "incoming")
DEFAULT_AUTHORITY_SCOPE = "BASELINE_AUTHORITY"

def find_pdfs(directory: str) -> List[Path]:
    """Find all PDF files in directory."""
    pdf_dir = Path(directory)
    if not pdf_dir.exists():
        print(f"❌ PDF directory not found: {directory}")
        return []
    
    pdfs = list(pdf_dir.glob("*.pdf"))
    return sorted(pdfs)

def ensure_pdf_registered(pdf_path: Path, conn, auto_register: bool = True, dry_run: bool = False) -> Optional[str]:
    """
    Ensure PDF is registered in source_registry.
    Returns source_registry_id (UUID string) or None if not found/registered.
    """
    try:
        # Compute hash
        file_hash = compute_file_hash(pdf_path)
        
        # Find existing registration
        match = find_source_registry_match(conn, file_hash, str(pdf_path))
        
        if match:
            return str(match['id'])
        
        # Not found - auto-register if enabled
        if auto_register and not dry_run:
            print(f"    [AUTO-REGISTER] Registering PDF in source_registry...")
            
            # Extract metadata
            extracted_title, title_confidence = extract_title_from_pdf(pdf_path)
            citation_meta = {}
            if extracted_title or title_confidence > 0:
                try:
                    citation_meta = extract_citation_metadata(str(pdf_path), original_filename=pdf_path.name)
                except:
                    pass
            
            # Register
            registered = register_pdf_in_source_registry(
                conn, pdf_path, file_hash, extracted_title, title_confidence, citation_meta, dry_run=False
            )
            
            if registered:
                return str(registered['id'])
            else:
                print(f"    [WARN] Auto-registration failed")
                return None
        elif auto_register and dry_run:
            print(f"    [DRY-RUN] Would auto-register PDF in source_registry")
            return None
        else:
            print(f"    [WARN] PDF not registered in source_registry (use --auto-register)")
            return None
            
    except Exception as e:
        print(f"    [ERROR] Failed to check/register PDF: {e}")
        return None

def check_already_ingested(conn, file_hash: str) -> bool:
    """Check if PDF is already ingested in corpus_documents."""
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id FROM public.corpus_documents
            WHERE file_hash = %s
        """, (file_hash,))
        return cur.fetchone() is not None
    finally:
        cur.close()

def bulk_ingest_pdf(pdf_path: Path, conn, authority_scope: str, auto_register: bool = True, dry_run: bool = False, skip_no_text: bool = False) -> Dict:
    """
    Bulk ingest a single PDF: register if needed, then ingest.
    Returns result dict with status and details.
    """
    result = {
        'file': str(pdf_path),
        'status': 'unknown',
        'source_registry_id': None,
        'document_id': None,
        'error': None,
        'chunks': 0,
        'pages': 0
    }
    
    try:
        # Compute hash
        file_hash = compute_file_hash(pdf_path)
        
        # Check if already ingested
        if check_already_ingested(conn, file_hash):
            result['status'] = 'already_ingested'
            return result
        
        # Ensure registered in source_registry
        source_registry_id = ensure_pdf_registered(pdf_path, conn, auto_register, dry_run)
        
        if not source_registry_id:
            result['status'] = 'registration_failed'
            result['error'] = 'PDF not registered in source_registry'
            return result
        
        result['source_registry_id'] = source_registry_id
        
        if dry_run:
            result['status'] = 'would_ingest'
            return result
        
        # Extract metadata for ingestion
        extracted_title, title_confidence = extract_title_from_pdf(pdf_path)
        citation_meta = {}
        try:
            citation_meta = extract_citation_metadata(str(pdf_path), original_filename=pdf_path.name)
        except:
            pass
        
        # Get title and publisher from source_registry
        cur = conn.cursor()
        cur.execute("""
            SELECT title, publisher, publication_date
            FROM public.source_registry
            WHERE id = %s
        """, (source_registry_id,))
        reg_row = cur.fetchone()
        cur.close()
        
        if reg_row:
            title = reg_row[0] or extracted_title or pdf_path.stem.replace('_', ' ').replace('-', ' ')
            publisher = reg_row[1] or 'Unknown'
            published_at = reg_row[2]
        else:
            title = extracted_title or pdf_path.stem.replace('_', ' ').replace('-', ' ')
            publisher = citation_meta.get('publisher', 'Unknown')
            published_at = citation_meta.get('publication_date')
        
        # Ingest PDF
        ingest_result = corpus_ingest_pdf.ingest_pdf(
            pdf_path=str(pdf_path),
            source_name=publisher,
            title=title,
            published_at=published_at,
            authority_scope=authority_scope,
            source_registry_id=source_registry_id,
            chunk_chars=1800,
            overlap_chars=200,
            skip_no_text=skip_no_text,
        )
        
        if ingest_result.get('skipped'):
            result['status'] = 'skipped_no_text'
            result['error'] = ingest_result.get('message', 'No text extracted from any page')
            return result
        
        result['status'] = 'ingested'
        result['document_id'] = ingest_result['document_id']
        result['chunks'] = ingest_result['chunks_count']
        result['pages'] = f"{ingest_result['pages_extracted']}/{ingest_result['pages_total']}"
        
        return result
        
    except Exception as e:
        result['status'] = 'failed'
        result['error'] = str(e)
        return result

def main():
    """Main bulk ingestion function."""
    import argparse
    parser = argparse.ArgumentParser(description='Bulk ingest PDFs with auto-registration')
    parser.add_argument('--pdf-dir', default=PDF_DIR, help=f'PDF directory (default: {PDF_DIR})')
    parser.add_argument('--limit', type=int, help='Limit number of PDFs to process (for testing)')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without actually doing it')
    parser.add_argument('--skip-registration', action='store_true', help='Skip auto-registration (fail if not registered)')
    parser.add_argument('--authority-scope', default=DEFAULT_AUTHORITY_SCOPE, help=f'Authority scope (default: {DEFAULT_AUTHORITY_SCOPE})')
    parser.add_argument('--skip-no-text', dest='skip_no_text', action='store_true', help='Skip PDFs from which no text can be extracted instead of failing')
    args = parser.parse_args()
    
    authority_scope = args.authority_scope
    
    pdf_dir = Path(args.pdf_dir)
    if not pdf_dir.exists():
        print(f"❌ PDF directory not found: {pdf_dir}")
        return
    
    # Find PDFs
    pdfs = find_pdfs(str(pdf_dir))
    
    if not pdfs:
        print(f"❌ No PDFs found in {pdf_dir}")
        return
    
    if args.limit:
        pdfs = pdfs[:args.limit]
        print(f"⚠️  Limited to first {args.limit} PDFs (for testing)")
    
    print(f"Found {len(pdfs)} PDF files to process")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print(f"Auto-register: {not args.skip_registration}")
    print()
    
    # Connect to database
    try:
        conn = get_corpus_db_connection()
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return
    
    results = {
        'total': len(pdfs),
        'ingested': [],
        'already_ingested': [],
        'skipped_no_text': [],
        'registration_failed': [],
        'failed': [],
        'would_ingest': []
    }
    
    # Process each PDF
    for i, pdf_path in enumerate(pdfs, 1):
        print(f"[{i}/{len(pdfs)}] {pdf_path.name}")
        
        result = bulk_ingest_pdf(
            pdf_path, 
            conn,
            authority_scope=authority_scope,
            auto_register=not args.skip_registration,
            dry_run=args.dry_run,
            skip_no_text=getattr(args, 'skip_no_text', False),
        )
        
        # Categorize result
        if result['status'] == 'ingested':
            results['ingested'].append(result)
            print(f"  ✅ Ingested: {result['document_id']}")
            print(f"     Chunks: {result['chunks']}, Pages: {result['pages']}")
        elif result['status'] == 'already_ingested':
            results['already_ingested'].append(result)
            print(f"  ⏭️  Already ingested, skipping")
        elif result['status'] == 'skipped_no_text':
            results['skipped_no_text'].append(result)
            print(f"  ⏭️  Skipped (no text): {result.get('error', '')}")
        elif result['status'] == 'registration_failed':
            results['registration_failed'].append(result)
            print(f"  ❌ Registration failed: {result['error']}")
        elif result['status'] == 'would_ingest':
            results['would_ingest'].append(result)
            print(f"  🔍 Would ingest (source_registry_id: {result['source_registry_id']})")
        elif result['status'] == 'failed':
            results['failed'].append(result)
            print(f"  ❌ Failed: {result['error']}")
        
        print()
    
    # Close connection
    conn.close()
    
    # Print summary
    print("=" * 60)
    print("BULK INGESTION SUMMARY")
    print("=" * 60)
    print(f"Total PDFs: {results['total']}")
    print(f"Ingested: {len(results['ingested'])}")
    print(f"Already ingested: {len(results['already_ingested'])}")
    print(f"Skipped (no text): {len(results['skipped_no_text'])}")
    print(f"Registration failed: {len(results['registration_failed'])}")
    print(f"Failed: {len(results['failed'])}")
    if args.dry_run:
        print(f"Would ingest: {len(results['would_ingest'])}")
    print()
    
    if results['skipped_no_text']:
        print("Skipped (no text extracted):")
        for item in results['skipped_no_text']:
            print(f"  - {Path(item['file']).name}")
        print()
    
    if results['registration_failed']:
        print("Registration failed PDFs:")
        for item in results['registration_failed']:
            print(f"  - {Path(item['file']).name}: {item['error']}")
        print()
    
    if results['failed']:
        print("Failed PDFs:")
        for item in results['failed']:
            print(f"  - {Path(item['file']).name}: {item['error']}")
        print()
    
    # Save results to JSON
    output_file = Path(__file__).parent.parent / 'outputs' / 'bulk_ingest_results.json'
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    
    print(f"Results saved to: {output_file}")
    
    if args.dry_run:
        print()
        print("⚠️  DRY RUN MODE - No changes were actually made")
        print("Run without --dry-run to apply changes")

if __name__ == '__main__':
    main()
