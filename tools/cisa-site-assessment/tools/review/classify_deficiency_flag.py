#!/usr/bin/env python3
"""
Classify deficiency flag for source statements.

Sets deficiency_flag = TRUE if statement contains deficiency keywords,
otherwise leaves as FALSE.

Only modifies rows where review_status = 'unreviewed'.
"""

import os
import sys
import psycopg2
from psycopg2.extras import execute_values

# Deficiency keywords
DEFICIENCY_KEYWORDS = [
    'missing',
    'lacks',
    'lacking',
    'not present',
    'not installed',
    'not configured',
    'not monitored',
    'insufficient',
    'inadequate',
    'limited',
    'blind spot',
    'failure',
    'unable to',
    'does not',
    'without'
]


def get_db_connection():
    """Get database connection from environment variables."""
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        return psycopg2.connect(database_url)
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'psa'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', '')
    )


def load_env_file(filepath):
    """Load environment variables from .env.local file."""
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()


# Load .env.local from project root
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.join(script_dir, '..', '..')
env_file = os.path.join(project_root, '.env.local')
if not os.path.exists(env_file):
    env_file = os.path.join(project_root, 'env.local')
load_env_file(env_file)


def contains_deficiency_keyword(text):
    """Check if text contains any deficiency keyword (case-insensitive)."""
    if not text:
        return False
    text_lower = text.lower()
    return any(keyword.lower() in text_lower for keyword in DEFICIENCY_KEYWORDS)


def classify_statement(raw_text):
    """
    Classify statement deficiency flag.
    
    Returns TRUE if statement contains deficiency keywords,
    otherwise FALSE.
    """
    if not raw_text:
        return False
    
    return contains_deficiency_keyword(raw_text)


def main():
    """Main classification function."""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Fetch all unreviewed statements
        cur.execute("""
            SELECT id, raw_text, deficiency_flag
            FROM public.source_statements
            WHERE review_status = 'unreviewed'
        """)
        
        rows = cur.fetchall()
        updates = []
        
        for row_id, raw_text, current_flag in rows:
            new_flag = classify_statement(raw_text)
            if new_flag != current_flag:
                updates.append((new_flag, row_id))
        
        # Batch update
        if updates:
            execute_values(
                cur,
                """
                UPDATE public.source_statements
                SET deficiency_flag = data.new_flag::boolean
                FROM (VALUES %s) AS data(new_flag, id)
                WHERE source_statements.id = data.id::uuid
                """,
                updates,
                template=None,
                page_size=1000
            )
            conn.commit()
            print(f"Updated {len(updates)} statements")
        else:
            print("No updates needed")
        
        # Report counts
        cur.execute("""
            SELECT deficiency_flag, COUNT(*)
            FROM public.source_statements
            WHERE review_status = 'unreviewed'
            GROUP BY deficiency_flag
        """)
        
        print("\nClassification results (unreviewed only):")
        for flag, count in cur.fetchall():
            print(f"  {flag}: {count}")
        
    except Exception as e:
        conn.rollback()
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    main()

