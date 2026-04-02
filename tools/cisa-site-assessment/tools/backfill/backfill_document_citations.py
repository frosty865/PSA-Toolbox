#!/usr/bin/env python3
"""
Backfill Document Citation Metadata

Backfills citation metadata for existing documents in the database.
Idempotent: only updates if new confidence > existing confidence.

Behavior:
- Query documents where inferred_title is null OR title_confidence < 60 OR documents.title is numeric-only
- For each: read file_path, run pdf_citation_extractor, update row
- Generate QA reports
"""

import os
import sys
import json
import csv
import re
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import psycopg2
from urllib.parse import urlparse

from model.ingest.pdf_citation_extractor import extract_citation_metadata


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
    
    clean_password = corpus_password.strip().strip('"').strip("'").replace('\\', '')
    
    url = urlparse(corpus_url)
    project_ref = url.hostname.split('.')[0]
    
    connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
    
    try:
        return psycopg2.connect(connection_string)
    except psycopg2.OperationalError as e:
        if '6543' in connection_string:
            print(f"[WARN] Connection to port 6543 failed, trying direct port 5432...")
            connection_string_direct = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string_direct)
        raise


def is_numeric_title(title: Optional[str]) -> bool:
    """Check if title is numeric-only."""
    if not title:
        return True
    return bool(re.match(r'^\d+$', title.strip()))


def find_documents_to_backfill(cur) -> List[Dict]:
    """
    Find documents that need citation metadata backfill from corpus_documents:
    - inferred_title is null OR
    - title_confidence < 60 OR
    - file_stem is numeric-only OR
    - inferred_title is numeric-only (regression check)
    """
    query = """
        SELECT 
            id,
            file_hash,
            canonical_path,
            original_filename,
            file_stem,
            inferred_title,
            title_confidence,
            ingestion_warnings
        FROM public.corpus_documents
        WHERE 
            (canonical_path IS NOT NULL OR original_filename IS NOT NULL)
            AND (
                inferred_title IS NULL
                OR title_confidence < 60
                OR file_stem ~ '^\\d+$'  -- numeric-only file_stem
                OR inferred_title ~ '^\\d+$'  -- numeric-only inferred_title (regression)
            )
        ORDER BY id
    """
    
    cur.execute(query)
    rows = cur.fetchall()
    
    documents = []
    for row in rows:
        doc_id, file_hash, canonical_path, original_filename, file_stem, inferred_title, title_confidence, warnings_json = row
        # Use canonical_path if available, else try to construct from original_filename
        file_path = canonical_path or (original_filename if original_filename else None)
        
        # Parse ingestion_warnings (JSONB might be returned as list or string)
        if warnings_json:
            if isinstance(warnings_json, (list, dict)):
                warnings = warnings_json if isinstance(warnings_json, list) else [warnings_json]
            else:
                warnings = json.loads(warnings_json) if warnings_json else []
        else:
            warnings = []
        
        documents.append({
            'document_id': str(doc_id),
            'file_hash': file_hash,
            'file_path': file_path,
            'file_stem': file_stem,
            'inferred_title': inferred_title,
            'title_confidence': title_confidence or 0,
            'ingestion_warnings': warnings
        })
    
    return documents


def backfill_document(cur, document: Dict) -> Dict:
    """
    Backfill citation metadata for a single document in corpus_documents.
    Returns update result dict.
    """
    doc_id = document['document_id']
    file_hash = document['file_hash']
    file_path = document['file_path']
    
    if not file_path or not Path(file_path).exists():
        return {
            'document_id': doc_id,
            'status': 'skipped',
            'reason': 'file_not_found',
            'file_path': file_path
        }
    
    try:
        # Extract citation metadata
        citation_meta = extract_citation_metadata(file_path, original_filename=document.get('original_filename') or Path(file_path).name)
        
        new_inferred_title = citation_meta.get('inferred_title')
        new_confidence = citation_meta.get('title_confidence', 0)
        existing_confidence = document.get('title_confidence', 0)
        existing_inferred_title = document.get('inferred_title')
        
        # HARDEN: Never write numeric-only inferred_title
        if new_inferred_title and is_numeric_title(new_inferred_title):
            # Reject numeric title from extractor
            new_inferred_title = None
            new_confidence = min(new_confidence, 10)
            citation_meta['ingestion_warnings'] = citation_meta.get('ingestion_warnings', []) + ['rejected_numeric_title_from_extractor']
        
        # HARDEN: If existing inferred_title is numeric-only and extractor returns null, apply correction
        if existing_inferred_title and is_numeric_title(existing_inferred_title):
            if not new_inferred_title:
                # Try to fix using file_stem if available
                file_stem = document.get('file_stem') or Path(file_path).stem if file_path else None
                if file_stem and not is_numeric_title(file_stem):
                    # Use cleaned file_stem
                    import re
                    cleaned_stem = re.sub(r'[_-]', ' ', file_stem).strip()
                    cleaned_stem = ' '.join(word.capitalize() for word in cleaned_stem.split())
                    new_inferred_title = cleaned_stem
                    new_confidence = max(existing_confidence, 50)
                    citation_meta['ingestion_warnings'] = citation_meta.get('ingestion_warnings', []) + ['inferred_title_replaced_from_file_stem']
                else:
                    # Null it out
                    new_inferred_title = None
                    new_confidence = min(existing_confidence, 10)
                    citation_meta['ingestion_warnings'] = citation_meta.get('ingestion_warnings', []) + ['numeric_inferred_title_rejected']
        
        # Only update if new confidence is better (or if fixing numeric title)
        is_fixing_numeric = existing_inferred_title and is_numeric_title(existing_inferred_title)
        if not is_fixing_numeric and new_confidence <= existing_confidence:
            return {
                'document_id': doc_id,
                'status': 'skipped',
                'reason': 'confidence_not_improved',
                'existing_confidence': existing_confidence,
                'new_confidence': new_confidence
            }
        
        # Merge warnings (append-only set semantics)
        existing_warnings = document.get('ingestion_warnings', [])
        merged_warnings = list(set(existing_warnings + citation_meta.get('ingestion_warnings', [])))
        
        # Update corpus_documents row (authoritative)
        cur.execute("""
            UPDATE public.corpus_documents
            SET 
                original_filename = COALESCE(%s, original_filename),
                file_stem = COALESCE(%s, file_stem),
                inferred_title = %s,
                title_confidence = %s,
                pdf_meta_title = COALESCE(%s, pdf_meta_title),
                pdf_meta_author = COALESCE(%s, pdf_meta_author),
                pdf_meta_subject = COALESCE(%s, pdf_meta_subject),
                pdf_meta_creator = COALESCE(%s, pdf_meta_creator),
                pdf_meta_producer = COALESCE(%s, pdf_meta_producer),
                pdf_meta_creation_date = COALESCE(%s, pdf_meta_creation_date),
                pdf_meta_mod_date = COALESCE(%s, pdf_meta_mod_date),
                publisher = COALESCE(%s, publisher),
                publication_date = COALESCE(%s, publication_date),
                source_url = COALESCE(%s, source_url),
                citation_short = COALESCE(%s, citation_short),
                citation_full = COALESCE(%s, citation_full),
                ingestion_warnings = %s
            WHERE file_hash = %s
        """, (
            Path(file_path).name if file_path else None,
            Path(file_path).stem if file_path else None,
            new_inferred_title,  # Use corrected title
            new_confidence,  # Use corrected confidence
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
            json.dumps(merged_warnings),
            file_hash
        ))
        
        return {
            'document_id': doc_id,
            'status': 'updated',
            'old_inferred_title': document.get('inferred_title'),
            'new_inferred_title': citation_meta.get('inferred_title'),
            'old_confidence': existing_confidence,
            'new_confidence': new_confidence,
            'publisher': citation_meta.get('publisher'),
            'publication_date': citation_meta.get('publication_date'),
            'warnings': merged_warnings
        }
        
    except Exception as e:
        return {
            'document_id': doc_id,
            'status': 'error',
            'error': str(e),
            'file_path': file_path
        }


def generate_reports(results: List[Dict], total_documents: int, updated_count: int):
    """Generate QA reports."""
    reports_dir = Path('analytics/reports')
    reports_dir.mkdir(parents=True, exist_ok=True)
    
    # JSON report
    report_json = {
        'backfill_date': datetime.now().isoformat(),
        'totals': {
            'total_documents_checked': total_documents,
            'updated_count': updated_count,
            'skipped_count': sum(1 for r in results if r.get('status') == 'skipped'),
            'error_count': sum(1 for r in results if r.get('status') == 'error')
        },
        'remaining_low_confidence_count': sum(
            1 for r in results 
            if r.get('status') == 'updated' and r.get('new_confidence', 0) < 60
        ),
        'sample_entries': [
            r for r in results[:20]  # First 20 entries
        ]
    }
    
    json_path = reports_dir / 'document_citation_backfill_report.json'
    with open(json_path, 'w') as f:
        json.dump(report_json, f, indent=2)
    
    print(f"✅ JSON report written to: {json_path}")
    
    # CSV report
    csv_path = reports_dir / 'document_title_quality.csv'
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'document_id',
            'current_title',
            'inferred_title',
            'confidence',
            'publisher',
            'publication_date',
            'warnings',
            'status'
        ])
        
        for result in results:
            writer.writerow([
                result.get('document_id', ''),
                result.get('old_inferred_title', ''),
                result.get('new_inferred_title', ''),
                result.get('new_confidence', result.get('old_confidence', 0)),
                result.get('publisher', ''),
                result.get('publication_date', ''),
                '; '.join(result.get('warnings', [])),
                result.get('status', '')
            ])
    
    print(f"✅ CSV report written to: {csv_path}")


def verify_table_exists(cur) -> bool:
    """Verify that public.corpus_documents table exists."""
    cur.execute("SELECT to_regclass('public.corpus_documents')")
    result = cur.fetchone()
    table_exists = result[0] is not None
    
    if not table_exists:
        print("❌ ERROR: public.corpus_documents does not exist in Supabase Postgres.")
        print("   Run migrations first: python tools/run_corpus_documents_migration.py")
        return False
    
    # Check if table is empty
    cur.execute("SELECT COUNT(*) FROM public.corpus_documents")
    count = cur.fetchone()[0]
    
    if count == 0:
        print("ℹ️  INFO: public.corpus_documents exists but is empty.")
        print("   This is normal if no documents have been ingested yet.")
        print("   Options:")
        print("   1. Ingest corpus PDFs using: python tools/corpus_ingest_pdf.py")
        print("   2. Copy from legacy documents table: db/sql/copy_documents_to_corpus_documents.sql")
    
    return True


def main():
    """Main backfill function."""
    import argparse
    parser = argparse.ArgumentParser(description='Backfill document citation metadata')
    parser.add_argument('--limit', type=int, help='Limit number of documents to process (for testing)')
    parser.add_argument('--dry-run', action='store_true', help='Dry run (no database updates)')
    args = parser.parse_args()
    
    print("🔍 Connecting to CORPUS database...")
    
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Verify table exists before proceeding
        print("🔍 Verifying public.corpus_documents table exists...")
        if not verify_table_exists(cur):
            sys.exit(1)
        
        print("🔍 Finding documents to backfill...")
        documents = find_documents_to_backfill(cur)
        total_documents = len(documents)
        
        if args.limit:
            documents = documents[:args.limit]
            print(f"⚠️  Limited to first {args.limit} documents (for testing)")
        
        print(f"Found {len(documents)} documents to process (out of {total_documents} total)")
        print()
        
        if args.dry_run:
            print("🔍 DRY RUN MODE - No database updates will be made")
            print()
        
        results = []
        updated_count = 0
        
        for i, doc in enumerate(documents, 1):
            print(f"[{i}/{len(documents)}] Processing {doc['document_id']}...")
            
            if args.dry_run:
                # Simulate extraction without updating
                file_path = doc['file_path']
                if file_path and Path(file_path).exists():
                    try:
                        citation_meta = extract_citation_metadata(file_path, original_filename=Path(file_path).name)
                        result = {
                            'document_id': doc['document_id'],
                            'status': 'would_update',
                            'old_title': doc['title'],
                            'new_inferred_title': citation_meta.get('inferred_title'),
                            'old_confidence': doc.get('title_confidence', 0),
                            'new_confidence': citation_meta.get('title_confidence', 0),
                            'publisher': citation_meta.get('publisher'),
                            'publication_date': citation_meta.get('publication_date'),
                            'warnings': citation_meta.get('ingestion_warnings', [])
                        }
                        if result['new_confidence'] > result['old_confidence']:
                            updated_count += 1
                    except Exception as e:
                        result = {
                            'document_id': doc['document_id'],
                            'status': 'error',
                            'error': str(e)
                        }
                else:
                    result = {
                        'document_id': doc['document_id'],
                        'status': 'skipped',
                        'reason': 'file_not_found'
                    }
            else:
                result = backfill_document(cur, doc)
                if result.get('status') == 'updated':
                    updated_count += 1
                    conn.commit()
            
            results.append(result)
            
            if result.get('status') == 'updated':
                print(f"  ✅ Updated: {result.get('old_title')} -> {result.get('new_inferred_title')} (confidence: {result.get('old_confidence')} -> {result.get('new_confidence')})")
            elif result.get('status') == 'skipped':
                print(f"  ⏭️  Skipped: {result.get('reason')}")
            elif result.get('status') == 'error':
                print(f"  ❌ Error: {result.get('error')}")
        
        print()
        print(f"📊 Summary:")
        print(f"  Total processed: {len(results)}")
        print(f"  Updated: {updated_count}")
        print(f"  Skipped: {sum(1 for r in results if r.get('status') == 'skipped')}")
        print(f"  Errors: {sum(1 for r in results if r.get('status') == 'error')}")
        
        # Generate reports
        generate_reports(results, total_documents, updated_count)
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    main()
