"""
Runtime Baseline Selector

Selects baseline questions for new assessments.
Enforces canon baseline usage when available.
"""

import os
import sys
import re
from pathlib import Path
from typing import List, Dict, Optional, Any
import psycopg2

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from app.db.db_router import guard_write
from app.importers.baseline_canon_mapping_lock import load_lock


def load_env_file(filepath: str):
    """Load environment variables from .env.local file."""
    if not os.path.exists(filepath):
        return
    
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip().strip('"').strip("'")


def get_db_connection():
    """Get RUNTIME database connection."""
    load_env_file('.env.local')
    
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found in environment')
    
    if 'supabase' in database_url:
        if '?sslmode=' not in database_url:
            database_url += '?sslmode=require'
    
    return psycopg2.connect(database_url)


def get_mapping_from_lock_or_detect(conn) -> Dict[str, Any]:
    """
    Get mapping from lock file if available, otherwise detect from schema.
    
    Returns:
        Mapping dictionary with table and column names
    """
    # Try lock first
    lock_doc = load_lock()
    if lock_doc:
        return lock_doc['mapping']
    
    # Fallback: detect from schema (same logic as mapper)
    from app.importers.baseline_canon_mapper import probe_question_tables, detect_question_text_column, detect_code_column
    
    tables = probe_question_tables(conn)
    
    # Try baseline_questions table first
    baseline_table = None
    for table in tables:
        if 'baseline' in table['name'].lower() and 'question' in table['name'].lower():
            baseline_table = table
            break
    
    if baseline_table:
        text_col = detect_question_text_column(baseline_table['columns'])
        code_col = detect_code_column(baseline_table['columns'])
        
        if text_col and code_col:
            return {
                'pattern': 'BASELINE_QUESTIONS',
                'table': baseline_table['name'],
                'columns': {
                    'code': code_col,
                    'text': text_col
                }
            }
    
    # Try single questions table
    for table in tables:
        text_col = detect_question_text_column(table['columns'])
        code_col = detect_code_column(table['columns'])
        
        if text_col and code_col:
            return {
                'pattern': 'SINGLE_QUESTIONS_TABLE',
                'table': table['name'],
                'columns': {
                    'code': code_col,
                    'text': text_col
                }
            }
    
    raise RuntimeError("Cannot detect question table mapping. Run import_baseline_canon to create lock.")


def canon_baseline_present(conn, mapping: Optional[Dict] = None) -> bool:
    """
    Check if canon baseline questions are present in the database.
    
    Args:
        conn: Database connection
        mapping: Optional pre-resolved mapping (to avoid re-detection)
        
    Returns:
        True if at least N canon questions found (N=10 as threshold)
    """
    if mapping is None:
        mapping = get_mapping_from_lock_or_detect(conn)
    
    table = mapping['table']
    code_col = mapping['columns']['code']
    
    cur = conn.cursor()
    try:
        # Check for canon IDs: patterns like VSS-1, ACS-1, CPTED-1, etc.
        # (3-5 letter prefix, dash, number)
        canon_pattern = r'^[A-Z]{3,5}-\d+$'
        
        # Count questions matching canon ID pattern
        cur.execute(f"""
            SELECT COUNT(*)
            FROM {table}
            WHERE {code_col} ~ %s
        """, (canon_pattern,))
        
        count = cur.fetchone()[0]
        
        # Threshold: at least 10 canon questions
        return count >= 10
        
    finally:
        cur.close()


def fetch_canon_baseline_questions(conn, mapping: Optional[Dict] = None) -> List[Dict[str, Any]]:
    """
    Fetch canon baseline questions from database.
    Excludes deprecated questions.
    
    Args:
        conn: Database connection
        mapping: Optional pre-resolved mapping
        
    Returns:
        List of question dictionaries with code and text
    """
    if mapping is None:
        mapping = get_mapping_from_lock_or_detect(conn)
    
    table = mapping['table']
    code_col = mapping['columns']['code']
    text_col = mapping['columns']['text']
    
    # Check for deprecated flag
    has_deprecated = False
    deprecated_col = None
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = %s
            AND (
                column_name ILIKE '%deprecated%' 
                OR column_name ILIKE '%is_active%'
                OR column_name ILIKE '%status%'
            )
            ORDER BY 
                CASE 
                    WHEN column_name ILIKE '%deprecated%' THEN 1
                    WHEN column_name ILIKE '%is_active%' THEN 2
                    WHEN column_name ILIKE '%status%' THEN 3
                END
            LIMIT 1
        """, (table,))
        row = cur.fetchone()
        if row:
            deprecated_col = row[0]
            has_deprecated = True
    finally:
        cur.close()
    
    cur = conn.cursor()
    try:
        # Canon ID pattern: 3-5 letter prefix, dash, number (e.g., PER-1, ACS-1, CPTED-1)
        canon_pattern = r'^[A-Z]{3,5}-\d+$'
        
        # Build query
        where_clause = f"{code_col} ~ %s"
        params = [canon_pattern]
        
        # Exclude deprecated if column exists
        if has_deprecated and deprecated_col:
            if 'is_active' in deprecated_col.lower():
                # Boolean: exclude FALSE (inactive)
                where_clause += f" AND ({deprecated_col} IS NULL OR {deprecated_col} = TRUE)"
            elif 'deprecated' in deprecated_col.lower():
                # Boolean: exclude TRUE (deprecated)
                where_clause += f" AND ({deprecated_col} IS NULL OR {deprecated_col} = FALSE)"
            elif 'status' in deprecated_col.lower():
                # Text: exclude 'deprecated'
                where_clause += f" AND ({deprecated_col} IS NULL OR {deprecated_col} != 'deprecated')"
        
        query = f"""
            SELECT {code_col}, {text_col}
            FROM {table}
            WHERE {where_clause}
            ORDER BY {code_col}
        """
        
        cur.execute(query, params)
        
        questions = []
        for row in cur.fetchall():
            questions.append({
                'code': row[0],
                'text': row[1]
            })
        
        return questions
        
    finally:
        cur.close()


def fetch_legacy_baseline_questions(conn, mapping: Optional[Dict] = None) -> List[Dict[str, Any]]:
    """
    Fetch legacy baseline questions (BASE-### pattern).
    Should no longer be used for new assessments.
    
    Args:
        conn: Database connection
        mapping: Optional pre-resolved mapping
        
    Returns:
        List of question dictionaries
    """
    if mapping is None:
        mapping = get_mapping_from_lock_or_detect(conn)
    
    table = mapping['table']
    code_col = mapping['columns']['code']
    text_col = mapping['columns']['text']
    
    cur = conn.cursor()
    try:
        # Legacy pattern: BASE- followed by digits
        legacy_pattern = r'^BASE-\d+$'
        
        cur.execute(f"""
            SELECT {code_col}, {text_col}
            FROM {table}
            WHERE {code_col} ~ %s
            ORDER BY {code_col}
        """, (legacy_pattern,))
        
        questions = []
        for row in cur.fetchall():
            questions.append({
                'code': row[0],
                'text': row[1]
            })
        
        return questions
        
    finally:
        cur.close()


def select_baseline_questions(conn, mapping: Optional[Dict] = None) -> List[Dict[str, Any]]:
    """
    Select baseline questions for new assessments.
    
    Rules:
    - If canon baseline present: return canon questions only
    - Else: fail closed with clear error
    
    Args:
        conn: Database connection
        mapping: Optional pre-resolved mapping
        
    Returns:
        List of question dictionaries with code and text
        
    Raises:
        RuntimeError: If canon baseline not present
    """
    if mapping is None:
        mapping = get_mapping_from_lock_or_detect(conn)
    
    # Guard: must target RUNTIME
    guard_write("runtime")
    
    # Check if canon present
    if not canon_baseline_present(conn, mapping):
        raise RuntimeError(
            "Canon baseline not present in RUNTIME DB.\n"
            "Run import_baseline_canon --apply after reviewing plan.\n"
            "Expected canon questions with IDs matching pattern: ^[A-Z]{3,4}-\\d+$ (e.g., VSS-1, ACS-1)"
        )
    
    # Fetch and return canon questions
    return fetch_canon_baseline_questions(conn, mapping)
