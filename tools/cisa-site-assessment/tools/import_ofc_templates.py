#!/usr/bin/env python3
"""
Import OFC Templates from JSON into Database

This script imports OFC templates from public/doctrine/ofc_templates_baseline_v1.json
into the canonical_ofcs table. It maps required_element_code to discipline/subtype
using the baseline questions registry.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional
import psycopg2
from urllib.parse import urlparse

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
    
    # Use connection string directly (psycopg2 handles it)
    # For Supabase, we need to handle SSL properly
    if 'supabase' in database_url:
        # Supabase requires SSL
        if '?sslmode=' not in database_url:
            database_url += '?sslmode=require'
    
    conn = psycopg2.connect(database_url)
    
    return conn

def load_baseline_questions(registry_path: str) -> Dict[str, Dict]:
    """Load baseline questions and create lookup by element_code."""
    with open(registry_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    lookup = {}
    for element in data.get('required_elements', []):
        element_code = element.get('element_code')
        if element_code:
            lookup[element_code] = {
                'discipline_id': element.get('discipline_id'),
                'discipline_subtype_id': element.get('discipline_subtype_id'),
                'title': element.get('title', ''),
                'discipline_name': element.get('discipline_name', ''),
                'discipline_subtype_name': element.get('discipline_subtype_name', '')
            }
    
    return lookup

def load_ofc_templates(templates_path: str) -> List[Dict]:
    """Load OFC templates from JSON file."""
    with open(templates_path, 'r', encoding='utf-8') as f:
        templates = json.load(f)
    return templates

def generate_canonical_code(element_code: str, discipline_name: str, subtype_name: str) -> str:
    """Generate canonical_code for OFC."""
    # Format: OFC_V1_<DISCIPLINE>_<SUBTYPE>_<ELEMENT>
    discipline_clean = discipline_name.upper().replace(' ', '_').replace('-', '_')[:20]
    subtype_clean = subtype_name.upper().replace(' ', '_').replace('-', '_')[:20]
    element_clean = element_code.replace('-', '_')
    return f"OFC_V1_{discipline_clean}_{subtype_clean}_{element_clean}"

def import_ofc_templates(conn, templates: List[Dict], baseline_lookup: Dict[str, Dict], dry_run: bool = False):
    """Import OFC templates into canonical_ofcs table."""
    cur = conn.cursor()
    
    imported = 0
    skipped = 0
    errors = []
    
    print(f"\n{'DRY RUN: ' if dry_run else ''}Importing {len(templates)} OFC templates...\n")
    
    for template in templates:
        element_code = template.get('required_element_code')
        ofc_text = template.get('ofc_text', '')
        
        if not element_code:
            errors.append(f"Template missing required_element_code: {template}")
            skipped += 1
            continue
        
        # Look up discipline/subtype from baseline questions
        baseline_info = baseline_lookup.get(element_code)
        if not baseline_info:
            print(f"⚠️  Skipping {element_code}: not found in baseline questions")
            skipped += 1
            continue
        
        discipline_id = baseline_info.get('discipline_id')
        discipline_subtype_id = baseline_info.get('discipline_subtype_id')
        discipline_name = baseline_info.get('discipline_name', 'Unknown')
        subtype_name = baseline_info.get('discipline_subtype_name', 'Unknown')
        title = baseline_info.get('title', element_code)
        
        if not discipline_id or not discipline_subtype_id:
            print(f"⚠️  Skipping {element_code}: missing discipline_id or discipline_subtype_id")
            skipped += 1
            continue
        
        # Generate canonical code
        canonical_code = generate_canonical_code(element_code, discipline_name, subtype_name)
        
        if dry_run:
            print(f"  Would import: {element_code} -> {canonical_code}")
            print(f"    Discipline: {discipline_name} / {subtype_name}")
            print(f"    OFC Text: {ofc_text[:80]}...")
            imported += 1
        else:
            try:
                # Insert into canonical_ofcs
                cur.execute("""
                    INSERT INTO public.canonical_ofcs (
                        canonical_code,
                        title,
                        ofc_text,
                        discipline_id,
                        discipline_subtype_id,
                        status,
                        version_major,
                        version_minor,
                        created_by,
                        approved_by,
                        approved_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (canonical_code) DO UPDATE SET
                        ofc_text = EXCLUDED.ofc_text,
                        title = EXCLUDED.title
                    RETURNING canonical_ofc_id
                """, (
                    canonical_code,
                    title,
                    ofc_text,
                    discipline_id,
                    discipline_subtype_id,
                    'ACTIVE',
                    1,
                    0,
                    'TEMPLATE_IMPORT',
                    'TEMPLATE_IMPORT'
                ))
                
                canonical_ofc_id = cur.fetchone()[0]
                
                # Create a minimal citation (required for canonical OFCs)
                cur.execute("""
                    INSERT INTO public.canonical_ofc_citations (
                        canonical_ofc_id,
                        excerpt,
                        source_label,
                        created_by
                    ) VALUES (%s, %s, %s, %s)
                """, (
                    canonical_ofc_id,
                    f"OFC template for {element_code}",
                    "Baseline v1 Template",
                    'TEMPLATE_IMPORT'
                ))
                
                imported += 1
                print(f"✓ Imported: {element_code} -> {canonical_code}")
                
            except Exception as e:
                error_msg = f"Error importing {element_code}: {str(e)}"
                errors.append(error_msg)
                print(f"✗ {error_msg}")
                skipped += 1
    
    if not dry_run:
        conn.commit()
    
    cur.close()
    
    print(f"\n{'DRY RUN: ' if dry_run else ''}Import Summary:")
    print(f"  Imported: {imported}")
    print(f"  Skipped: {skipped}")
    print(f"  Errors: {len(errors)}")
    
    if errors:
        print("\nErrors:")
        for error in errors[:10]:  # Show first 10 errors
            print(f"  - {error}")
    
    return imported, skipped, len(errors)

def main():
    parser = argparse.ArgumentParser(
        description="Import OFC Templates from JSON into Database",
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
    
    # Paths
    templates_path = project_root / 'public' / 'doctrine' / 'ofc_templates_baseline_v1.json'
    baseline_path = project_root / 'analytics' / 'runtime' / 'baseline_questions_registry_v2.json'
    
    # Check if files exist
    if not templates_path.exists():
        print(f"Error: OFC templates file not found: {templates_path}")
        sys.exit(1)
    
    if not baseline_path.exists():
        print(f"Error: Baseline questions file not found: {baseline_path}")
        sys.exit(1)
    
    # Load data
    print("Loading OFC templates...")
    templates = load_ofc_templates(str(templates_path))
    print(f"✓ Loaded {len(templates)} templates")
    
    print("Loading baseline questions...")
    baseline_lookup = load_baseline_questions(str(baseline_path))
    print(f"✓ Loaded {len(baseline_lookup)} baseline questions")
    
    # Connect to database
    print("\nConnecting to database...")
    conn = get_db_connection()
    print("✓ Connected")
    
    # Dry run first
    print("\n" + "="*80)
    print("DRY RUN")
    print("="*80)
    import_ofc_templates(conn, templates, baseline_lookup, dry_run=True)
    
    # Apply changes only if --apply is set
    if args.apply:
        print("\n" + "="*80)
        print("IMPORTING")
        print("="*80)
        import_ofc_templates(conn, templates, baseline_lookup, dry_run=False)
        print("\n✅ Import complete!")
    else:
        print("\n⚠️  DRY RUN complete. Use --apply to write changes to database.")
    
    conn.close()

if __name__ == '__main__':
    main()

