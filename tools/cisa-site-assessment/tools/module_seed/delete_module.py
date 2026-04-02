#!/usr/bin/env python3
"""
Completely delete a module and all its related data.

IMPORTANT: This script must be run in a virtual environment (venv).
  Activate venv first:
    Windows: .venv\Scripts\activate
    Linux/Mac: source .venv/bin/activate

Usage:
  python tools/module_seed/delete_module.py MODULE_CODE [--force]

WARNING: This will permanently delete:
  - Module metadata (assessment_modules)
  - All module questions (module_questions)
  - All module OFCs (module_ofcs)
  - All module sources (module_ofc_sources)
  - All module instances (assessment_module_instances)
  - All module VOFCs (module_ofc_library, module_ofc_citations)
  - All module instance data (module_instances, module_instance_criteria, etc.)

Use --force to skip confirmation prompts.
"""
import os
import sys
from pathlib import Path

# Check if running in a virtual environment
if not hasattr(sys, 'real_prefix') and not (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
    print("ERROR: This script must be run in a virtual environment (venv)")
    print("\nTo activate venv:")
    print("  Windows: .venv\\Scripts\\activate")
    print("  Linux/Mac: source .venv/bin/activate")
    print("\nOr create a venv if it doesn't exist:")
    print("  python -m venv .venv")
    sys.exit(1)

import psycopg2

# Try to load .env.local if it exists
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent.parent / '.env.local'
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    # dotenv not installed, try to manually parse .env.local
    env_path = Path(__file__).parent.parent.parent / '.env.local'
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    if key in ('RUNTIME_DATABASE_URL', 'CORPUS_DATABASE_URL', 'DATABASE_URL'):
                        os.environ[key] = value

def get_module_info(cur, module_code):
    """Get comprehensive information about a module."""
    info = {
        'exists': False,
        'module_name': None,
        'status': None,
        'question_count': 0,
        'ofc_count': 0,
        'ofc_source_count': 0,
        'instance_count': 0,
        'vofc_count': 0,
        'vofc_citation_count': 0,
        'module_instance_count': 0,
    }
    
    # Check if module exists
    cur.execute("""
        SELECT module_code, module_name, status
        FROM public.assessment_modules
        WHERE module_code = %s
    """, (module_code,))
    
    result = cur.fetchone()
    if not result:
        return info
    
    info['exists'] = True
    info['module_name'] = result[1]
    info['status'] = result[2]
    
    # Count related data
    try:
        cur.execute("SELECT COUNT(*) FROM public.module_questions WHERE module_code = %s", (module_code,))
        info['question_count'] = cur.fetchone()[0] or 0
    except:
        pass
    
    try:
        cur.execute("SELECT COUNT(*) FROM public.module_ofcs WHERE module_code = %s", (module_code,))
        info['ofc_count'] = cur.fetchone()[0] or 0
    except:
        pass
    
    try:
        cur.execute("""
            SELECT COUNT(*) FROM public.module_ofc_sources mos
            JOIN public.module_ofcs mo ON mos.module_ofc_id = mo.id
            WHERE mo.module_code = %s
        """, (module_code,))
        info['ofc_source_count'] = cur.fetchone()[0] or 0
    except:
        pass
    
    try:
        cur.execute("SELECT COUNT(*) FROM public.assessment_module_instances WHERE module_code = %s", (module_code,))
        info['instance_count'] = cur.fetchone()[0] or 0
    except:
        pass
    
    try:
        cur.execute("SELECT COUNT(*) FROM public.module_ofc_library WHERE module_code = %s", (module_code,))
        info['vofc_count'] = cur.fetchone()[0] or 0
    except:
        pass
    
    try:
        cur.execute("""
            SELECT COUNT(*) FROM public.module_ofc_citations moc
            JOIN public.module_ofc_library mol ON moc.module_ofc_id = mol.id
            WHERE mol.module_code = %s
        """, (module_code,))
        info['vofc_citation_count'] = cur.fetchone()[0] or 0
    except:
        pass
    
    try:
        cur.execute("SELECT COUNT(*) FROM public.module_instances WHERE module_code = %s", (module_code,))
        info['module_instance_count'] = cur.fetchone()[0] or 0
    except:
        pass
    
    return info

def main():
    force = '--force' in sys.argv
    
    if len(sys.argv) < 2 or (len(sys.argv) == 2 and sys.argv[1] == '--force'):
        print("Usage: python tools/module_seed/delete_module.py MODULE_CODE [--force]")
        print("Example: python tools/module_seed/delete_module.py MODULE_VEHICLE_RAMMING_SAT")
        print("\nUse --force to skip confirmation prompts")
        sys.exit(1)
    
    module_codes = [arg for arg in sys.argv[1:] if arg != '--force']
    
    if not module_codes:
        print("ERROR: No module codes provided")
        sys.exit(1)
    
    runtime_url = os.environ.get("RUNTIME_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not runtime_url:
        print("ERROR: RUNTIME_DATABASE_URL or DATABASE_URL not set")
        sys.exit(1)
    
    print("=" * 60)
    print("Delete Module(s)")
    print("=" * 60)
    print(f"Modules to delete: {', '.join(module_codes)}")
    print()
    
    conn = psycopg2.connect(runtime_url)
    conn.autocommit = False
    cur = conn.cursor()
    
    try:
        # Get info for all modules
        modules_info = {}
        for module_code in module_codes:
            module_code = module_code.strip().upper()
            if not module_code.startswith('MODULE_'):
                print(f"ERROR: Module code must start with 'MODULE_' (got: {module_code})")
                sys.exit(1)
            
            info = get_module_info(cur, module_code)
            modules_info[module_code] = info
            
            if not info['exists']:
                print(f"⚠️  WARNING: Module {module_code} not found (will be skipped)")
                continue
            
            print(f"Module: {module_code}")
            print(f"  Name: {info['module_name']}")
            print(f"  Status: {info['status']}")
            print(f"  Questions: {info['question_count']}")
            print(f"  OFCs: {info['ofc_count']}")
            print(f"  OFC Sources: {info['ofc_source_count']}")
            print(f"  Assessment Instances: {info['instance_count']}")
            print(f"  VOFCs: {info['vofc_count']}")
            print(f"  VOFC Citations: {info['vofc_citation_count']}")
            print(f"  Module Instances: {info['module_instance_count']}")
            print()
        
        # Calculate totals
        total_items = sum(
            info['question_count'] + info['ofc_count'] + info['ofc_source_count'] + 
            info['instance_count'] + info['vofc_count'] + info['vofc_citation_count'] + 
            info['module_instance_count']
            for info in modules_info.values() if info['exists']
        )
        
        existing_modules = [code for code, info in modules_info.items() if info['exists']]
        
        if not existing_modules:
            print("No modules found to delete.")
            return
        
        print("=" * 60)
        print("⚠️  WARNING: This will PERMANENTLY DELETE:")
        print("=" * 60)
        for module_code in existing_modules:
            info = modules_info[module_code]
            print(f"\n{module_code} ({info['module_name']}):")
            if info['question_count'] > 0:
                print(f"  - {info['question_count']} question(s)")
            if info['ofc_count'] > 0:
                print(f"  - {info['ofc_count']} OFC(s)")
            if info['ofc_source_count'] > 0:
                print(f"  - {info['ofc_source_count']} OFC source(s)")
            if info['instance_count'] > 0:
                print(f"  - {info['instance_count']} assessment instance(s)")
            if info['vofc_count'] > 0:
                print(f"  - {info['vofc_count']} VOFC(s)")
            if info['vofc_citation_count'] > 0:
                print(f"  - {info['vofc_citation_count']} VOFC citation(s)")
            if info['module_instance_count'] > 0:
                print(f"  - {info['module_instance_count']} module instance(s)")
        
        print(f"\nTotal items to delete: {total_items}")
        print("\nThis action CANNOT be undone!")
        print()
        
        if not force:
            response = input("Type 'DELETE' to confirm deletion: ")
            if response != 'DELETE':
                print("Cancelled. Type 'DELETE' exactly to confirm.")
                return
        
        # Delete modules (CASCADE will handle related records)
        print("\nDeleting modules...")
        deleted_count = 0
        
        for module_code in existing_modules:
            try:
                cur.execute("DELETE FROM public.assessment_modules WHERE module_code = %s", (module_code,))
                if cur.rowcount > 0:
                    print(f"✓ Deleted {module_code}")
                    deleted_count += 1
                else:
                    print(f"⚠️  No rows deleted for {module_code}")
            except Exception as e:
                print(f"✗ Error deleting {module_code}: {e}")
                conn.rollback()
                raise
        
        conn.commit()
        print(f"\n✓ Successfully deleted {deleted_count} module(s)")
        
        # Verify deletion
        print("\nVerifying deletion...")
        for module_code in existing_modules:
            cur.execute("SELECT COUNT(*) FROM public.assessment_modules WHERE module_code = %s", (module_code,))
            still_exists = cur.fetchone()[0] > 0
            if still_exists:
                print(f"⚠️  WARNING: {module_code} still exists after deletion!")
            else:
                print(f"✓ {module_code} confirmed deleted")
        
    except Exception as e:
        conn.rollback()
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
