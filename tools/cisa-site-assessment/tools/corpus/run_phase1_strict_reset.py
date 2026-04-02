#!/usr/bin/env python3
"""
CORPUS: Phase 1 Strict Autoextraction Reset Runner

Executes all Phase 1 steps in order:
1. Run migration to add strict classification columns
2. Link questions to OFCs (sets promotion buckets)
3. Export question buckets to JSON files

HARD RULE: Only operates on CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.run_migration import run_migration
from tools.corpus.link_questions_to_ofcs import link_questions_to_ofcs
from tools.corpus.export_question_buckets import export_question_buckets


def main():
    """Run Phase 1 strict autoextraction reset."""
    print("=" * 80)
    print("PHASE 1 — STRICT AUTOEXTRACTION RESET")
    print("=" * 80)
    print()
    
    # Step 1: Run migration
    print("Step 1: Running migration...")
    migration_path = Path(__file__).parent.parent.parent / "db" / "migrations" / "corpus" / "2026_01_14_strict_autoextraction.sql"
    if not migration_path.exists():
        print(f"❌ Migration file not found: {migration_path}")
        sys.exit(1)
    
    try:
        run_migration(str(migration_path))
        print("✅ Migration complete")
    except Exception as e:
        print(f"❌ Migration failed: {e}", file=sys.stderr)
        sys.exit(1)
    
    print()
    
    # Step 2: Link questions to OFCs
    print("Step 2: Linking questions to OFCs...")
    try:
        link_questions_to_ofcs()
        print("✅ Question-OFC linkage complete")
    except Exception as e:
        print(f"❌ Linkage failed: {e}", file=sys.stderr)
        sys.exit(1)
    
    print()
    
    # Step 3: Export buckets
    print("Step 3: Exporting question buckets...")
    try:
        export_question_buckets()
        print("✅ Export complete")
    except Exception as e:
        print(f"❌ Export failed: {e}", file=sys.stderr)
        sys.exit(1)
    
    print()
    print("=" * 80)
    print("✅ PHASE 1 RESET COMPLETE")
    print("=" * 80)
    print()
    print("Next steps:")
    print("  1. Review promotable_questions.json for admin review")
    print("  2. Review baseline_revision_candidates.json for manual baseline improvements")
    print("  3. Context-only questions are retained for learning corpus")
    print()


if __name__ == '__main__':
    main()
