"""Wrapper script to run purge_modules_clean_slate.py with environment variables from check_db_env.py

Usage:
    python run_purge_dry_run.py          # Dry run (default)
    python run_purge_dry_run.py --execute # Execute deletes
    python run_purge_dry_run.py --execute --filesystem  # Also delete files
    python run_purge_dry_run.py --execute --filesystem --source-registry  # Full purge
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path

# Add parent directory to path to import check_db_env
sys.path.insert(0, str(Path(__file__).parent))
from check_db_env import construct_runtime_url, construct_corpus_url

def main():
    parser = argparse.ArgumentParser(description='Run module purge script')
    parser.add_argument('--execute', action='store_true', help='Execute deletes (default: dry run)')
    parser.add_argument('--filesystem', action='store_true', help='Also delete filesystem files')
    parser.add_argument('--source-registry', action='store_true', help='Also delete source_registry rows')
    args = parser.parse_args()
    
    runtime_url = construct_runtime_url()
    corpus_url = construct_corpus_url()
    
    if not runtime_url:
        print("[FATAL] Could not construct PSA_RUNTIME_DB_URL", file=sys.stderr)
        sys.exit(1)
    
    if not corpus_url:
        print("[FATAL] Could not construct PSA_CORPUS_DB_URL", file=sys.stderr)
        sys.exit(1)
    
    # Set environment variables
    os.environ['PSA_RUNTIME_DB_URL'] = runtime_url
    os.environ['PSA_CORPUS_DB_URL'] = corpus_url
    
    # Set purge flags based on arguments
    if args.execute:
        os.environ['ALLOW_MODULE_PURGE'] = 'YES'
        print("[WARNING] EXECUTING DELETES - This will permanently delete module data!")
    else:
        # Ensure ALLOW_MODULE_PURGE is NOT set (dry run)
        if 'ALLOW_MODULE_PURGE' in os.environ:
            del os.environ['ALLOW_MODULE_PURGE']
        print("[INFO] DRY RUN MODE - No deletes will be executed")
    
    if args.filesystem:
        os.environ['ALLOW_MODULE_PURGE_FS'] = 'YES'
        print("[WARNING] Filesystem files will be deleted!")
    
    if args.source_registry:
        os.environ['ALLOW_MODULE_PURGE_SOURCE_REGISTRY'] = 'YES'
        print("[WARNING] source_registry rows will be deleted!")
    
    # Run the purge script
    script_path = Path(__file__).parent / 'purge_modules_clean_slate.py'
    result = subprocess.run([sys.executable, str(script_path)], env=os.environ)
    sys.exit(result.returncode)

if __name__ == '__main__':
    main()
