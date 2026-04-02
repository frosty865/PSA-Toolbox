#!/usr/bin/env python3
"""
Fix publisher assignments for PDFs that were registered with "Unknown" publisher.

This script:
1. Finds source_registry entries with "Unknown" publisher
2. Re-extracts metadata from PDFs to infer correct publisher
3. Updates source_registry with correct publisher
4. Re-normalizes filenames with correct publisher
"""

import os
import sys
import re
from pathlib import Path
from typing import Dict, Optional

# Add project root to path for imports
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

import psycopg2
from urllib.parse import urlparse
from model.ingest.pdf_citation_extractor import extract_citation_metadata

# Import functions from normalize_pdf_filenames.py
sys.path.insert(0, str(Path(__file__).parent))
from normalize_pdf_filenames import (
    get_corpus_db_connection, compute_file_hash,
    infer_publisher_enhanced, normalize_source_key_for_registry,
    generate_normalized_filename, extract_title_from_pdf
)


def infer_publisher_from_filename(filename: str) -> Optional[str]:
    """Infer publisher from filename patterns."""
    filename_upper = filename.upper()
    
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

def fix_pdf_publisher(file_path: Path, conn, dry_run: bool = False) -> tuple[bool, str]:
    """
    Fix publisher for a single PDF file.
    Returns (success, message).
    """
    try:
        # Compute hash
        file_hash = compute_file_hash(file_path)
        
        # Find source_registry entry
        cur = conn.cursor()
        cur.execute("""
            SELECT id, publisher, source_key, title, local_path, doc_sha256
            FROM public.source_registry
            WHERE doc_sha256 = %s OR local_path = %s
        """, (file_hash, str(file_path)))
        
        row = cur.fetchone()
        if not row:
            return False, f"No source_registry entry found"
        
        match = {
            'id': row[0],
            'publisher': row[1],
            'source_key': row[2],
            'title': row[3],
            'local_path': row[4],
            'doc_sha256': row[5]
        }
        
        # Skip if publisher is already correct
        if match['publisher'].upper() != 'UNKNOWN':
            return True, f"Publisher already correct: {match['publisher']}"
        
        # Re-extract metadata and first page text for better publisher detection
        extracted_title, title_confidence = extract_title_from_pdf(file_path)
        citation_meta = {}
        first_page_text = None
        try:
            citation_meta = extract_citation_metadata(str(file_path), original_filename=file_path.name)
            # Get first page text directly for more thorough checking
            from model.ingest.pdf_citation_extractor import extract_first_page_text
            first_page_text = extract_first_page_text(str(file_path))
        except Exception as e:
            print(f"    [WARN] Failed to extract citation metadata: {e}")
        
        # Use database title (most reliable since it was extracted from PDF)
        db_title = match.get('title', '') or extracted_title or ''
        
        # Infer correct publisher from title and first page text
        title_upper = db_title.upper()
        new_publisher = 'Unknown'
        
        # Combine title and first page text for checking (check more text)
        text_to_check = [title_upper]
        if first_page_text:
            # Check first 2000 chars of first page (more than citation extractor's 500)
            text_to_check.append(first_page_text[:2000].upper())
        combined_text = ' '.join(text_to_check)
        
        # Check for specific patterns (order matters - check more specific first)
        # Many titles start with or contain the publisher name
        if 'CISA' in combined_text[:100] or title_upper.startswith('CISA ') or 'CYBERSECURITY AND INFRASTRUCTURE SECURITY AGENCY' in combined_text:
            new_publisher = 'CISA'
        elif 'DHS' in combined_text[:100] or title_upper.startswith('DHS ') or 'DEPARTMENT OF HOMELAND SECURITY' in combined_text:
            new_publisher = 'DHS'
        elif 'USSS' in combined_text or 'U.S. SECRET SERVICE' in combined_text or 'UNITED STATES SECRET SERVICE' in combined_text or 'SECRET SERVICE' in combined_text:
            new_publisher = 'USSS'
        elif 'FEMA' in combined_text[:100] or title_upper.startswith('FEMA ') or 'FEDERAL EMERGENCY MANAGEMENT AGENCY' in combined_text:
            new_publisher = 'FEMA'
        elif 'ISC' in combined_text[:100] or title_upper.startswith('ISC ') or 'INTERAGENCY SECURITY COMMITTEE' in combined_text:
            new_publisher = 'ISC'
        elif 'DODD' in combined_text or 'DODM' in combined_text:
            new_publisher = 'DoD'
        elif 'UFC' in combined_text and ('4-010' in combined_text or '4-020' in combined_text or 'SECURITY ENGINEERING' in combined_text):
            new_publisher = 'DoD'
        elif 'DOD' in combined_text[:100] or 'DEPARTMENT OF DEFENSE' in combined_text:
            new_publisher = 'DoD'
        elif 'COPS' in combined_text or 'COMMUNITY ORIENTED POLICING SERVICES' in combined_text:
            new_publisher = 'COPS'
        
        # If still unknown, try enhanced inference from filename (current filename might have hints)
        if new_publisher == 'Unknown':
            new_publisher = infer_publisher_enhanced(file_path, citation_meta, extracted_title)
        
        # For files that still can't be inferred, check first page content more aggressively
        if new_publisher == 'Unknown' and first_page_text:
            first_page_upper = first_page_text[:3000].upper()  # Check more text
            
            # Check for publisher mentions in first page (order matters)
            if 'CYBERSECURITY AND INFRASTRUCTURE SECURITY AGENCY' in first_page_upper or ('CISA' in first_page_upper[:500] and 'CYBERSECURITY' in first_page_upper[:1000]):
                new_publisher = 'CISA'
            elif 'DEPARTMENT OF HOMELAND SECURITY' in first_page_upper or ('DHS' in first_page_upper[:500] and ('HOMELAND' in first_page_upper[:1000] or 'SECURITY' in first_page_upper[:1000])):
                new_publisher = 'DHS'
            elif 'UNITED STATES SECRET SERVICE' in first_page_upper or 'U.S. SECRET SERVICE' in first_page_upper or ('USSS' in first_page_upper[:500] and 'SECRET SERVICE' in first_page_upper):
                new_publisher = 'USSS'
            elif 'FEDERAL EMERGENCY MANAGEMENT AGENCY' in first_page_upper or ('FEMA' in first_page_upper[:500] and 'EMERGENCY' in first_page_upper[:1000]):
                new_publisher = 'FEMA'
            elif 'INTERAGENCY SECURITY COMMITTEE' in first_page_upper or ('ISC' in first_page_upper[:500] and 'SECURITY' in first_page_upper[:1000]):
                new_publisher = 'ISC'
            elif 'DEPARTMENT OF DEFENSE' in first_page_upper or ('DOD' in first_page_upper[:500] and 'DEFENSE' in first_page_upper[:1000]):
                new_publisher = 'DoD'
            elif 'COMMUNITY ORIENTED POLICING SERVICES' in first_page_upper or ('COPS' in first_page_upper[:500] and 'POLICING' in first_page_upper[:1000]):
                new_publisher = 'COPS'
        
        # Last resort: check title patterns for common document types and check first page more thoroughly
        if new_publisher == 'Unknown':
            title_lower = db_title.lower()
            
            # School security documents are often DHS/CISA - check first page thoroughly
            if any(term in title_lower for term in ['school security', 'k-12', 'k12', 'school safety', 'bystander', 'pathway to violence', 'improving school', 'ten essential actions']):
                if first_page_text:
                    first_page_upper = first_page_text[:3000].upper()
                    # Check for CISA first (more specific)
                    if 'CISA' in first_page_upper[:500] or 'CYBERSECURITY AND INFRASTRUCTURE' in first_page_upper:
                        new_publisher = 'CISA'
                    elif 'DHS' in first_page_upper[:500] or 'DEPARTMENT OF HOMELAND SECURITY' in first_page_upper:
                        new_publisher = 'DHS'
                    elif 'SECRET SERVICE' in first_page_upper[:1000] or 'USSS' in first_page_upper[:500]:
                        new_publisher = 'USSS'
                # Default to DHS for school security if no clear match
                elif 'pathway to violence' in title_lower or 'bystander' in title_lower:
                    new_publisher = 'DHS'  # Most pathway/bystander docs are DHS/CISA, default to DHS
            
            # Infrastructure/cybersecurity documents are often CISA/DHS
            elif any(term in title_lower for term in ['cybersecurity', 'infrastructure', 'substation', 'pipeline', 'resilience', 'sector spotlight']):
                if first_page_text:
                    first_page_upper = first_page_text[:3000].upper()
                    if 'CISA' in first_page_upper[:500] or 'CYBERSECURITY AND INFRASTRUCTURE' in first_page_upper:
                        new_publisher = 'CISA'
                    elif 'DHS' in first_page_upper[:500] or 'DEPARTMENT OF HOMELAND SECURITY' in first_page_upper:
                        new_publisher = 'DHS'
                # Default to DHS for infrastructure security
                elif 'sector spotlight' in title_lower or 'substation' in title_lower:
                    new_publisher = 'DHS'  # Sector spotlights are typically DHS
                elif 'cybersecurity' in title_lower and 'convergence' in title_lower:
                    new_publisher = 'CISA'  # Cybersecurity convergence is typically CISA
            
            # Physical security guides are often DHS/CISA/ISC
            elif any(term in title_lower for term in ['physical security', 'security guide', 'security checklist', 'security assessment', 'protecting patrons', 'protecting places']):
                if first_page_text:
                    first_page_upper = first_page_text[:3000].upper()
                    if 'CISA' in first_page_upper[:500]:
                        new_publisher = 'CISA'
                    elif 'ISC' in first_page_upper[:500]:
                        new_publisher = 'ISC'
                    elif 'DHS' in first_page_upper[:500] or 'DEPARTMENT OF HOMELAND SECURITY' in first_page_upper:
                        new_publisher = 'DHS'
                # Default based on document type
                elif 'protecting patrons' in title_lower or 'protecting places' in title_lower:
                    new_publisher = 'CISA'  # These are typically CISA guides
            
            # Active shooter/threat documents
            elif any(term in title_lower for term in ['active shooter', 'recovery guide', 'behavioral threat', 'threat assessment']):
                if first_page_text:
                    first_page_upper = first_page_text[:3000].upper()
                    if 'DHS' in first_page_upper[:500] or 'DEPARTMENT OF HOMELAND SECURITY' in first_page_upper:
                        new_publisher = 'DHS'
                    elif 'FEMA' in first_page_upper[:500]:
                        new_publisher = 'FEMA'
                    elif 'SECRET SERVICE' in first_page_upper[:1000] or 'USSS' in first_page_upper[:500]:
                        new_publisher = 'USSS'
                # Default to DHS for active shooter/threat docs
                elif 'active shooter' in title_lower or 'recovery' in title_lower:
                    new_publisher = 'DHS'
            
            # FAA/Flight documents
            elif 'n jo' in title_lower or '7210' in title_lower or 'tfr' in title_lower or 'flight restriction' in title_lower:
                new_publisher = 'FAA'  # FAA documents
            
            # Pipeline security
            elif 'pipeline security' in title_lower:
                new_publisher = 'DHS'  # Pipeline security is typically DHS/TSA
        
        if new_publisher == 'Unknown':
            return False, f"Could not infer publisher from filename, title, or first page content"
        
        # Generate new source_key with correct publisher
        title = match.get('title', '') or extracted_title or file_path.stem.replace('_', ' ').replace('-', ' ')
        new_source_key = normalize_source_key_for_registry(title, new_publisher)
        
        # Generate new normalized filename
        new_filename = generate_normalized_filename(new_publisher, new_source_key)
        new_path = file_path.parent / new_filename
        
        # Determine tier
        tier = 3
        publisher_upper = new_publisher.upper()
        if 'CISA' in publisher_upper or 'DHS' in publisher_upper or 'USSS' in publisher_upper or 'NATIONAL LAB' in publisher_upper:
            tier = 1
        elif 'FEMA' in publisher_upper or 'ISC' in publisher_upper or 'NIST' in publisher_upper or 'DOD' in publisher_upper or 'FAA' in publisher_upper:
            tier = 2
        
        if dry_run:
            rename_msg = f"Would rename: {file_path.name} -> {new_filename}" if file_path.name != new_filename else "Already correctly named"
            return True, f"Would update publisher: Unknown -> {new_publisher} | {rename_msg}"
        
        # Update source_registry
        updates = []
        params = []
        
        updates.append("publisher = %s")
        params.append(new_publisher)
        
        updates.append("source_key = %s")
        params.append(new_source_key)
        
        updates.append("tier = %s")
        params.append(tier)
        
        if file_path.name != new_filename:
            updates.append("local_path = %s")
            params.append(str(new_path))
        
        params.append(match['id'])
        
        cur.execute(f"""
            UPDATE public.source_registry
            SET {', '.join(updates)}, updated_at = now()
            WHERE id = %s
        """, params)
        conn.commit()
        
        # Rename file if needed
        if file_path.name != new_filename:
            if new_path.exists() and new_path != file_path:
                cur.close()
                return False, f"Target filename already exists: {new_filename}"
            file_path.rename(new_path)
        
        cur.close()
        
        rename_msg = f"Renamed: {file_path.name} -> {new_filename}" if file_path.name != new_filename else "Filename unchanged"
        return True, f"Updated publisher: Unknown -> {new_publisher} | {rename_msg}"
        
    except Exception as e:
        return False, f"Error: {str(e)}"

def main():
    """Main fix function."""
    import argparse
    parser = argparse.ArgumentParser(description='Fix publisher assignments for PDFs with Unknown publisher')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be fixed without actually fixing')
    parser.add_argument('--limit', type=int, help='Limit number of files to process (for testing)')
    args = parser.parse_args()
    
    # Use PSA_SYSTEM_ROOT environment variable or default to D:\PSA_System
    PSA_SYSTEM_ROOT = Path(os.environ.get('PSA_SYSTEM_ROOT', r'D:\PSA_System'))
    PDF_DIR = str(PSA_SYSTEM_ROOT / "data" / "incoming")
    pdf_dir = Path(PDF_DIR)
    
    if not pdf_dir.exists():
        print(f"❌ PDF directory not found: {PDF_DIR}")
        return
    
    # Find all PDFs, but prioritize those with UNKNOWN_UNKNOWN_ prefix
    all_pdfs = sorted(pdf_dir.glob("*.pdf"))
    unknown_pdfs = [p for p in all_pdfs if p.name.startswith("UNKNOWN_UNKNOWN_")]
    other_pdfs = [p for p in all_pdfs if not p.name.startswith("UNKNOWN_UNKNOWN_")]
    
    # Process unknown PDFs first, then others
    pdfs = unknown_pdfs + other_pdfs
    
    if not pdfs:
        print(f"❌ No PDFs found in {PDF_DIR}")
        return
    
    print(f"Found {len(unknown_pdfs)} PDFs with UNKNOWN_UNKNOWN_ prefix (will fix first)")
    print(f"Found {len(other_pdfs)} other PDFs (will check)")
    
    if args.limit:
        pdfs = pdfs[:args.limit]
        print(f"⚠️  Limited to first {args.limit} PDFs (for testing)")
    
    print(f"Found {len(pdfs)} PDF files to check")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print()
    
    # Connect to database
    try:
        conn = get_corpus_db_connection()
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return
    
    results = {
        'total': len(pdfs),
        'fixed': [],
        'failed': [],
        'skipped': []
    }
    
    # Process each PDF
    for i, pdf_path in enumerate(pdfs, 1):
        print(f"[{i}/{len(pdfs)}] {pdf_path.name}")
        
        success, message = fix_pdf_publisher(pdf_path, conn, dry_run=args.dry_run)
        
        if success:
            if 'already correct' in message.lower():
                results['skipped'].append({
                    'file': str(pdf_path),
                    'reason': 'already_correct'
                })
            else:
                results['fixed'].append({
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
    print("PUBLISHER FIX SUMMARY")
    print("=" * 60)
    print(f"Total PDFs: {results['total']}")
    print(f"Fixed: {len(results['fixed'])}")
    print(f"Failed: {len(results['failed'])}")
    print(f"Skipped: {len(results['skipped'])}")
    print()
    
    if results['failed']:
        print("Failed PDFs:")
        for item in results['failed']:
            print(f"  - {Path(item['file']).name}: {item['error']}")
        print()
    
    if args.dry_run:
        print("⚠️  DRY RUN MODE - No changes were actually made")
        print("Run without --dry-run to apply changes")

if __name__ == '__main__':
    main()
