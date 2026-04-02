"""
RUNTIME database connection for ingest and diagnostics.

Use for: canonical_sources and other RUNTIME-only tables.
Requires: RUNTIME_DATABASE_URL
"""

import os
import psycopg2

from tools.db.dsn_sanitize import sanitize_psycopg2_dsn


def get_runtime_conn():
    """Get RUNTIME database connection. Requires RUNTIME_DATABASE_URL."""
    dsn = os.environ.get("RUNTIME_DATABASE_URL")
    if not dsn:
        raise RuntimeError("Missing env var: RUNTIME_DATABASE_URL")
    dsn = sanitize_psycopg2_dsn(dsn)
    return psycopg2.connect(dsn)
