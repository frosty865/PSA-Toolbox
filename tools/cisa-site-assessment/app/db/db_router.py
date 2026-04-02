"""
Database target routing and guard integration.

This module provides the primary interface for writer tools to:
1. Resolve target from CLI args or environment
2. Guard writes to ensure correct database targeting
"""

import os
import sys
from typing import Optional

from app.db.db_targets import normalize_target
from app.db.db_guard import require_db_target


def resolve_target_from_env(default: Optional[str] = "runtime") -> str:
    """
    Resolve target from environment variable PSA_DB_TARGET or use default.
    
    Args:
        default: Default target if PSA_DB_TARGET is not set (default: "runtime")
        
    Returns:
        Normalized target: "runtime" or "corpus"
        
    Raises:
        ValueError: If PSA_DB_TARGET is set to an invalid value
    """
    env_target = os.getenv('PSA_DB_TARGET')
    
    if env_target:
        return normalize_target(env_target)
    
    if default:
        return normalize_target(default)
    
    raise ValueError(
        "No target specified. Set PSA_DB_TARGET environment variable or provide --target argument."
    )


def require_target_from_cli_or_env(cli_target: Optional[str]) -> str:
    """
    Require target from CLI argument or environment variable.
    
    Priority:
    1. CLI argument (if provided)
    2. PSA_DB_TARGET environment variable
    3. Raise error if neither is set
    
    Args:
        cli_target: Target from CLI argument (can be None)
        
    Returns:
        Normalized target: "runtime" or "corpus"
        
    Raises:
        ValueError: If no target is provided and PSA_DB_TARGET is not set
    """
    if cli_target:
        return normalize_target(cli_target)
    
    return resolve_target_from_env(default=None)


def guard_write(target: str) -> None:
    """
    Guard write operations by validating database target matches connection string.
    
    This is the primary function that writer tools should call before any database writes.
    It validates that the configured database connection points to the correct Supabase
    project for the requested target.
    
    Args:
        target: Target database ("runtime" or "corpus")
        
    Raises:
        RuntimeError: If database target mismatch is detected
        ValueError: If target is invalid
    """
    try:
        result = require_db_target(target)
        # Success - target matches connection string
        return
    except RuntimeError as e:
        # Re-raise with clear error message
        print(f"ERROR: Database target guard failed", file=sys.stderr)
        print(str(e), file=sys.stderr)
        sys.exit(2)
    except ValueError as e:
        print(f"ERROR: Invalid target", file=sys.stderr)
        print(str(e), file=sys.stderr)
        sys.exit(2)
