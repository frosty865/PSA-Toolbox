#!/usr/bin/env python3
"""
CORPUS Source Set Control Module

Enforces explicit source_set control to prevent accidental cross-source matching.
"""

import os
import sys
from typing import Optional
import psycopg2
from urllib.parse import urlparse

# Allowed source sets
ALLOWED_SOURCE_SETS = {"VOFC_LIBRARY", "PILOT_DOCS", "CISA_MASS_GATHERING"}

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
    """Raise RuntimeError if value contains SAFE (case-insensitive)."""
    if 'SAFE' in value.upper():
        raise RuntimeError(
            f"FORBIDDEN: Source set value '{value}' contains 'SAFE'. "
            "SAFE references are not allowed in source_set identifiers."
        )

def get_active_source_set(conn) -> str:
    """
    Read active source set from control table.
    
    Raises RuntimeError if:
    - No row exists
    - Value not in ALLOWED_SOURCE_SETS
    - Value contains 'SAFE'
    
    Returns: active_source_set string
    """
    # Check env override first (env wins if set)
    env_override = os.getenv('CORPUS_ACTIVE_SOURCE_SET')
    if env_override:
        env_override = env_override.strip()
        forbid_deprecated_sources(env_override)
        if env_override not in ALLOWED_SOURCE_SETS:
            raise RuntimeError(
                f"Invalid CORPUS_ACTIVE_SOURCE_SET env var: '{env_override}'. "
                f"Must be one of: {ALLOWED_SOURCE_SETS}"
            )
        print(f"[Source Set] Using ENV override: {env_override}", file=sys.stderr)
        return env_override
    
    # Read from control table
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT active_source_set 
            FROM public.corpus_source_set_control 
            WHERE id = 1
        """)
        
        row = cur.fetchone()
        if not row:
            raise RuntimeError(
                "CORPUS source set control table is empty. "
                "Run migration 20260113_add_source_set_control.sql first."
            )
        
        active_set = row[0]
        
        # Validate
        forbid_deprecated_sources(active_set)
        
        if active_set not in ALLOWED_SOURCE_SETS:
            raise RuntimeError(
                f"Invalid active_source_set in control table: '{active_set}'. "
                f"Must be one of: {ALLOWED_SOURCE_SETS}. "
                "Update using: python tools/corpus/set_active_source_set.py <value>"
            )
        
        return active_set
        
    finally:
        cur.close()

def set_active_source_set(conn, value: str) -> None:
    """
    Update active source set in control table.
    
    Validates:
    - Value in ALLOWED_SOURCE_SETS
    - Value does not contain 'SAFE'
    
    Uses upsert pattern (updates row 1, or inserts if missing).
    """
    value = value.strip()
    
    # Validate
    forbid_deprecated_sources(value)
    
    if value not in ALLOWED_SOURCE_SETS:
        raise ValueError(
            f"Invalid source_set: '{value}'. "
            f"Must be one of: {ALLOWED_SOURCE_SETS}"
        )
    
    cur = conn.cursor()
    try:
        # Upsert: update if exists, insert if not
        cur.execute("""
            INSERT INTO public.corpus_source_set_control (id, active_source_set, updated_at)
            VALUES (1, %s, now())
            ON CONFLICT (id) 
            DO UPDATE SET 
                active_source_set = EXCLUDED.active_source_set,
                updated_at = now()
        """, (value,))
        
        conn.commit()
        
    finally:
        cur.close()

def require_active_source_set(conn, expected: Optional[str] = None) -> str:
    """
    Get active source set and optionally validate against expected value.
    
    Args:
        conn: Database connection
        expected: Optional expected value to validate against
    
    Returns:
        Active source set string
    
    Raises:
        RuntimeError if validation fails
    """
    active = get_active_source_set(conn)
    
    if expected is not None:
        expected = expected.strip()
        if active != expected:
            raise RuntimeError(
                f"Active source set mismatch: expected '{expected}', got '{active}'. "
                f"Update using: python tools/corpus/set_active_source_set.py {expected}"
            )
    
    return active

