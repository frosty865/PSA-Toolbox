"""
Database targeting and guard system.

This package provides deterministic database targeting between two Supabase projects:
- RUNTIME (wivohgbuuwxoyfyzntsd)
- CORPUS (yylslokiaovdythzrbgt)

All writer tools must use the guard system to ensure they write to the correct database.
"""

from app.db.db_targets import TARGETS, normalize_target, get_expected_ref, is_valid_target
from app.db.db_guard import (
    parse_supabase_project_ref,
    get_conn_str,
    sanitize_conn_str,
    require_db_target
)
from app.db.db_router import (
    resolve_target_from_env,
    require_target_from_cli_or_env,
    guard_write
)

__all__ = [
    'TARGETS',
    'normalize_target',
    'get_expected_ref',
    'is_valid_target',
    'parse_supabase_project_ref',
    'get_conn_str',
    'sanitize_conn_str',
    'require_db_target',
    'resolve_target_from_env',
    'require_target_from_cli_or_env',
    'guard_write',
]
