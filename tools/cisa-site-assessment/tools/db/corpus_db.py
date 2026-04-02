"""
CORPUS database connection for ingest and diagnostics.

Use for: source_registry, corpus_documents, document_chunks, ingestion_runs, etc.
Prefers CORPUS_DATABASE_URL; falls back to SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD.
"""

import os
import psycopg2
from urllib.parse import urlparse

from tools.db.dsn_sanitize import sanitize_psycopg2_dsn


def get_corpus_conn():
    """
    Get CORPUS database connection.

    Env (in order of precedence):
    - CORPUS_DATABASE_URL: use as-is
    - SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD: build postgres URL
          (tries pooler :6543, then direct :5432)
    """
    dsn = os.environ.get("CORPUS_DATABASE_URL")
    if dsn:
        dsn = sanitize_psycopg2_dsn(dsn)
        return psycopg2.connect(dsn)

    corpus_url = os.environ.get("SUPABASE_CORPUS_URL")
    corpus_password = os.environ.get("SUPABASE_CORPUS_DB_PASSWORD")
    if not corpus_url or not corpus_password:
        raise RuntimeError(
            "Missing: set CORPUS_DATABASE_URL, or SUPABASE_CORPUS_URL and SUPABASE_CORPUS_DB_PASSWORD"
        )

    clean_password = corpus_password.strip().strip('"').strip("'").replace("\\", "")
    url = urlparse(corpus_url)
    project_ref = url.hostname.split(".")[0]
    connection_string = (
        f"postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require"
    )

    try:
        return psycopg2.connect(connection_string)
    except psycopg2.OperationalError:
        connection_string = (
            f"postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require"
        )
        return psycopg2.connect(connection_string)
