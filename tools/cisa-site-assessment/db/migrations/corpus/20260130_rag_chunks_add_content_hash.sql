-- CORPUS: Add content_hash to rag_chunks (for already-applied 20260130_rag_chunks_pgvector)
-- Run this if rag_chunks already exists without content_hash.
-- Idempotent: safe to run if column already exists.

-- 1. Add content_hash (nullable first for backfill)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rag_chunks' AND column_name = 'content_hash'
  ) THEN
    ALTER TABLE public.rag_chunks ADD COLUMN content_hash TEXT;
  END IF;
END $$;

-- 2. Backfill content_hash from chunk_text (sha256 hex via pgcrypto)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE public.rag_chunks
SET content_hash = encode(digest(chunk_text, 'sha256'), 'hex')
WHERE content_hash IS NULL AND chunk_text IS NOT NULL;

-- 3. Set NOT NULL (no-op if already not null)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rag_chunks' AND column_name = 'content_hash'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.rag_chunks ALTER COLUMN content_hash SET NOT NULL;
  END IF;
END $$;

-- 4. Unique index on chunk_id (defensive; PK already enforces uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS rag_chunks_chunk_id_uq ON public.rag_chunks(chunk_id);

COMMENT ON COLUMN public.rag_chunks.content_hash IS
'SHA256 hex of chunk_text; used to skip re-embed when unchanged.';
