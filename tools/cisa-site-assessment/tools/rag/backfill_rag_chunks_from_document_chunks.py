#!/usr/bin/env python3
"""
Backfill rag_chunks from existing document_chunks + corpus_documents.
Run from psa_rebuild root with CORPUS_DATABASE_URL (or CORPUS_DB_URL), OLLAMA_HOST, RAG_EMBED_MODEL.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any, Dict

# psa_rebuild root on path
_psa_root = Path(__file__).resolve().parent.parent.parent
if str(_psa_root) not in sys.path:
    sys.path.insert(0, str(_psa_root))

# Load .env
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
from services.rag.emit_chunk_to_rag_store import emit_chunk_to_rag_store


def main() -> int:
    db_url = os.getenv("CORPUS_DATABASE_URL") or os.getenv("CORPUS_DB_URL") or os.getenv("DATABASE_URL")
    if not db_url:
        print("Missing CORPUS_DATABASE_URL / CORPUS_DB_URL (preferred) or DATABASE_URL.", file=sys.stderr)
        return 2

    limit = int(os.getenv("RAG_BACKFILL_LIMIT", "500000"))

    conn = get_corpus_conn()
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            # document_chunks.document_id = corpus_documents.id; include document_role for Technology Library tag
            cur.execute(
                """
                SELECT
                  dc.chunk_id,
                  dc.chunk_text,
                  COALESCE(dc.locator, dc.page_number::text, '') AS page_range,
                  COALESCE(cd.citation_short, cd.citation_full, cd.inferred_title, cd.file_stem, cd.original_filename, 'document') AS source_file,
                  cd.document_role
                FROM public.document_chunks dc
                JOIN public.corpus_documents cd ON cd.id = dc.document_id
                WHERE NOT EXISTS (
                  SELECT 1 FROM public.rag_chunks rc WHERE rc.chunk_id = dc.chunk_id::text
                )
                ORDER BY dc.chunk_id
                LIMIT %s
                """,
                (limit,),
            )
            rows = cur.fetchall()
            print(f"[RAG] backfill candidates: {len(rows)}")

            n_ok = 0
            n_fail = 0

            for row in rows:
                chunk_id = row[0]
                chunk_text = row[1]
                page_range = row[2]
                source_file = row[3]
                document_role = row[4] if len(row) > 4 else None
                chunk_id_str = str(chunk_id)
                tags: Dict[str, Any] = {"source_type": "CORPUS"}
                if document_role == "TECHNOLOGY_LIBRARY":
                    tags["library"] = "technology"

                try:
                    emit_chunk_to_rag_store(
                        cur,
                        chunk_id=chunk_id_str,
                        chunk_text=chunk_text or "",
                        source_file=source_file,
                        page_range=page_range or "",
                        tags=tags,
                    )
                    n_ok += 1
                    if n_ok % 200 == 0:
                        conn.commit()
                        print(f"[RAG] committed {n_ok} emits...")
                except Exception as e:
                    n_fail += 1
                    print(f"[RAG][WARN] emit failed chunk_id={chunk_id_str}: {e}", file=sys.stderr)
                    conn.rollback()
                    conn.autocommit = False

            conn.commit()
            print(f"[RAG] done ok={n_ok} fail={n_fail}")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
