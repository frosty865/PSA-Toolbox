"""
Database connection guard and validation.

This module provides functions to parse Supabase project references from connection
strings and validate that the configured database matches the intended target.
"""

import os
import re
from typing import Optional, Dict
from urllib.parse import urlparse

from app.db.db_targets import TARGETS, normalize_target, get_expected_ref


def parse_supabase_project_ref(conn_str: str) -> Optional[str]:
    """
    Parse Supabase project reference from a connection string or URL.
    
    Extracts the project reference from Supabase URLs or connection strings:
    - https://wivohgbuuwxoyfyzntsd.supabase.co -> wivohgbuuwxoyfyzntsd
    - postgresql://...@db.wivohgbuuwxoyfyzntsd.supabase.co:5432/... -> wivohgbuuwxoyfyzntsd
    
    Args:
        conn_str: Connection string or URL
        
    Returns:
        Project reference string if found, None otherwise
    """
    if not conn_str:
        return None
    
    # Pattern to match Supabase project ref in hostname
    # Matches: db.{ref}.supabase.co or {ref}.supabase.co
    patterns = [
        r'@db\.([a-z0-9]+)\.supabase\.co',  # PostgreSQL connection string
        r'://db\.([a-z0-9]+)\.supabase\.co',  # Alternative connection string format
        r'://([a-z0-9]+)\.supabase\.co',  # HTTPS URL format
        r'([a-z0-9]+)\.supabase\.co',  # Bare hostname
    ]
    
    for pattern in patterns:
        match = re.search(pattern, conn_str, re.IGNORECASE)
        if match:
            ref = match.group(1).lower()
            # Validate ref format (alphanumeric, reasonable length)
            if ref and len(ref) >= 10 and ref.isalnum():
                return ref
    
    return None


def get_conn_str() -> str:
    """
    Get database connection string from environment variables.
    
    Checks in order:
    1. DATABASE_URL (legacy, has password)
    2. SUPABASE_URL (if stack uses SUPABASE_URL only)
    
    Returns:
        Connection string
        
    Raises:
        RuntimeError: If no connection string is found
    """
    conn_str = os.getenv('DATABASE_URL')
    
    if not conn_str:
        conn_str = os.getenv('SUPABASE_URL')
    
    if not conn_str:
        raise RuntimeError(
            "No database connection string found. "
            "Set either DATABASE_URL or SUPABASE_URL environment variable."
        )
    
    return conn_str


def sanitize_conn_str(conn_str: str) -> str:
    """
    Sanitize connection string for safe printing (removes passwords/keys).
    
    Args:
        conn_str: Connection string to sanitize
        
    Returns:
        Sanitized connection string with credentials removed
    """
    if not conn_str:
        return ""
    
    # Remove password from postgresql:// URLs
    # postgresql://user:password@host:port/db -> postgresql://user:***@host:port/db
    sanitized = re.sub(
        r'://([^:]+):([^@]+)@',
        r'://\1:***@',
        conn_str
    )
    
    # Extract just host and database for display
    try:
        parsed = urlparse(sanitized)
        if parsed.hostname:
            # Show hostname and database name only
            db_name = parsed.path.lstrip('/') if parsed.path else 'postgres'
            return f"{parsed.hostname}:{parsed.port or 'default'}/{db_name}"
    except Exception:
        pass
    
    # Fallback: return sanitized string
    return sanitized


def require_db_target(target: str) -> Dict[str, str]:
    """
    Require that the configured database matches the intended target.
    
    This function:
    1. Normalizes the target
    2. Gets the connection string from environment
    3. Parses the project reference from the connection string
    4. Validates that the parsed ref matches the expected ref for the target
    5. Raises RuntimeError if there's a mismatch
    
    Args:
        target: Target database ("runtime" or "corpus")
        
    Returns:
        Dictionary with target, expected_ref, and actual_ref
        
    Raises:
        RuntimeError: If connection string cannot be parsed or refs don't match
        ValueError: If target is invalid
    """
    # Normalize target
    normalized_target = normalize_target(target)
    expected_ref = get_expected_ref(normalized_target)
    
    # Get connection string
    conn_str = get_conn_str()
    
    # Parse project reference
    actual_ref = parse_supabase_project_ref(conn_str)
    
    if actual_ref is None:
        sanitized = sanitize_conn_str(conn_str)
        raise RuntimeError(
            f"Cannot parse Supabase project reference from connection string; refusing to write.\n"
            f"Connection string (sanitized): {sanitized}\n"
            f"Expected format: postgresql://...@db.{{ref}}.supabase.co:port/db or https://{{ref}}.supabase.co"
        )
    
    # Validate match
    if actual_ref != expected_ref:
        sanitized = sanitize_conn_str(conn_str)
        raise RuntimeError(
            f"Database target mismatch detected!\n"
            f"  Requested target: {normalized_target}\n"
            f"  Expected project ref: {expected_ref}\n"
            f"  Actual project ref: {actual_ref}\n"
            f"  Connection string (sanitized): {sanitized}\n"
            f"\n"
            f"This is a safety guard to prevent writing to the wrong database.\n"
            f"To fix: Update DATABASE_URL or SUPABASE_URL to point to the correct project."
        )
    
    return {
        "target": normalized_target,
        "expected_ref": expected_ref,
        "actual_ref": actual_ref
    }
