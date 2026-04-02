#!/usr/bin/env python3
"""
DB preflight: verify CORPUS and RUNTIME connections and required tables.

Requires: CORPUS_DATABASE_URL (or SUPABASE_CORPUS_*), RUNTIME_DATABASE_URL.
Run from psa_rebuild: python tools/diagnostics/db_preflight.py
"""

import os
import sys
from pathlib import Path

# Add project root for tools.db imports
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from tools.db.corpus_db import get_corpus_conn
from tools.db.runtime_db import get_runtime_conn


def _load_env():
    cwd = os.getcwd()
    parent = os.path.dirname(cwd)
    for p in [".local.env", ".env.local", os.path.join(parent, ".local.env"), os.path.join(parent, ".env.local")]:
        if p and os.path.exists(p):
            with open(p, "r") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k, v = k.strip(), v.strip().strip('"').strip("'")
                        if v and not os.environ.get(k):
                            os.environ[k] = v
            break


def main():
    _load_env()
    c = get_corpus_conn()
    r = get_runtime_conn()
    try:
        with c.cursor() as cur:
            cur.execute("SELECT current_user AS u, current_database() AS db")
            print("[CORPUS]", cur.fetchone())
            cur.execute("SELECT 1 FROM source_registry LIMIT 1")
            print("[CORPUS] source_registry OK")
            cur.execute("SELECT 1 FROM corpus_documents LIMIT 1")
            print("[CORPUS] corpus_documents OK")
            cur.execute("SELECT 1 FROM document_chunks LIMIT 1")
            print("[CORPUS] document_chunks OK")

        with r.cursor() as cur:
            cur.execute("SELECT current_user AS u, current_database() AS db")
            print("[RUNTIME]", cur.fetchone())
            cur.execute("SELECT 1 FROM canonical_sources LIMIT 1")
            print("[RUNTIME] canonical_sources OK")

        print("DB preflight OK")
    finally:
        try:
            c.close()
        except Exception:
            pass
        try:
            r.close()
        except Exception:
            pass


if __name__ == "__main__":
    main()
