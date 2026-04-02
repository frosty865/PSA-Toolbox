#!/usr/bin/env python3
"""
Update IST Sheet to Taxonomy Mapping
Queries database for discipline UUIDs and updates the mapping file.
"""

import json
import os
import sys
from pathlib import Path
import psycopg2
from urllib.parse import urlparse
from difflib import SequenceMatcher

def load_env_file(filepath: str):
    """Load environment variables from file."""
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
    project_root = os.path.join(script_dir, '..', '..')
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

def similarity(a: str, b: str) -> float:
    """Calculate similarity between two strings."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def find_best_match(sheet_name: str, disciplines: list) -> tuple:
    """Find best matching discipline for a sheet name."""
    best_match = None
    best_score = 0.0
    
    for disc in disciplines:
        disc_name = disc['name']
        # Try exact match first
        if sheet_name.lower() == disc_name.lower():
            return disc, 1.0
        
        # Try partial match
        if sheet_name.lower() in disc_name.lower() or disc_name.lower() in sheet_name.lower():
            score = similarity(sheet_name, disc_name)
            if score > best_score:
                best_score = score
                best_match = disc
    
    # If no good match, try fuzzy matching
    if best_score < 0.6:
        for disc in disciplines:
            score = similarity(sheet_name, disc['name'])
            if score > best_score:
                best_score = score
                best_match = disc
    
    return best_match, best_score

def main():
    """Main update process."""
    script_dir = Path(__file__).parent
    mapping_path = script_dir / "ist_sheet_to_taxonomy_map.json"
    
    print("=" * 80)
    print("Update IST Sheet to Taxonomy Mapping")
    print("=" * 80)
    print()
    
    # Load existing mapping
    if not mapping_path.exists():
        print(f"ERROR: Mapping file not found: {mapping_path}")
        sys.exit(1)
    
    with open(mapping_path, 'r', encoding='utf-8') as f:
        mapping = json.load(f)
    
    # Get sheet names (exclude comment keys)
    sheet_names = [k for k in mapping.keys() if not k.startswith('_')]
    print(f"Found {len(sheet_names)} sheet names to map:")
    for name in sheet_names:
        print(f"  - {name}")
    
    # Connect to database
    print("\nConnecting to database...")
    try:
        conn = get_db_connection()
        print("✓ Connected")
    except Exception as e:
        print(f"ERROR: Failed to connect to database: {e}")
        sys.exit(1)
    
    # Query disciplines
    cur = conn.cursor()
    cur.execute("""
        SELECT id, name, code, category
        FROM disciplines
        WHERE is_active = true
        ORDER BY name
    """)
    
    disciplines = []
    for row in cur.fetchall():
        disciplines.append({
            'id': str(row[0]),
            'name': row[1],
            'code': row[2],
            'category': row[3]
        })
    
    print(f"\nFound {len(disciplines)} active disciplines in database")
    
    # Match sheet names to disciplines
    print("\nMatching sheet names to disciplines...")
    updated_count = 0
    unmatched = []
    
    for sheet_name in sheet_names:
        best_match, score = find_best_match(sheet_name, disciplines)
        
        if best_match and score >= 0.5:
            mapping[sheet_name]["discipline_id"] = best_match['id']
            print(f"  ✓ {sheet_name} → {best_match['name']} (score: {score:.2f})")
            print(f"    UUID: {best_match['id']}")
            updated_count += 1
        else:
            unmatched.append(sheet_name)
            print(f"  ✗ {sheet_name} → No good match found (best score: {score:.2f})")
    
    # Handle unmatched
    if unmatched:
        print(f"\n⚠ {len(unmatched)} sheet name(s) could not be automatically matched:")
        for name in unmatched:
            print(f"  - {name}")
        print("\nAvailable disciplines:")
        for disc in disciplines:
            print(f"  - {disc['name']} (code: {disc['code']}, category: {disc['category']})")
        print("\nPlease manually update these in the mapping file.")
    
    # Save updated mapping
    print(f"\nSaving updated mapping to {mapping_path}")
    with open(mapping_path, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)
    
    cur.close()
    conn.close()
    
    print(f"\n✓ Updated {updated_count}/{len(sheet_names)} mappings")
    if unmatched:
        print(f"⚠ {len(unmatched)} require manual update")
    print("=" * 80)

if __name__ == "__main__":
    main()

