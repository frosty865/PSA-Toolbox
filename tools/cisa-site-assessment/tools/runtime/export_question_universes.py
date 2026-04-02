#!/usr/bin/env python3
"""
RUNTIME: Export Question Universes

Exports both primary-36 and full-312 question universes from RUNTIME database.
Used for separate coverage analysis.

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


def export_question_universes():
    """Export primary-36 and full-312 question universes."""
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
            print("❌ Error: No baseline questions table found.")
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
        
        # Check for version column
        cur.execute(f"""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = '{table_name}'
            AND column_name = 'version'
        """)
        has_version = cur.fetchone() is not None
        
        # Check for is_active column
        cur.execute(f"""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = '{table_name}'
            AND column_name = 'is_active'
        """)
        has_is_active = cur.fetchone() is not None
        
        # Try to export primary-36 (if version column exists)
        primary = []
        if has_version:
            try:
                cur.execute(f"""
                    SELECT {code_column}, question_text
                    FROM {table_name}
                    WHERE version IN ('ALT_SAFE_BASELINE_V1', 'BASELINE_PRIMARY_V1', 'BASELINE_QUESTIONS_V1')
                    ORDER BY {code_column}
                    LIMIT 36
                """)
                rows = cur.fetchall()
                primary = [{"question_code": str(r[0]), "question_text": r[1]} for r in rows]
            except Exception:
                pass
        
        # If no primary found, try to get first 36 by some ordering
        if not primary:
            try:
                cur.execute(f"""
                    SELECT {code_column}, question_text
                    FROM {table_name}
                    {'WHERE is_active = true' if has_is_active else ''}
                    ORDER BY {code_column}
                    LIMIT 36
                """)
                rows = cur.fetchall()
                primary = [{"question_code": str(r[0]), "question_text": r[1]} for r in rows]
            except Exception:
                pass
        
        # Export full structured baseline set
        if has_is_active:
            cur.execute(f"""
                SELECT {code_column}, question_text
                FROM {table_name}
                WHERE is_active = true
                ORDER BY {code_column}
            """)
        else:
            cur.execute(f"""
                SELECT {code_column}, question_text
                FROM {table_name}
                ORDER BY {code_column}
            """)
        
        full = [{"question_code": str(r[0]), "question_text": r[1]} for r in cur.fetchall()]
        
        # Ensure output directory exists
        os.makedirs("analytics/runtime", exist_ok=True)
        
        # Write JSON files
        primary_path = "analytics/runtime/baseline_primary_36.json"
        full_path = "analytics/runtime/baseline_full_312.json"
        
        with open(primary_path, "w", encoding="utf-8") as f:
            json.dump(primary, f, indent=2)
        
        with open(full_path, "w", encoding="utf-8") as f:
            json.dump(full, f, indent=2)
        
        print(f"✅ Exported primary (<=36): {len(primary)} questions to {primary_path}")
        print(f"✅ Exported full: {len(full)} questions to {full_path}")
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
        export_question_universes()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
