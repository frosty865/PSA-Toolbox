#!/usr/bin/env python3
"""
Import OFC Library from JSON

Imports curated OFCs into ofc_library table.
Hard validation: rejects any OFC without citations.

Input files:
- public/doctrine/ofc_library_baseline.json
- public/doctrine/ofc_library_sector.json
- public/doctrine/ofc_library_subsector.json
"""

import argparse
import json
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
    
    with open(filepath, 'r', encoding='utf-8') as f:
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

def load_ofc_library_from_json(json_path: str) -> List[Dict]:
    """Load OFC library entries from JSON file."""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if isinstance(data, list):
        return data
    elif isinstance(data, dict) and 'ofcs' in data:
        return data['ofcs']
    else:
        raise ValueError('JSON must be an array or object with "ofcs" key')

def validate_ofc_entry(ofc: Dict, scope: str) -> tuple[bool, Optional[str]]:
    """Validate OFC entry before import."""
    # Required fields
    required = ['link_type', 'link_key', 'ofc_text', 'solution_role', 'citations']
    for field in required:
        if field not in ofc:
            return False, f"Missing required field: {field}"
    
    # Validate link_type
    if ofc['link_type'] not in ['PRIMARY_QUESTION', 'EXPANSION_QUESTION']:
        return False, f"Invalid link_type: {ofc['link_type']}"
    
    # Validate solution_role
    if ofc['solution_role'] not in ['PARTIAL', 'COMPLETE']:
        return False, f"Invalid solution_role: {ofc['solution_role']}"
    
    # Validate scope constraints
    if scope == 'BASELINE':
        if ofc.get('sector') or ofc.get('subsector'):
            return False, "BASELINE OFCs must not have sector or subsector"
    elif scope == 'SECTOR':
        if not ofc.get('sector'):
            return False, "SECTOR OFCs must have sector set"
        if ofc.get('subsector'):
            return False, "SECTOR OFCs must not have subsector"
    elif scope == 'SUBSECTOR':
        if not ofc.get('sector') or not ofc.get('subsector'):
            return False, "SUBSECTOR OFCs must have both sector and subsector set"
    
    # HARD RULE: Citations required
    citations = ofc.get('citations', [])
    if not citations or len(citations) == 0:
        return False, "OFC must have at least one citation"
    
    # Validate citations
    for citation in citations:
        if 'source_id' not in citation:
            return False, "Each citation must have source_id"
    
    return True, None

def import_ofc_library(conn, ofcs: List[Dict], scope: str, dry_run: bool = False) -> Dict:
    """Import OFCs into ofc_library table."""
    cur = conn.cursor()
    
    imported = 0
    skipped = 0
    errors = []
    
    print(f"\n{'DRY RUN: ' if dry_run else ''}Importing {len(ofcs)} {scope} OFCs...\n")
    
    for ofc in ofcs:
        # Validate
        is_valid, error_msg = validate_ofc_entry(ofc, scope)
        if not is_valid:
            errors.append(f"{ofc.get('link_key', 'unknown')}: {error_msg}")
            skipped += 1
            print(f"✗ Skipping {ofc.get('link_key', 'unknown')}: {error_msg}")
            continue
        
        try:
            if dry_run:
                print(f"  Would import: {ofc['link_key']} ({len(ofc['citations'])} citations)")
                imported += 1
            else:
                # Insert OFC
                cur.execute("""
                    INSERT INTO public.ofc_library (
                        scope,
                        sector,
                        subsector,
                        link_type,
                        link_key,
                        trigger_response,
                        ofc_text,
                        solution_role,
                        status
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (scope, sector, subsector, link_type, link_key, trigger_response, ofc_text)
                    DO UPDATE SET
                        solution_role = EXCLUDED.solution_role,
                        status = EXCLUDED.status,
                        updated_at = NOW()
                    RETURNING ofc_id
                """, (
                    scope,
                    ofc.get('sector'),
                    ofc.get('subsector'),
                    ofc['link_type'],
                    ofc['link_key'],
                    'NO',
                    ofc['ofc_text'],
                    ofc['solution_role'],
                    ofc.get('status', 'ACTIVE')
                ))
                
                ofc_id = cur.fetchone()[0]
                
                # Insert citations
                for citation in ofc['citations']:
                    cur.execute("""
                        INSERT INTO public.ofc_library_citations (
                            ofc_id,
                            source_id,
                            excerpt,
                            page_locator
                        ) VALUES (%s, %s, %s, %s)
                        ON CONFLICT (ofc_id, source_id) DO NOTHING
                    """, (
                        ofc_id,
                        citation['source_id'],
                        citation.get('excerpt'),
                        citation.get('page_locator')
                    ))
                
                imported += 1
                print(f"✓ Imported: {ofc['link_key']} ({len(ofc['citations'])} citations)")
                
        except Exception as e:
            error_msg = f"Error importing {ofc.get('link_key', 'unknown')}: {str(e)}"
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
        'error_details': errors[:20]  # First 20 errors
    }
    
    print(f"\n{'DRY RUN: ' if dry_run else ''}Import Summary:")
    print(f"  Imported: {imported}")
    print(f"  Skipped: {skipped}")
    print(f"  Errors: {len(errors)}")
    
    return result

def main():
    parser = argparse.ArgumentParser(
        description="Import OFC Library from JSON",
        formatter_class=argparse.RawDescriptionHelpFormatter
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
    
    # Default input files
    baseline_file = project_root / 'public' / 'doctrine' / 'ofc_library_baseline.json'
    sector_file = project_root / 'public' / 'doctrine' / 'ofc_library_sector.json'
    subsector_file = project_root / 'public' / 'doctrine' / 'ofc_library_subsector.json'
    
    files_to_import = []
    if baseline_file.exists():
        files_to_import.append(('BASELINE', baseline_file))
    if sector_file.exists():
        files_to_import.append(('SECTOR', sector_file))
    if subsector_file.exists():
        files_to_import.append(('SUBSECTOR', subsector_file))
    
    if not files_to_import:
        print("Error: No OFC library files found.")
        print("Expected files:")
        print(f"  - {baseline_file}")
        print(f"  - {sector_file}")
        print(f"  - {subsector_file}")
        sys.exit(1)
    
    # Connect to database
    print("Connecting to database...")
    conn = get_db_connection()
    print("✓ Connected")
    
    all_results = {}
    
    # Import each file
    for scope, file_path in files_to_import:
        print(f"\n{'='*80}")
        print(f"Processing {scope} OFCs from {file_path.name}")
        print('='*80)
        
        # Load OFCs
        print(f"Loading OFCs from {file_path}...")
        ofcs = load_ofc_library_from_json(str(file_path))
        print(f"✓ Loaded {len(ofcs)} OFCs")
        
        # Dry run
        print("\n" + "="*80)
        print("DRY RUN")
        print("="*80)
        dry_result = import_ofc_library(conn, ofcs, scope, dry_run=True)
        
        # Apply changes only if --apply is set
        if args.apply:
            print("\n" + "="*80)
            print("IMPORTING")
            print("="*80)
            result = import_ofc_library(conn, ofcs, scope, dry_run=False)
            all_results[scope] = result
    
    # Save report if --apply was used
    if args.apply:
        report_path = project_root / 'analytics' / 'reports' / 'ofc_library_import_report.json'
        report_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump({
                'imported_at': datetime.now().isoformat(),
                'results': all_results
            }, f, indent=2)
        
        print(f"\n✓ Report saved: {report_path}")
        print("\n✅ Import complete!")
    else:
        print("\n⚠️  DRY RUN complete. Use --apply to write changes to database.")
    
    conn.close()

if __name__ == '__main__':
    main()

