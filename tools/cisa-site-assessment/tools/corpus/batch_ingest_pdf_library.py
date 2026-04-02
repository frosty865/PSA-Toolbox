#!/usr/bin/env python3
"""
CORPUS: Batch Ingest PDF Library

Scans a PDF directory and ingests all PDFs into CORPUS database.
Uses corpus_ingest_pdf.py logic for each PDF found.

HARD RULE: Only writes to CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
from pathlib import Path
from typing import List, Dict
import json

# Add parent directory to path for imports
tools_dir = Path(__file__).parent.parent
sys.path.insert(0, str(tools_dir))

# Import the ingestion function
import importlib.util
spec = importlib.util.spec_from_file_location("corpus_ingest_pdf", tools_dir / "corpus_ingest_pdf.py")
corpus_ingest_pdf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(corpus_ingest_pdf)

# Use PSA_SYSTEM_ROOT environment variable or default to D:\PSA_System
PSA_SYSTEM_ROOT = Path(os.environ.get('PSA_SYSTEM_ROOT', r'D:\PSA_System'))
PDF_DIR = str(PSA_SYSTEM_ROOT / "data" / "incoming")
SOURCE_NAME = "CISA"
AUTHORITY_SCOPE = "BASELINE_AUTHORITY"

def find_pdfs(directory: str) -> List[Path]:
    """Find all PDF files in directory."""
    pdf_dir = Path(directory)
    if not pdf_dir.exists():
        print(f"❌ PDF directory not found: {directory}")
        return []
    
    pdfs = list(pdf_dir.glob("*.pdf"))
    return sorted(pdfs)

def get_pdf_metadata(pdf_path: Path) -> Dict:
    """Extract metadata from PDF filename/path."""
    # Try to extract published date from filename patterns
    # e.g., "CISA_Pathway_to_Violence_Fact_Sheet_508_20250319.pdf" -> 2025-03-19
    import re
    
    filename = pdf_path.stem
    date_match = re.search(r'(\d{8})', filename)
    published_at = None
    
    if date_match:
        date_str = date_match.group(1)
        # Format: YYYYMMDD -> YYYY-MM-DD
        if len(date_str) == 8:
            published_at = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    
    # Use filename as title (clean up common patterns)
    title = filename.replace('_', ' ').replace('  ', ' ').strip()
    
    return {
        'title': title,
        'published_at': published_at
    }

def main():
    """Main batch ingestion function."""
    import argparse
    parser = argparse.ArgumentParser(description='Batch ingest PDFs from library')
    parser.add_argument('--limit', type=int, help='Limit number of PDFs to process (for testing)')
    args = parser.parse_args()
    
    print(f"Scanning PDF directory: {PDF_DIR}")
    pdfs = find_pdfs(PDF_DIR)
    
    if not pdfs:
        print(f"❌ No PDFs found in {PDF_DIR}")
        return
    
    if args.limit:
        pdfs = pdfs[:args.limit]
        print(f"⚠️  Limited to first {args.limit} PDFs (for testing)")
    
    print(f"Found {len(pdfs)} PDF files to process")
    print()
    
    results = {
        'total': len(pdfs),
        'successful': [],
        'failed': [],
        'skipped': []
    }
    
    # Check which PDFs are already ingested
    conn = corpus_ingest_pdf.get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Get list of already-ingested PDFs by filename
        cur.execute("""
            SELECT DISTINCT d.title, d.file_path
            FROM public.documents d
            WHERE d.file_path LIKE %s
        """, (f"{PDF_DIR}%",))
        
        ingested_files = {row[1] for row in cur.fetchall()}
        print(f"Found {len(ingested_files)} already-ingested PDFs")
        print()
    except Exception as e:
        print(f"⚠️  Could not check existing documents: {e}")
        ingested_files = set()
    finally:
        cur.close()
        conn.close()
    
    # Process each PDF
    for i, pdf_path in enumerate(pdfs, 1):
        print(f"[{i}/{len(pdfs)}] Processing: {pdf_path.name}")
        
        # Skip if already ingested
        if str(pdf_path) in ingested_files:
            print(f"  ⏭️  Already ingested, skipping")
            results['skipped'].append({
                'file': str(pdf_path),
                'reason': 'already_ingested'
            })
            continue
        
        # Get metadata
        metadata = get_pdf_metadata(pdf_path)
        
        try:
            result = corpus_ingest_pdf.ingest_pdf(
                pdf_path=str(pdf_path),
                source_name=SOURCE_NAME,
                title=metadata['title'],
                published_at=metadata['published_at'],
                authority_scope=AUTHORITY_SCOPE,
                chunk_chars=1800,
                overlap_chars=200
            )
            
            print(f"  ✅ Ingested: {result['document_id']}")
            print(f"     Chunks: {result['chunks_count']}, Pages: {result['pages_extracted']}/{result['pages_total']}")
            
            results['successful'].append({
                'file': str(pdf_path),
                'document_id': result['document_id'],
                'chunks': result['chunks_count'],
                'pages': result['pages_extracted']
            })
            
        except Exception as e:
            print(f"  ❌ Failed: {e}")
            results['failed'].append({
                'file': str(pdf_path),
                'error': str(e)
            })
        
        print()
    
    # Print summary
    print("=" * 60)
    print("BATCH INGESTION SUMMARY")
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
    
    # Save results to JSON
    output_file = Path(__file__).parent.parent / 'outputs' / 'pdf_library_batch_ingest_results.json'
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    
    print(f"Results saved to: {output_file}")

if __name__ == '__main__':
    main()
