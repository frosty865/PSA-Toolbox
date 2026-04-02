#!/usr/bin/env python3
"""
Classify verification relevance for source statements.

Sets verification_relevance = 'context' if statement lacks physical security
keywords, otherwise leaves as 'verifiable'.

Only modifies rows where review_status = 'unreviewed'.
"""

import os
import sys
import psycopg2
from psycopg2.extras import execute_values

# Load environment variables from .env.local
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

# Physical component keywords
PHYSICAL_KEYWORDS = [
    'camera', 'door', 'gate', 'lock', 'reader', 'panel', 'sensor',
    'alarm', 'fence', 'barrier', 'bollard'
]

# System action verbs
ACTION_VERBS = [
    'monitor', 'record', 'detect', 'control', 'restrict', 'alert',
    'authenticate', 'authorize'
]

# Condition verbs
CONDITION_VERBS = [
    'installed', 'operational', 'functional', 'configured', 'enabled',
    'disabled', 'missing', 'lacks'
]

ALL_KEYWORDS = PHYSICAL_KEYWORDS + ACTION_VERBS + CONDITION_VERBS


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


def contains_keyword(text, keywords):
    """Check if text contains any keyword (case-insensitive)."""
    if not text:
        return False
    text_lower = text.lower()
    return any(keyword.lower() in text_lower for keyword in keywords)


def classify_statement(raw_text):
    """
    Classify statement as 'context' or 'verifiable'.
    
    Returns 'context' if statement lacks all keyword categories,
    otherwise 'verifiable'.
    """
    if not raw_text:
        return 'context'
    
    has_physical = contains_keyword(raw_text, PHYSICAL_KEYWORDS)
    has_action = contains_keyword(raw_text, ACTION_VERBS)
    has_condition = contains_keyword(raw_text, CONDITION_VERBS)
    
    if not (has_physical or has_action or has_condition):
        return 'context'
    
    return 'verifiable'


def main():
    """Main classification function."""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Fetch all unreviewed statements
        cur.execute("""
            SELECT id, raw_text, verification_relevance
            FROM public.source_statements
            WHERE review_status = 'unreviewed'
        """)
        
        rows = cur.fetchall()
        updates = []
        
        for row_id, raw_text, current_relevance in rows:
            new_relevance = classify_statement(raw_text)
            if new_relevance != current_relevance:
                updates.append((new_relevance, row_id))
        
        # Batch update
        if updates:
            execute_values(
                cur,
                """
                UPDATE public.source_statements
                SET verification_relevance = data.new_relevance::text
                FROM (VALUES %s) AS data(new_relevance, id)
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
            SELECT verification_relevance, COUNT(*)
            FROM public.source_statements
            WHERE review_status = 'unreviewed'
            GROUP BY verification_relevance
        """)
        
        print("\nClassification results (unreviewed only):")
        for relevance, count in cur.fetchall():
            print(f"  {relevance}: {count}")
        
    except Exception as e:
        conn.rollback()
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    main()

