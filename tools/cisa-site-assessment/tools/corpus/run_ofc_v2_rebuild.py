#!/usr/bin/env python3
"""
CORPUS: OFC V2 Rebuild Runner

Rebuilds OFC candidates using V2 extractor and re-links questions using semantic matching.

HARD RULE: Only operates on CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import require_active_source_set, get_corpus_db_connection
from tools.corpus.mine_all_ofc_candidates import mine_all_ofc_candidates
from tools.corpus.link_questions_to_ofcs_v2 import link_questions_to_ofcs_v2
from tools.corpus.export_question_buckets import export_question_buckets


def main():
    """Run OFC V2 rebuild process."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Rebuild OFC candidates with V2 extractor and semantic linkage')
    parser.add_argument('--source_set', default=None,
                       help='Source set to process (default: active source set)')
    parser.add_argument('--skip_mining', action='store_true',
                       help='Skip OFC mining (only re-link and export)')
    
    args = parser.parse_args()
    
    conn = get_corpus_db_connection()
    try:
        if args.source_set:
            source_set = args.source_set
        else:
            source_set = require_active_source_set(conn)
    finally:
        conn.close()
    
    print("=" * 80)
    print("OFC V2 REBUILD")
    print("=" * 80)
    print(f"Source set: {source_set}")
    print()
    
    # Step 1: Re-mine OFCs with V2 extractor
    if not args.skip_mining:
        print("Step 1: Re-mining OFC candidates with V2 extractor...")
        try:
            result = mine_all_ofc_candidates(authority_scope="BASELINE_AUTHORITY", max_candidates_per_doc=250)
            print(f"✅ OFC mining complete: {result['total_candidates']} candidates from {result['documents_processed']} documents")
        except Exception as e:
            print(f"❌ OFC mining failed: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            sys.exit(1)
        print()
    else:
        print("Step 1: Skipping OFC mining (--skip_mining)")
        print()
    
    # Step 2: Re-link questions to OFCs using semantic matching
    print("Step 2: Re-linking questions to OFCs using semantic matching...")
    try:
        link_questions_to_ofcs_v2(source_set, top_k=5, min_score=0.18)
        print("✅ Semantic linkage complete")
    except Exception as e:
        print(f"❌ Linkage failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    print()
    
    # Step 3: Export buckets
    print("Step 3: Exporting question buckets...")
    try:
        export_question_buckets()
        print("✅ Export complete")
    except Exception as e:
        print(f"❌ Export failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    print()
    print("=" * 80)
    print("✅ OFC V2 REBUILD COMPLETE")
    print("=" * 80)
    print()
    print("Review exported files:")
    print("  - analytics/reports/promotable_questions.json")
    print("  - analytics/reports/baseline_revision_candidates.json")
    print("  - analytics/reports/context_only_questions.json")
    print()


if __name__ == '__main__':
    main()
