#!/usr/bin/env python3
"""
PHASE 1: TAXONOMY COMPLETION
Complete all 104 discipline subtypes with stable subtype_code identifiers.

AUTHORITATIVE: This script generates and validates subtype_code for all subtypes.
Rules:
- subtype_code format: <DISCIPLINE_CODE>_<SUBTYPE_SLUG>
- SUBTYPE_SLUG: Uppercase, ASCII only, replace /&/-/spaces with _, collapse multiple _
- NO abbreviations invented
- MUST be stable and NEVER change once written
- FAIL HARD on violations
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple
import psycopg2
from urllib.parse import urlparse

# Expected total subtypes
EXPECTED_SUBTYPE_COUNT = 104


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
    """Get database connection from environment variables."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.join(script_dir, '..')
    env_file = os.path.join(project_root, 'env.local')
    if not os.path.exists(env_file):
        env_file = os.path.join(project_root, '.env.local')
    if os.path.exists(env_file):
        load_env_file(env_file)
    
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        parsed = urlparse(database_url)
        ssl_mode = 'require' if 'supabase' in database_url.lower() else None
        return psycopg2.connect(database_url, sslmode=ssl_mode)
    
    # Fallback to individual components
    user = os.getenv('DATABASE_USER', 'postgres')
    password = os.getenv('DATABASE_PASSWORD', '')
    host = os.getenv('DATABASE_HOST', 'localhost')
    port = os.getenv('DATABASE_PORT', '5432')
    dbname = os.getenv('DATABASE_NAME', 'postgres')
    
    return psycopg2.connect(
        host=host,
        port=port,
        database=dbname,
        user=user,
        password=password
    )


def generate_subtype_slug(subtype_name: str) -> str:
    """
    Generate SUBTYPE_SLUG from subtype name.
    Rules:
    - Uppercase
    - ASCII only
    - Replace /, &, -, and spaces with _
    - Collapse multiple _
    - No abbreviations invented
    - Derived mechanically from existing subtype name
    """
    if not subtype_name:
        raise ValueError("Subtype name cannot be empty")
    
    # Convert to uppercase
    slug = subtype_name.upper()
    
    # Replace special characters with underscore
    slug = slug.replace('/', '_')
    slug = slug.replace('&', '_')
    slug = slug.replace('-', '_')
    slug = slug.replace(' ', '_')
    
    # Remove non-ASCII characters (keep only ASCII)
    slug = ''.join(c if ord(c) < 128 else '_' for c in slug)
    
    # Remove any remaining non-alphanumeric except underscore
    slug = re.sub(r'[^A-Z0-9_]', '_', slug)
    
    # Collapse multiple underscores
    slug = re.sub(r'_+', '_', slug)
    
    # Remove leading/trailing underscores
    slug = slug.strip('_')
    
    if not slug:
        raise ValueError(f"Cannot generate slug from subtype name: {subtype_name}")
    
    return slug


def generate_subtype_code(discipline_code: str, subtype_name: str) -> str:
    """
    Generate subtype_code using format: <DISCIPLINE_CODE>_<SUBTYPE_SLUG>
    """
    if not discipline_code:
        raise ValueError("Discipline code cannot be empty")
    
    subtype_slug = generate_subtype_slug(subtype_name)
    return f"{discipline_code}_{subtype_slug}"


def load_taxonomy_from_db(conn) -> Tuple[List[Dict], List[Dict]]:
    """Load disciplines and subtypes from database."""
    cur = conn.cursor()
    
    # Load disciplines
    cur.execute("""
        SELECT id, name, code, description, category, is_active
        FROM disciplines
        WHERE is_active = true
        ORDER BY category, name
    """)
    disciplines = []
    for row in cur.fetchall():
        disciplines.append({
            'id': str(row[0]),
            'name': row[1],
            'code': row[2],
            'description': row[3],
            'category': row[4],
            'is_active': row[5]
        })
    
    # Load ALL discipline subtypes (including inactive for completeness)
    cur.execute("""
        SELECT 
            ds.id,
            ds.name,
            ds.code,
            ds.description,
            ds.discipline_id,
            ds.is_active,
            d.code as discipline_code,
            d.name as discipline_name
        FROM discipline_subtypes ds
        JOIN disciplines d ON ds.discipline_id = d.id
        ORDER BY d.code, ds.name
    """)
    subtypes = []
    for row in cur.fetchall():
        subtypes.append({
            'id': str(row[0]),
            'name': row[1],
            'code': row[2],  # Existing code (may be None)
            'description': row[3],
            'discipline_id': str(row[4]),
            'is_active': row[5],
            'discipline_code': row[6],
            'discipline_name': row[7]
        })
    
    cur.close()
    return disciplines, subtypes


def validate_taxonomy(subtypes: List[Dict], disciplines: List[Dict]) -> Tuple[bool, List[str]]:
    """
    Validate taxonomy completeness and correctness.
    Returns (is_valid, error_messages)
    """
    errors = []
    
    # Check total count
    if len(subtypes) != EXPECTED_SUBTYPE_COUNT:
        errors.append(
            f"VIOLATION: Expected {EXPECTED_SUBTYPE_COUNT} subtypes, found {len(subtypes)}"
        )
    
    # Check all subtypes have subtype_code
    missing_codes = []
    for subtype in subtypes:
        if not subtype.get('subtype_code') or subtype.get('subtype_code').strip() == '':
            missing_codes.append(f"{subtype['name']} (ID: {subtype['id']})")
    
    if missing_codes:
        errors.append(
            f"VIOLATION: {len(missing_codes)} subtypes missing subtype_code: {', '.join(missing_codes[:5])}"
        )
    
    # Check for duplicate subtype_code
    subtype_codes = {}
    for subtype in subtypes:
        code = subtype.get('subtype_code')
        if code:
            if code in subtype_codes:
                errors.append(
                    f"VIOLATION: Duplicate subtype_code '{code}': "
                    f"{subtype['name']} and {subtype_codes[code]['name']}"
                )
            else:
                subtype_codes[code] = subtype
    
    # Check prefix matches parent discipline code
    discipline_codes = {d['id']: d['code'] for d in disciplines}
    prefix_mismatches = []
    for subtype in subtypes:
        code = subtype.get('subtype_code', '')
        discipline_code = discipline_codes.get(subtype['discipline_id'])
        if code and discipline_code:
            expected_prefix = f"{discipline_code}_"
            if not code.startswith(expected_prefix):
                prefix_mismatches.append(
                    f"{subtype['name']}: code '{code}' does not start with '{expected_prefix}'"
                )
    
    if prefix_mismatches:
        errors.append(
            f"VIOLATION: {len(prefix_mismatches)} subtypes have prefix mismatch: {', '.join(prefix_mismatches[:3])}"
        )
    
    return len(errors) == 0, errors


def main():
    """Main execution."""
    print("=" * 80)
    print("PHASE 1: TAXONOMY COMPLETION")
    print("=" * 80)
    print()
    
    # Connect to database
    try:
        print("Connecting to database...")
        conn = get_db_connection()
        print("✓ Database connection established")
    except Exception as e:
        print(f"✗ FAILED: Cannot connect to database: {e}")
        sys.exit(1)
    
    try:
        # Load taxonomy
        print("Loading taxonomy from database...")
        disciplines, subtypes = load_taxonomy_from_db(conn)
        print(f"✓ Loaded {len(disciplines)} disciplines and {len(subtypes)} subtypes")
        
        # Create discipline lookup
        discipline_lookup = {d['id']: d for d in disciplines}
        
        # Generate subtype_code for all subtypes missing it
        print("\nGenerating subtype_code for subtypes...")
        updated_count = 0
        for subtype in subtypes:
            existing_code = subtype.get('code') or subtype.get('subtype_code')
            
            if not existing_code or existing_code.strip() == '':
                discipline = discipline_lookup.get(subtype['discipline_id'])
                if not discipline:
                    print(f"✗ ERROR: Subtype '{subtype['name']}' references invalid discipline_id: {subtype['discipline_id']}")
                    continue
                
                if not discipline.get('code'):
                    print(f"✗ ERROR: Discipline '{discipline['name']}' has no code")
                    continue
                
                try:
                    subtype_code = generate_subtype_code(discipline['code'], subtype['name'])
                    subtype['subtype_code'] = subtype_code
                    updated_count += 1
                    print(f"  Generated: {subtype['name']} → {subtype_code}")
                except Exception as e:
                    print(f"✗ ERROR: Failed to generate code for '{subtype['name']}': {e}")
            else:
                # Use existing code as subtype_code
                subtype['subtype_code'] = existing_code
        
        print(f"✓ Generated {updated_count} new subtype_code values")
        
        # Validate taxonomy
        print("\nValidating taxonomy...")
        is_valid, errors = validate_taxonomy(subtypes, disciplines)
        
        if not is_valid:
            print("\n✗ VALIDATION FAILED:")
            for error in errors:
                print(f"  {error}")
            print("\nFAILING HARD - Fix violations before proceeding")
            sys.exit(1)
        
        print("✓ All validations passed")
        
        # Write taxonomy file
        # The user specified: psa_engine/taxonomy/discipline_subtypes.json
        # But based on API routes, it might be: psa_engine/docs/doctrine/taxonomy/discipline_subtypes.json
        # We'll create it in the workspace root under taxonomy/ for now
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.join(script_dir, '..')
        
        # Try multiple possible locations
        taxonomy_paths = [
            os.path.join(project_root, 'taxonomy', 'discipline_subtypes.json'),
            os.path.join(project_root, 'docs', 'doctrine', 'taxonomy', 'discipline_subtypes.json'),
        ]
        
        taxonomy_path = None
        for path in taxonomy_paths:
            if os.path.exists(os.path.dirname(path)) or path == taxonomy_paths[0]:
                taxonomy_path = path
                break
        
        if not taxonomy_path:
            taxonomy_path = taxonomy_paths[0]
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(taxonomy_path), exist_ok=True)
        
        # Prepare output structure
        taxonomy_output = {
            'metadata': {
                'version': '1.0',
                'total_subtypes': len(subtypes),
                'generated_at': __import__('datetime').datetime.utcnow().isoformat() + 'Z',
                'authority': 'psa_engine'
            },
            'subtypes': []
        }
        
        # Add all subtypes with subtype_code
        for subtype in subtypes:
            taxonomy_output['subtypes'].append({
                'id': subtype['id'],
                'name': subtype['name'],
                'subtype_code': subtype['subtype_code'],
                'description': subtype.get('description'),
                'discipline_id': subtype['discipline_id'],
                'discipline_code': subtype.get('discipline_code'),
                'discipline_name': subtype.get('discipline_name'),
                'is_active': subtype.get('is_active', True)
            })
        
        # Write file
        print(f"\nWriting taxonomy file to: {taxonomy_path}")
        with open(taxonomy_path, 'w', encoding='utf-8') as f:
            json.dump(taxonomy_output, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Taxonomy file written successfully")
        print(f"  Total subtypes: {len(subtypes)}")
        print(f"  All subtypes have subtype_code: ✓")
        print(f"  No duplicate codes: ✓")
        print(f"  All prefixes match discipline codes: ✓")
        
        print("\n" + "=" * 80)
        print("PHASE 1 COMPLETE: Taxonomy is machine-complete")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n✗ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == '__main__':
    main()

