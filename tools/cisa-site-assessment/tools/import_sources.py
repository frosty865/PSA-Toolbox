#!/usr/bin/env python3
"""
Import Canonical Sources from CSV/JSON

Imports bibliographic references into canonical_sources table.
Outputs import report.
"""

import argparse
import json
import csv
import os
import sys
from pathlib import Path
from typing import List, Dict, Optional
import psycopg2
from urllib.parse import urlparse
from datetime import datetime

# Add project root to path for db_router import
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.db.db_router import guard_write, require_target_from_cli_or_env

def load_env_file(filepath: str):
    """Load environment variables from .env.local file."""
    if not os.path.exists(filepath):
        return
    
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

def get_db_connection():
    """Get database connection from DATABASE_URL."""
    load_env_file('.env.local')
    
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found in environment')
    
    if 'supabase' in database_url:
        if '?sslmode=' not in database_url:
            database_url += '?sslmode=require'
    
    return psycopg2.connect(database_url)

def load_sources_from_csv(csv_path: str) -> List[Dict]:
    """Load sources from CSV file."""
    sources = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Expected columns: title, author, publisher, published_date, source_type, uri, citation_text, content_hash
            source = {
                'title': row.get('title', '').strip(),
                'author': row.get('author', '').strip() or None,
                'publisher': row.get('publisher', '').strip() or None,
                'published_date': row.get('published_date', '').strip() or None,
                'source_type': row.get('source_type', 'OTHER').strip().upper(),
                'uri': row.get('uri', '').strip() or None,
                'citation_text': row.get('citation_text', '').strip(),
                'content_hash': row.get('content_hash', '').strip() or None
            }
            
            if not source['title'] or not source['citation_text']:
                continue
            
            if source['source_type'] not in ['PDF', 'WEB', 'GUIDE', 'STANDARD', 'MEMO', 'OTHER']:
                source['source_type'] = 'OTHER'
            
            sources.append(source)
    
    return sources

def load_sources_from_json(json_path: str) -> List[Dict]:
    """Load sources from JSON file."""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if isinstance(data, list):
        return data
    elif isinstance(data, dict) and 'sources' in data:
        return data['sources']
    else:
        raise ValueError('JSON must be an array or object with "sources" key')

def import_sources(conn, sources: List[Dict], dry_run: bool = False) -> Dict:
    """Import sources into canonical_sources table."""
    cur = conn.cursor()
    
    imported = 0
    skipped = 0
    errors = []
    
    print(f"\n{'DRY RUN: ' if dry_run else ''}Importing {len(sources)} sources...\n")
    
    for source in sources:
        try:
            # Parse published_date if provided
            published_date = None
            if source.get('published_date'):
                try:
                    published_date = datetime.strptime(source['published_date'], '%Y-%m-%d').date()
                except:
                    try:
                        published_date = datetime.strptime(source['published_date'], '%Y').date()
                    except:
                        pass
            
            if dry_run:
                print(f"  Would import: {source['title']}")
                imported += 1
            else:
                # Insert source (upsert by citation_text to avoid duplicates)
                cur.execute("""
                    INSERT INTO public.canonical_sources (
                        title,
                        author,
                        publisher,
                        published_date,
                        source_type,
                        uri,
                        citation_text,
                        content_hash
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                    RETURNING source_id
                """, (
                    source['title'],
                    source.get('author'),
                    source.get('publisher'),
                    published_date,
                    source['source_type'],
                    source.get('uri'),
                    source['citation_text'],
                    source.get('content_hash')
                ))
                
                if cur.rowcount > 0:
                    imported += 1
                    print(f"✓ Imported: {source['title']}")
                else:
                    skipped += 1
                    print(f"⊘ Skipped (duplicate): {source['title']}")
                    
        except Exception as e:
            error_msg = f"Error importing {source.get('title', 'unknown')}: {str(e)}"
            errors.append(error_msg)
            print(f"✗ {error_msg}")
            skipped += 1
    
    if not dry_run:
        conn.commit()
    
    cur.close()
    
    result = {
        'imported': imported,
        'skipped': skipped,
        'errors': len(errors),
        'error_details': errors[:10]  # First 10 errors
    }
    
    print(f"\n{'DRY RUN: ' if dry_run else ''}Import Summary:")
    print(f"  Imported: {imported}")
    print(f"  Skipped: {skipped}")
    print(f"  Errors: {len(errors)}")
    
    return result

def main():
    parser = argparse.ArgumentParser(
        description="Import Canonical Sources from CSV/JSON",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        'input_file',
        nargs='?',
        type=str,
        help='Input CSV or JSON file (default: public/doctrine/canonical_sources.json)'
    )
    parser.add_argument(
        '--target',
        type=str,
        choices=['runtime', 'corpus'],
        help='Target database (runtime or corpus). Required unless PSA_DB_TARGET is set.'
    )
    parser.add_argument(
        '--apply',
        action='store_true',
        help='Apply changes to database (default: dry-run only)'
    )
    args = parser.parse_args()
    
    # Resolve and guard target
    target = require_target_from_cli_or_env(args.target)
    guard_write(target)  # Hard-fails if mismatch detected
    
    project_root = Path(__file__).parent.parent
    
    # Check for input file
    if args.input_file:
        input_path = Path(args.input_file)
    else:
        # Default: look for sources file
        input_path = project_root / 'public' / 'doctrine' / 'canonical_sources.json'
    
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}")
        print("Usage: python import_sources.py <csv_or_json_file> [--target runtime|corpus] [--apply]")
        sys.exit(1)
    
    # Load sources
    print(f"Loading sources from {input_path}...")
    if input_path.suffix.lower() == '.csv':
        sources = load_sources_from_csv(str(input_path))
    else:
        sources = load_sources_from_json(str(input_path))
    
    print(f"✓ Loaded {len(sources)} sources")
    
    # Connect to database
    print("\nConnecting to database...")
    conn = get_db_connection()
    print("✓ Connected")
    
    # Dry run first
    print("\n" + "="*80)
    print("DRY RUN")
    print("="*80)
    dry_result = import_sources(conn, sources, dry_run=True)
    
    # Apply changes only if --apply is set
    if args.apply:
        print("\n" + "="*80)
        print("IMPORTING")
        print("="*80)
        result = import_sources(conn, sources, dry_run=False)
        
        # Save report
        report_path = project_root / 'analytics' / 'reports' / 'source_import_report.json'
        report_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump({
                'imported_at': datetime.now().isoformat(),
                'input_file': str(input_path),
                'result': result
            }, f, indent=2)
        
        print(f"\n✓ Report saved: {report_path}")
        print("\n✅ Import complete!")
    else:
        print("\n⚠️  DRY RUN complete. Use --apply to write changes to database.")
    
    conn.close()

if __name__ == '__main__':
    main()

