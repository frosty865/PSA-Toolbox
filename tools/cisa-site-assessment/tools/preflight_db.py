#!/usr/bin/env python3
"""
Database preflight tool.

Validates that the configured database connection matches the intended target
before running any write operations.

Usage:
    python tools/preflight_db.py --target runtime
    python tools/preflight_db.py --target corpus
    python tools/preflight_db.py --target runtime --show
"""

import argparse
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.db.db_router import require_target_from_cli_or_env, guard_write
from app.db.db_guard import get_conn_str, sanitize_conn_str, parse_supabase_project_ref
from app.db.db_targets import get_expected_ref


def main():
    parser = argparse.ArgumentParser(
        description="Preflight database connection to validate target matching",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python tools/preflight_db.py --target runtime
  python tools/preflight_db.py --target corpus --show
  PSA_DB_TARGET=runtime python tools/preflight_db.py
        """
    )
    
    parser.add_argument(
        '--target',
        type=str,
        choices=['runtime', 'corpus'],
        help='Target database (runtime or corpus). Can also be set via PSA_DB_TARGET env var.'
    )
    
    parser.add_argument(
        '--show',
        action='store_true',
        help='Show sanitized connection string details'
    )
    
    args = parser.parse_args()
    
    try:
        # Resolve target
        target = require_target_from_cli_or_env(args.target)
        expected_ref = get_expected_ref(target)
        
        # Get connection string
        conn_str = get_conn_str()
        actual_ref = parse_supabase_project_ref(conn_str)
        
        # Show details if requested
        if args.show:
            sanitized = sanitize_conn_str(conn_str)
            print(f"Connection string (sanitized): {sanitized}")
            print(f"Parsed project ref: {actual_ref}")
            print()
        
        # Print target info
        print(f"Target requested: {target}")
        print(f"Expected project ref: {expected_ref}")
        print(f"Actual project ref: {actual_ref}")
        print()
        
        # Guard write (validates match)
        guard_write(target)
        
        # Success
        print("✅ PASS: Database target matches connection string")
        sys.exit(0)
        
    except ValueError as e:
        print(f"❌ FAIL: Invalid target", file=sys.stderr)
        print(str(e), file=sys.stderr)
        sys.exit(2)
    except RuntimeError as e:
        print(f"❌ FAIL: Database target mismatch", file=sys.stderr)
        print(str(e), file=sys.stderr)
        sys.exit(2)
    except Exception as e:
        print(f"❌ FAIL: Unexpected error", file=sys.stderr)
        print(str(e), file=sys.stderr)
        sys.exit(2)


if __name__ == '__main__':
    main()
