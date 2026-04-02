#!/usr/bin/env python3
"""
Cleanup script for invalid technology profiles.

Identifies and reports technology profiles with tech_types that are not
allowed for their discipline/subtype combination according to the catalog.

Usage:
    python tools/cleanup_invalid_tech_profiles.py [--dry-run]
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Set
import psycopg2
from urllib.parse import urlparse

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

def load_tech_catalog() -> Dict:
    """Load technology types catalog."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.join(script_dir, '..')
    catalog_path = os.path.join(project_root, 'analytics', 'runtime', 'technology_types_catalog.json')
    
    if not os.path.exists(catalog_path):
        print(f"ERROR: Catalog file not found: {catalog_path}")
        sys.exit(1)
    
    with open(catalog_path, 'r') as f:
        return json.load(f)

def get_allowed_tech_types(catalog: Dict, discipline_code: str, subtype_code: str) -> Set[str]:
    """Get allowed tech types for a discipline/subtype combination."""
    discipline_catalog = catalog.get('catalog', {}).get(discipline_code, {})
    subtype_tech_types = discipline_catalog.get(subtype_code, [])
    
    # Extract values from catalog entries
    allowed = set()
    for entry in subtype_tech_types:
        if isinstance(entry, dict) and 'value' in entry:
            allowed.add(entry['value'])
        elif isinstance(entry, str):
            allowed.add(entry)
    
    return allowed

def find_invalid_profiles(conn, catalog: Dict, dry_run: bool = True) -> List[Dict]:
    """Find technology profiles with invalid tech types."""
    cur = conn.cursor()
    
    # Get all technology profiles
    cur.execute("""
        SELECT 
            id,
            assessment_id,
            discipline_code,
            subtype_code,
            tech_type
        FROM public.assessment_technology_profiles
        ORDER BY assessment_id, subtype_code, tech_type
    """)
    
    profiles = cur.fetchall()
    invalid_profiles = []
    
    for row in profiles:
        profile_id, assessment_id, discipline_code, subtype_code, tech_type = row
        
        # Get allowed tech types for this discipline/subtype
        allowed = get_allowed_tech_types(catalog, discipline_code, subtype_code)
        
        # If no catalog entry exists, mark as invalid (no defaults)
        if not allowed:
            invalid_profiles.append({
                'id': str(profile_id),
                'assessment_id': str(assessment_id),
                'discipline_code': discipline_code,
                'subtype_code': subtype_code,
                'tech_type': tech_type,
                'reason': 'No catalog entry for this subtype'
            })
        elif tech_type not in allowed:
            invalid_profiles.append({
                'id': str(profile_id),
                'assessment_id': str(assessment_id),
                'discipline_code': discipline_code,
                'subtype_code': subtype_code,
                'tech_type': tech_type,
                'reason': f'Tech type not in allowed list: {list(allowed)}'
            })
    
    cur.close()
    return invalid_profiles

def cleanup_invalid_profiles(conn, invalid_profiles: List[Dict], dry_run: bool = True):
    """Clean up invalid profiles (delete or mark as invalid)."""
    if dry_run:
        print("\n=== DRY RUN MODE - No changes will be made ===\n")
        return
    
    cur = conn.cursor()
    
    for profile in invalid_profiles:
        try:
            # Delete invalid profile
            cur.execute("""
                DELETE FROM public.assessment_technology_profiles
                WHERE id = %s
            """, (profile['id'],))
            print(f"Deleted invalid profile: {profile['id']} ({profile['subtype_code']} / {profile['tech_type']})")
        except Exception as e:
            print(f"Error deleting profile {profile['id']}: {e}")
    
    conn.commit()
    cur.close()

def main():
    dry_run = '--dry-run' in sys.argv or '--dryrun' in sys.argv
    
    print("Loading technology types catalog...")
    catalog = load_tech_catalog()
    
    print("Connecting to database...")
    conn = get_db_connection()
    
    print("Finding invalid technology profiles...")
    invalid_profiles = find_invalid_profiles(conn, catalog, dry_run)
    
    if not invalid_profiles:
        print("\n✓ No invalid technology profiles found.")
        conn.close()
        return
    
    print(f"\nFound {len(invalid_profiles)} invalid technology profile(s):\n")
    
    # Group by assessment for reporting
    by_assessment = {}
    for profile in invalid_profiles:
        assessment_id = profile['assessment_id']
        if assessment_id not in by_assessment:
            by_assessment[assessment_id] = []
        by_assessment[assessment_id].append(profile)
    
    # Print report
    print("=" * 80)
    print("INVALID TECHNOLOGY PROFILES REPORT")
    print("=" * 80)
    print(f"\nTotal invalid profiles: {len(invalid_profiles)}")
    print(f"Affected assessments: {len(by_assessment)}\n")
    
    for assessment_id, profiles in sorted(by_assessment.items()):
        print(f"\nAssessment: {assessment_id}")
        print("-" * 80)
        for profile in profiles:
            print(f"  Subtype: {profile['subtype_code']}")
            print(f"  Tech Type: {profile['tech_type']}")
            print(f"  Reason: {profile['reason']}")
            print()
    
    # Generate JSON report
    report_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'analytics', 'reports', 'invalid_tech_profiles_report.json')
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    
    with open(report_path, 'w') as f:
        json.dump({
            'metadata': {
                'generated_at': str(psycopg2.extensions.datetime.datetime.now()),
                'total_invalid': len(invalid_profiles),
                'affected_assessments': len(by_assessment),
                'dry_run': dry_run
            },
            'invalid_profiles': invalid_profiles
        }, f, indent=2)
    
    print(f"\nReport saved to: {report_path}")
    
    # Cleanup if not dry run
    if not dry_run:
        print("\nCleaning up invalid profiles...")
        cleanup_invalid_profiles(conn, invalid_profiles, dry_run=False)
        print("\n✓ Cleanup complete.")
    else:
        print("\nRun without --dry-run to perform cleanup.")
    
    conn.close()

if __name__ == '__main__':
    main()

