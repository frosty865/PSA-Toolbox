#!/usr/bin/env python3
"""
Update existing rag_chunks.source_file from corpus_documents (citation_short, citation_full, inferred_title, etc.)
so citations show document name instead of hash/filename. Run from psa_rebuild root.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

_psa_root = Path(__file__).resolve().parent.parent.parent
if str(_psa_root) not in sys.path:
    sys.path.insert(0, str(_psa_root))

for env_file in (_psa_root / ".local.env", _psa_root / ".env.local"):
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        break

from tools.db.corpus_db import get_corpus_conn


def main() -> int:
    if not (os.getenv("CORPUS_DATABASE_URL") or os.getenv("CORPUS_DB_URL") or os.getenv("DATABASE_URL")):
        print("Missing CORPUS_DATABASE_URL / CORPUS_DB_URL or DATABASE_URL.", file=sys.stderr)
        return 2

    conn = get_corpus_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE public.rag_chunks r
                SET source_file = sub.source_file
                FROM (
                    SELECT dc.chunk_id::text AS chunk_id,
                           COALESCE(cd.citation_short, cd.citation_full, cd.inferred_title, cd.file_stem, cd.original_filename, 'document') AS source_file
                    FROM public.document_chunks dc
                    JOIN public.corpus_documents cd ON cd.id = dc.document_id
                ) sub
                WHERE r.chunk_id = sub.chunk_id
                  AND (r.source_file IS DISTINCT FROM sub.source_file)
                """
            )
            updated = cur.rowcount
        conn.commit()
        print(f"[RAG] Updated source_file for {updated} rag_chunks (document name in citations).")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
