#!/usr/bin/env python3
"""
Runner for OFC Mining V3

Runs coverage snapshot then mining.

Usage:
    python tools/run_mine_ofc_v3.py --dry_run
    python tools/run_mine_ofc_v3.py  # Actually mine
"""

import argparse
import subprocess
import sys
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description='Run OFC Mining V3 pipeline')
    parser.add_argument('--dry_run', action='store_true', help='Dry run (no database writes)')
    parser.add_argument('--limit_subtypes', type=int, default=25, help='Limit subtypes to mine')
    parser.add_argument('--max_per_subtype', type=int, default=30, help='Max candidates per subtype')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("OFC Mining V3 Pipeline")
    print("=" * 60)
    
    # Step 1: Run coverage report
    print("\n[STEP 1] Generating coverage report...")
    coverage_script = Path('tools/analytics/report_ofc_candidate_coverage_by_subtype.py')
    
    if not coverage_script.exists():
        print(f"[ERROR] Coverage script not found: {coverage_script}")
        sys.exit(1)
    
    result = subprocess.run(
        [sys.executable, str(coverage_script)],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"[ERROR] Coverage report failed:")
        print(result.stderr)
        sys.exit(1)
    
    print(result.stdout)
    
    # Step 2: Run miner
    print("\n[STEP 2] Running miner...")
    miner_script = Path('tools/corpus/mine_ofc_candidates_v3.py')
    
    if not miner_script.exists():
        print(f"[ERROR] Miner script not found: {miner_script}")
        sys.exit(1)
    
    miner_args = [
        sys.executable,
        str(miner_script),
        '--limit_subtypes', str(args.limit_subtypes),
        '--max_per_subtype', str(args.max_per_subtype)
    ]
    
    if args.dry_run:
        miner_args.append('--dry_run')
    
    result = subprocess.run(
        miner_args,
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"[ERROR] Miner failed:")
        print(result.stderr)
        sys.exit(1)
    
    print(result.stdout)
    
    print("\n" + "=" * 60)
    print("Pipeline complete!")
    print("=" * 60)

if __name__ == '__main__':
    main()
