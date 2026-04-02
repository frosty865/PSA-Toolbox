#!/usr/bin/env python3
"""
CORPUS: Rebuild CISA Mass Gathering OFC Candidates

Deletes existing CISA_MASS_GATHERING OFC candidates and re-mines them.

HARD RULE: Only writes to CORPUS database (yylslokiaovdythzrbgt)
"""

import sys
import json
import subprocess
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import (
    get_corpus_db_connection,
    require_active_source_set
)

SOURCE_SET = "CISA_MASS_GATHERING"

def main():
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Confirm active source set
        active_set = require_active_source_set(conn, expected=SOURCE_SET)
        print(f"✅ Active source set confirmed: {active_set}")
        print()
        
        # Delete existing CISA_MASS_GATHERING candidates
        print("Deleting existing CISA_MASS_GATHERING OFC candidates...")
        cur.execute("DELETE FROM public.ofc_candidate_queue WHERE source_set=%s", (SOURCE_SET,))
        deleted = cur.rowcount
        print(f"  Deleted {deleted} candidates")
        conn.commit()
        print()
        
        # Re-run OFC candidate mining
        print("Re-running OFC candidate mining...")
        result = subprocess.run(
            [sys.executable, "tools/corpus/mine_all_ofc_candidates.py"],
            capture_output=True,
            text=True,
            cwd=str(Path(__file__).parent.parent.parent)
        )
        
        print(result.stdout)
        if result.returncode != 0:
            print(result.stderr, file=sys.stderr)
            raise SystemExit(result.returncode)
        
        print()
        
        # Get final counts
        cur.execute("SELECT COUNT(*) FROM public.ofc_candidate_queue WHERE source_set=%s", (SOURCE_SET,))
        total = cur.fetchone()[0]
        
        cur.execute("""
            SELECT COUNT(DISTINCT document_id || '|' || COALESCE(locator_type, 'NULL') || '|' || COALESCE(locator, 'NULL') || '|' || COALESCE(candidate_hash, 'NULL'))
            FROM public.ofc_candidate_queue WHERE source_set=%s
        """, (SOURCE_SET,))
        distinct = cur.fetchone()[0]
        
        result = {
            "source_set": SOURCE_SET,
            "deleted_prior_rows": deleted,
            "ofc_rows_after_rebuild": total,
            "distinct_doc_locator_hash": distinct
        }
        
        print("=" * 80)
        print("REBUILD SUMMARY")
        print("=" * 80)
        print(json.dumps(result, indent=2))
        
        if total == distinct:
            print()
            print("✅ All candidates are unique (no duplicates)")
        else:
            print()
            print(f"⚠️  Warning: {total - distinct} duplicate candidates detected")
        
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()

