"""
Baseline Canon Mapper

Maps canonical baseline spines to RUNTIME database schema.
Auto-detects schema pattern and resolves mapping.
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Any
import psycopg2

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from app.db.db_router import guard_write
from app.importers.baseline_canon_mapping_lock import (
    load_lock,
    assert_lock_matches
)


def load_env_file(filepath: str):
    """Load environment variables from .env.local file."""
    if not os.path.exists(filepath):
        return
    
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()


def get_db_connection():
    """Get database connection from DATABASE_URL."""
    load_env_file('.env.local')
    
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found in environment')
    
    if 'supabase' in database_url:
        if '?sslmode=' not in database_url:
            database_url += '?sslmode=require'
    
    return psycopg2.connect(database_url)


def load_canon_spines(canon_path: Path) -> List[Dict]:
    """
    Load baseline canon spines from JSON file.
    
    Expected structure:
    - List of question objects, OR
    - Dict with 'spines' or 'questions' key containing list
    
    Each question should have:
    - canon_id (or code, question_code, element_code)
    - text (or question_text, prompt)
    - discipline_code (optional)
    - subtype_code (optional)
    - response_enum (optional, defaults to ["YES", "NO", "N_A"])
    """
    if not canon_path.exists():
        raise FileNotFoundError(f"Canon file not found: {canon_path}")
    
    with open(canon_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Handle different JSON structures
    questions = None
    if isinstance(data, list):
        questions = data
    elif isinstance(data, dict):
        if 'items' in data:
            questions = data['items']
        elif 'spines' in data:
            questions = data['spines']
        elif 'questions' in data:
            questions = data['questions']
        elif 'required_elements' in data:
            questions = data['required_elements']
        else:
            raise ValueError(f"Unexpected JSON structure in {canon_path}. Expected 'items', 'spines', 'questions', or 'required_elements' key.")
    else:
        raise ValueError(f"Invalid JSON format in {canon_path}. Expected array or object.")
    
    # Normalize question structure
    normalized = []
    for q in questions:
        norm_q = {}
        
        # Normalize canon_id (try multiple field names)
        norm_q['canon_id'] = q.get('canon_id') or q.get('code') or q.get('question_code') or q.get('element_code') or q.get('element_id')
        
        # Normalize text (try multiple field names)
        norm_q['text'] = q.get('text') or q.get('question') or q.get('question_text') or q.get('prompt')
        
        # Optional fields
        norm_q['discipline_code'] = q.get('discipline_code') or q.get('discipline_subtype_code')
        norm_q['subtype_code'] = q.get('subtype_code')
        norm_q['response_enum'] = q.get('response_enum', ["YES", "NO", "N_A"])
        
        # Validate required fields
        if not norm_q['canon_id']:
            raise ValueError(f"Question missing canon_id/code: {q}")
        if not norm_q['text']:
            raise ValueError(f"Question missing text: {norm_q['canon_id']}")
        
        normalized.append(norm_q)
    
    return normalized


def probe_question_tables(conn) -> List[Dict]:
    """Probe for question-related tables and their columns."""
    cur = conn.cursor()
    
    try:
        # Find tables with 'question' in name
        cur.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name ILIKE '%question%'
            ORDER BY table_name
        """)
        
        tables = []
        for row in cur.fetchall():
            table_name = row[0]
            
            # Get columns
            cur.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s
                ORDER BY ordinal_position
            """, (table_name,))
            
            columns = [
                {
                    'name': col[0],
                    'type': col[1],
                    'nullable': col[2] == 'YES'
                }
                for col in cur.fetchall()
            ]
            
            tables.append({
                'name': table_name,
                'columns': columns
            })
        
        return tables
        
    finally:
        cur.close()


def detect_question_text_column(columns: List[Dict]) -> Optional[str]:
    """Detect question text column from column list."""
    candidates = []
    
    for col in columns:
        name_lower = col['name'].lower()
        if any(term in name_lower for term in ['question_text', 'question', 'prompt', 'text']):
            candidates.append(col['name'])
    
    # Prefer exact matches
    for col in columns:
        if col['name'].lower() in ['question_text', 'text', 'prompt']:
            return col['name']
    
    # Return first candidate
    return candidates[0] if candidates else None


def detect_code_column(columns: List[Dict]) -> Optional[str]:
    """Detect code/key column from column list."""
    candidates = []
    
    for col in columns:
        name_lower = col['name'].lower()
        if any(term in name_lower for term in ['code', 'key', 'canon_id', 'question_code', 'element_code']):
            candidates.append(col['name'])
    
    # Prefer exact matches
    for col in columns:
        if col['name'].lower() in ['code', 'question_code', 'element_code', 'canon_id']:
            return col['name']
    
    return candidates[0] if candidates else None


def detect_response_enum_column(columns: List[Dict]) -> Optional[str]:
    """Detect response_enum column from column list."""
    for col in columns:
        name_lower = col['name'].lower()
        if 'response' in name_lower and 'enum' in name_lower:
            return col['name']
        if name_lower == 'response_enum':
            return col['name']
    
    return None


def detect_discipline_columns(columns: List[Dict]) -> Dict[str, Optional[str]]:
    """Detect discipline and subtype code columns."""
    result = {
        'discipline_code': None,
        'subtype_code': None
    }
    
    for col in columns:
        name_lower = col['name'].lower()
        if 'discipline' in name_lower and 'code' in name_lower:
            result['discipline_code'] = col['name']
        elif 'subtype' in name_lower and 'code' in name_lower:
            result['subtype_code'] = col['name']
    
    return result


def resolve_mapping(
    schema_probe_path: Optional[Path] = None,
    use_live_schema: bool = True,
    prefer_lock: bool = True
) -> Dict[str, Any]:
    """
    Resolve mapping from canon spines to database schema.
    
    Args:
        schema_probe_path: Path to schema probe JSON (if not using live schema)
        use_live_schema: If True, query live schema; else use probe file
        prefer_lock: If True and lock exists, use lock; else auto-detect and validate against lock
        
    Returns:
        Mapping dictionary with table and column names
        
    Raises:
        RuntimeError: If no supported pattern is detected or lock mismatch
    """
    # Check for lock file
    lock_doc = load_lock()
    
    # If prefer_lock and lock exists, return lock mapping directly
    if prefer_lock and lock_doc:
        return lock_doc['mapping']
    
    # Auto-detect mapping
    if use_live_schema:
        # Guard write before connecting
        guard_write("runtime")
        
        conn = get_db_connection()
        try:
            tables = probe_question_tables(conn)
        finally:
            conn.close()
    else:
        if not schema_probe_path or not schema_probe_path.exists():
            raise FileNotFoundError(f"Schema probe file not found: {schema_probe_path}")
        
        with open(schema_probe_path, 'r', encoding='utf-8') as f:
            probe_data = json.load(f)
        
        tables = []
        for table_name in probe_data.get('question_tables', []):
            columns = probe_data['question_table_details'].get(table_name, [])
            tables.append({
                'name': table_name,
                'columns': columns
            })
    
    if not tables:
        raise RuntimeError(
            "No supported question table pattern detected.\n"
            "No tables with 'question' in name were found in the database."
        )
    
    # Try PATTERN B first: baseline_questions table
    baseline_table = None
    for table in tables:
        if 'baseline' in table['name'].lower() and 'question' in table['name'].lower():
            baseline_table = table
            break
    
    if baseline_table:
        text_col = detect_question_text_column(baseline_table['columns'])
        code_col = detect_code_column(baseline_table['columns'])
        response_enum_col = detect_response_enum_column(baseline_table['columns'])
        discipline_cols = detect_discipline_columns(baseline_table['columns'])
        
        if not text_col or not code_col:
            raise RuntimeError(
                f"Baseline question table '{baseline_table['name']}' found but missing required columns.\n"
                f"Required: text column and code column\n"
                f"Found columns: {[c['name'] for c in baseline_table['columns']]}"
            )
        
        auto_mapping = {
            'pattern': 'BASELINE_QUESTIONS',
            'table': baseline_table['name'],
            'columns': {
                'code': code_col,
                'text': text_col,
                'response_enum': response_enum_col,
                'discipline_code': discipline_cols['discipline_code'],
                'subtype_code': discipline_cols['subtype_code']
            },
            'fixed_values': {
                'response_enum': ["YES", "NO", "N_A"] if not response_enum_col else None
            }
        }
    else:
        # Try PATTERN A: single questions table
        auto_mapping = None
        for table in tables:
            text_col = detect_question_text_column(table['columns'])
            code_col = detect_code_column(table['columns'])
            
            if text_col and code_col:
                response_enum_col = detect_response_enum_column(table['columns'])
                discipline_cols = detect_discipline_columns(table['columns'])
                
                auto_mapping = {
                    'pattern': 'SINGLE_QUESTIONS_TABLE',
                    'table': table['name'],
                    'columns': {
                        'code': code_col,
                        'text': text_col,
                        'response_enum': response_enum_col,
                        'discipline_code': discipline_cols['discipline_code'],
                        'subtype_code': discipline_cols['subtype_code']
                    },
                    'fixed_values': {
                        'response_enum': ["YES", "NO", "N_A"] if not response_enum_col else None
                    }
                }
                break
        
        if not auto_mapping:
            # No pattern detected
            candidate_info = []
            for table in tables[:5]:
                candidate_info.append({
                    'table': table['name'],
                    'columns': [c['name'] for c in table['columns']]
                })
            
            raise RuntimeError(
                "No supported question table pattern detected.\n"
                "Top 5 candidate tables:\n" +
                "\n".join([
                    f"  - {c['table']}: {', '.join(c['columns'][:10])}"
                    for c in candidate_info
                ])
            )
    
    # If lock exists and we're not preferring it, validate against lock
    if lock_doc and not prefer_lock:
        assert_lock_matches(auto_mapping, lock_doc)
    
    return auto_mapping
