#!/usr/bin/env python3
"""
RUNTIME: Export Baseline Questions

Exports baseline questions from RUNTIME database to JSON for OFC matching.
This is read-only - we are NOT changing baseline questions.

HARD RULE: Only reads from RUNTIME database (wivohgbuuwxoyfyzntsd)
"""

import os
import sys
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.runtime.compose_assessment_universe import get_runtime_db_connection
import psycopg2


def export_baseline_questions():
    """Export baseline questions from RUNTIME database."""
    dsn = os.environ.get("RUNTIME_DB_DSN")
    if not dsn:
        # Try using the runtime connection helper
        try:
            conn = get_runtime_db_connection()
        except Exception as e:
            print(f"❌ Error: Could not connect to RUNTIME database. Set RUNTIME_DB_DSN or configure DATABASE_URL.")
            print(f"   Error: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        conn = psycopg2.connect(dsn)
    
    cur = conn.cursor()
    
    try:
        # Check which baseline questions table exists
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('baseline_questions', 'assessment_primary_questions')
            ORDER BY table_name
            LIMIT 1
        """)
        table_row = cur.fetchone()
        
        if not table_row:
            print("❌ Error: No baseline questions table found. Expected 'baseline_questions' or 'assessment_primary_questions'")
            sys.exit(1)
        
        table_name = table_row[0]
        
        # Try different column name variations
        cur.execute(f"""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = '{table_name}'
            AND column_name IN ('question_code', 'question_key', 'id')
            ORDER BY column_name
            LIMIT 1
        """)
        code_col_row = cur.fetchone()
        code_column = code_col_row[0] if code_col_row else 'question_code'
        
        # Check for is_active column
        cur.execute(f"""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = '{table_name}'
            AND column_name = 'is_active'
        """)
        has_is_active = cur.fetchone() is not None
        
        # Build query
        if has_is_active:
            query = f"""
                SELECT {code_column}, question_text
                FROM {table_name}
                WHERE is_active = true
                ORDER BY {code_column}
            """
        else:
            query = f"""
                SELECT {code_column}, question_text
                FROM {table_name}
                ORDER BY {code_column}
            """
        
        cur.execute(query)
        rows = cur.fetchall()
        
        # Convert to JSON format
        questions = [
            {"question_code": str(r[0]), "question_text": r[1]}
            for r in rows
        ]
        
        # Ensure output directory exists
        os.makedirs("analytics/runtime", exist_ok=True)
        
        # Write JSON file
        output_path = "analytics/runtime/baseline_questions.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(questions, f, indent=2)
        
        print(f"✅ Exported {len(questions)} baseline questions to {output_path}")
        print(f"   Table: {table_name}")
        print(f"   Code column: {code_column}")
        
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


def main():
    """CLI entry point."""
    try:
        export_baseline_questions()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
