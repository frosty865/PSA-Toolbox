#!/usr/bin/env python3
"""
CORPUS: Overlay Control Module

Manages active expansion overlays (sector/subsector/technology) for matching.

HARD RULE: Only reads/writes to CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict, List, Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import psycopg2
from urllib.parse import urlparse

ALLOWED_SCOPE_TYPES = {"SECTOR", "SUBSECTOR", "TECHNOLOGY"}
FORBIDDEN_TERMS = ["SAFE"]  # Case-insensitive

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

def get_corpus_db_connection():
    """Get CORPUS database connection."""
    load_env_file('.env.local')
    
    corpus_url = os.getenv('SUPABASE_CORPUS_URL')
    corpus_password = os.getenv('SUPABASE_CORPUS_DB_PASSWORD')
    
    if not corpus_url or not corpus_password:
        raise ValueError('SUPABASE_CORPUS_URL and SUPABASE_CORPUS_DB_PASSWORD must be set')
    
    url = urlparse(corpus_url)
    project_ref = url.hostname.split('.')[0]
    connection_string = f'postgresql://postgres:{corpus_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
    
    return psycopg2.connect(connection_string)

def forbid_deprecated_sources(value: str):
    """Raises RuntimeError if value contains forbidden terms."""
    for term in FORBIDDEN_TERMS:
        if term.lower() in value.lower():
            raise RuntimeError(f"Forbidden term '{term}' found in overlay code: '{value}'. Please use approved codes.")

def get_overlay_control(conn) -> Dict:
    """
    Get current overlay control state.
    
    Returns dict with:
    - active_sector_codes: list[str]
    - active_subsector_codes: list[str]
    - active_technology_codes: list[str]
    """
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT active_sector_codes, active_subsector_codes, active_technology_codes
            FROM public.corpus_overlay_control
            WHERE id = 1
            LIMIT 1
        """)
        
        row = cur.fetchone()
        if not row:
            # Should not happen due to seed, but handle gracefully
            return {
                'active_sector_codes': [],
                'active_subsector_codes': [],
                'active_technology_codes': []
            }
        
        return {
            'active_sector_codes': row[0] if row[0] else [],
            'active_subsector_codes': row[1] if row[1] else [],
            'active_technology_codes': row[2] if row[2] else []
        }
    finally:
        cur.close()

def set_overlay_control(
    conn,
    sector_codes: Optional[List[str]] = None,
    subsector_codes: Optional[List[str]] = None,
    technology_codes: Optional[List[str]] = None
) -> None:
    """
    Update overlay control. If a parameter is None, keeps existing value.
    """
    cur = conn.cursor()
    try:
        # Get current state
        current = get_overlay_control(conn)
        
        # Update only provided parameters
        new_sector = sector_codes if sector_codes is not None else current['active_sector_codes']
        new_subsector = subsector_codes if subsector_codes is not None else current['active_subsector_codes']
        new_technology = technology_codes if technology_codes is not None else current['active_technology_codes']
        
        # Validate codes (forbid SAFE, check existence if expansion_questions has data)
        all_codes = new_sector + new_subsector + new_technology
        for code in all_codes:
            forbid_deprecated_sources(code)
        
        # Validate against expansion_questions if table has data
        cur.execute("SELECT COUNT(*) FROM public.expansion_questions WHERE is_active = true")
        has_expansion_questions = cur.fetchone()[0] > 0
        
        if has_expansion_questions:
            # Check sector codes
            if new_sector:
                cur.execute("""
                    SELECT DISTINCT scope_code FROM public.expansion_questions
                    WHERE scope_type = 'SECTOR' AND scope_code = ANY(%s) AND is_active = true
                """, (new_sector,))
                found_sectors = {row[0] for row in cur.fetchall()}
                missing = set(new_sector) - found_sectors
                if missing:
                    print(f"⚠️  Warning: Sector codes not found in expansion_questions: {missing}", file=sys.stderr)
            
            # Check subsector codes
            if new_subsector:
                cur.execute("""
                    SELECT DISTINCT scope_code FROM public.expansion_questions
                    WHERE scope_type = 'SUBSECTOR' AND scope_code = ANY(%s) AND is_active = true
                """, (new_subsector,))
                found_subsectors = {row[0] for row in cur.fetchall()}
                missing = set(new_subsector) - found_subsectors
                if missing:
                    print(f"⚠️  Warning: Subsector codes not found in expansion_questions: {missing}", file=sys.stderr)
            
            # Check technology codes
            if new_technology:
                cur.execute("""
                    SELECT DISTINCT scope_code FROM public.expansion_questions
                    WHERE scope_type = 'TECHNOLOGY' AND scope_code = ANY(%s) AND is_active = true
                """, (new_technology,))
                found_tech = {row[0] for row in cur.fetchall()}
                missing = set(new_technology) - found_tech
                if missing:
                    print(f"⚠️  Warning: Technology codes not found in expansion_questions: {missing}", file=sys.stderr)
        
        # Upsert control row
        cur.execute("""
            INSERT INTO public.corpus_overlay_control (id, active_sector_codes, active_subsector_codes, active_technology_codes)
            VALUES (1, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                active_sector_codes = EXCLUDED.active_sector_codes,
                active_subsector_codes = EXCLUDED.active_subsector_codes,
                active_technology_codes = EXCLUDED.active_technology_codes,
                updated_at = now()
        """, (
            json.dumps(new_sector),
            json.dumps(new_subsector),
            json.dumps(new_technology)
        ))
        
        conn.commit()
    finally:
        cur.close()

def clear_overlay_control(conn) -> None:
    """Clear all overlay selections (set all to empty arrays)."""
    set_overlay_control(conn, sector_codes=[], subsector_codes=[], technology_codes=[])

def snapshot_overlay_control(conn) -> Dict:
    """
    Get snapshot of overlay control (same shape as get_overlay_control).
    Used for recording in match_runs.
    """
    return get_overlay_control(conn)

def validate_overlay_codes(conn, codes: List[str], scope_type: str) -> None:
    """
    Validate overlay codes exist in expansion_questions for the given scope_type.
    Warns if expansion_questions is empty but allows.
    Forbids any code containing 'SAFE'.
    """
    if scope_type not in ALLOWED_SCOPE_TYPES:
        raise ValueError(f"scope_type must be one of {ALLOWED_SCOPE_TYPES}, got '{scope_type}'")
    
    # Forbid SAFE
    for code in codes:
        forbid_deprecated_sources(code)
    
    # Check existence if expansion_questions has data
    cur = conn.cursor()
    try:
        cur.execute("SELECT COUNT(*) FROM public.expansion_questions WHERE is_active = true")
        has_data = cur.fetchone()[0] > 0
        
        if has_data and codes:
            cur.execute("""
                SELECT DISTINCT scope_code FROM public.expansion_questions
                WHERE scope_type = %s AND scope_code = ANY(%s) AND is_active = true
            """, (scope_type, codes))
            found = {row[0] for row in cur.fetchall()}
            missing = set(codes) - found
            if missing:
                raise ValueError(f"Codes not found in expansion_questions for {scope_type}: {missing}")
    finally:
        cur.close()

