#!/usr/bin/env python3
"""
CORPUS: Export Question Buckets

Exports question candidates grouped by promotion bucket to JSON files for admin review.
No runtime writes - export only.

HARD RULE: Only reads from CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import get_corpus_db_connection


def export_question_buckets():
    """Export question candidates by promotion bucket to JSON files."""
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Check if strict columns exist
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'question_candidate_queue'
            AND column_name = 'promotion_bucket'
        """)
        has_bucket_column = cur.fetchone() is not None
        
        if not has_bucket_column:
            print("⚠️  promotion_bucket column not found. Run migration first.")
            return
        
        # Check if table uses candidate_id or id
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'question_candidate_queue'
            AND column_name IN ('candidate_id', 'id')
            ORDER BY column_name
            LIMIT 1
        """)
        id_col_row = cur.fetchone()
        id_column = id_col_row[0] if id_col_row else 'candidate_id'
        
        buckets = [
            ("PROMOTABLE", "analytics/reports/promotable_questions.json"),
            ("BASELINE_REVISION", "analytics/reports/baseline_revision_candidates.json"),
            ("CONTEXT_ONLY", "analytics/reports/context_only_questions.json"),
        ]
        
        for bucket, out_path in buckets:
            # Build SELECT with available columns
            cur.execute(f"""
                SELECT 
                    {id_column} as candidate_id, 
                    question_text, 
                    COALESCE(rewrite_text, '') as rewrite_text, 
                    COALESCE(locator, '') as locator, 
                    document_id,
                    COALESCE(methodology_type, 'UNKNOWN') as methodology_type, 
                    COALESCE(psa_scope_ok, true) as psa_scope_ok,
                    COALESCE(has_citable_ofc, false) as has_citable_ofc, 
                    COALESCE(linked_ofc_candidate_ids, ARRAY[]::UUID[]) as linked_ofc_candidate_ids,
                    promotion_bucket,
                    COALESCE(context, '') as context
                FROM question_candidate_queue
                WHERE promotion_bucket=%s
                ORDER BY document_id, locator
            """, (bucket,))
            
            rows = cur.fetchall()
            columns = [desc[0] for desc in cur.description]
            
            # Convert to list of dicts
            data = [dict(zip(columns, row)) for row in rows]
            
            # Ensure output directory exists
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            
            # Write JSON file
            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, default=str)
            
            print(f"✅ Exported {len(data)} questions to {out_path}")
        
        print("\n✅ Export complete.")
        
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        raise
    finally:
        cur.close()
        conn.close()


def main():
    """CLI entry point."""
    try:
        export_question_buckets()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
