#!/usr/bin/env python3
"""
Demote a module from ACTIVE to DRAFT status.

IMPORTANT: This script must be run in a virtual environment (venv).
  Activate venv first:
    Windows: .venv\Scripts\activate
    Linux/Mac: source .venv/bin/activate

Usage:
  python tools/module_seed/demote_module_to_draft.py MODULE_CODE

This will:
1. Check if the module exists and is ACTIVE
2. Update status to DRAFT
3. Optionally check if module has questions/OFCs (warning if it does)
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

def main():
    if len(sys.argv) < 2:
        print("Usage: python tools/module_seed/demote_module_to_draft.py MODULE_CODE")
        print("Example: python tools/module_seed/demote_module_to_draft.py MODULE_VEHICLE_RAMMING_SAT")
        sys.exit(1)
    
    module_code = sys.argv[1].strip().upper()
    
    if not module_code.startswith('MODULE_'):
        print(f"ERROR: Module code must start with 'MODULE_' (got: {module_code})")
        sys.exit(1)
    
    runtime_url = os.environ.get("RUNTIME_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not runtime_url:
        print("ERROR: RUNTIME_DATABASE_URL or DATABASE_URL not set")
        sys.exit(1)
    
    print("=" * 60)
    print("Demote Module to DRAFT")
    print("=" * 60)
    print(f"Module: {module_code}")
    print()
    
    conn = psycopg2.connect(runtime_url)
    conn.autocommit = False
    cur = conn.cursor()
    
    try:
        # Check if module exists and get current status
        cur.execute("""
            SELECT module_code, module_name, status, 
                   (SELECT COUNT(*) FROM public.module_questions WHERE module_code = am.module_code) as question_count,
                   (SELECT COUNT(*) FROM public.module_ofcs WHERE module_code = am.module_code) as ofc_count
            FROM public.assessment_modules am
            WHERE module_code = %s
        """, (module_code,))
        
        result = cur.fetchone()
        if not result:
            print(f"ERROR: Module {module_code} not found")
            sys.exit(1)
        
        current_status = result[2]
        module_name = result[1]
        question_count = result[3] or 0
        ofc_count = result[4] or 0
        
        print(f"Module Name: {module_name}")
        print(f"Current Status: {current_status}")
        print(f"Questions: {question_count}")
        print(f"OFCs: {ofc_count}")
        print()
        
        if current_status == 'DRAFT':
            print("✓ Module is already DRAFT. No change needed.")
            return
        
        if current_status != 'ACTIVE':
            print(f"WARNING: Module status is '{current_status}' (expected ACTIVE)")
            response = input("Continue anyway? (y/N): ")
            if response.lower() != 'y':
                print("Cancelled.")
                return
        
        if question_count > 0 or ofc_count > 0:
            print("⚠️  WARNING: Module has content:")
            if question_count > 0:
                print(f"   - {question_count} question(s)")
            if ofc_count > 0:
                print(f"   - {ofc_count} OFC(s)")
            print()
            print("Demoting to DRAFT will:")
            print("  - Prevent the module from being attached to new assessments")
            print("  - NOT delete existing questions or OFCs")
            print()
            response = input("Continue with demotion? (y/N): ")
            if response.lower() != 'y':
                print("Cancelled.")
                return
        
        # Update status to DRAFT
        print(f"Updating status from {current_status} to DRAFT...")
        cur.execute("""
            UPDATE public.assessment_modules
            SET status = 'DRAFT', updated_at = now()
            WHERE module_code = %s
        """, (module_code,))
        
        if cur.rowcount == 0:
            print("ERROR: Update failed (no rows affected)")
            conn.rollback()
            sys.exit(1)
        
        conn.commit()
        print("✓ Module demoted to DRAFT successfully")
        print()
        print("Note: The module can be re-activated by updating status back to ACTIVE")
        print("      (or by importing questions/OFCs, which will auto-set status to ACTIVE)")
        
    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
