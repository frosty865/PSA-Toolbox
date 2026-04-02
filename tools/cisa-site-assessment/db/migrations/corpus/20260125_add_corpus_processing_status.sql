-- CORPUS: Add processing status and chunk_count to corpus_documents
-- Date: 2026-01-25
-- Purpose: Track document processing status; forbid PROCESSED when chunk_count=0.
--
-- TARGET: CORPUS database only.
-- document_chunks.document_id references corpus_documents.id.

DO $$
BEGIN
  -- Add status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='corpus_documents' AND column_name='processing_status'
  ) THEN
    ALTER TABLE public.corpus_documents
      ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'REGISTERED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='corpus_documents' AND column_name='processed_at'
  ) THEN
    ALTER TABLE public.corpus_documents
      ADD COLUMN processed_at TIMESTAMPTZ NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='corpus_documents' AND column_name='chunk_count'
  ) THEN
    ALTER TABLE public.corpus_documents
      ADD COLUMN chunk_count INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='corpus_documents' AND column_name='last_error'
  ) THEN
    ALTER TABLE public.corpus_documents
      ADD COLUMN last_error TEXT NULL;
  END IF;
END $$;

-- Integrity: PROCESSED only when chunk_count > 0
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'corpus_documents_processed_requires_chunks'
  ) THEN
    ALTER TABLE public.corpus_documents
      ADD CONSTRAINT corpus_documents_processed_requires_chunks
      CHECK (
        processing_status <> 'PROCESSED'
        OR (chunk_count IS NOT NULL AND chunk_count > 0)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_corpus_documents_status_chunks
  ON public.corpus_documents (processing_status, chunk_count);

-- Backfill from document_chunks (document_id = corpus_documents.id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='document_chunks'
  ) THEN
    WITH counts AS (
      SELECT document_id, COUNT(*)::int AS cnt
      FROM public.document_chunks
      GROUP BY document_id
    )
    UPDATE public.corpus_documents d
      SET chunk_count = c.cnt,
          processing_status = 'PROCESSED',
          processed_at = COALESCE(d.processed_at, now()),
          last_error = NULL
    FROM counts c
    WHERE d.id = c.document_id
      AND c.cnt > 0;
  END IF;
END $$;

-- Mark 0-chunk docs as FAILED (truth).
-- Exclude rows where source_registry_id IS NULL so we do not violate
-- corpus_documents_require_source_registry_id_on_new (CHECK re-evaluated on UPDATE).
UPDATE public.corpus_documents
SET processing_status = 'FAILED',
    last_error = COALESCE(last_error, 'No chunks extracted'),
    processed_at = COALESCE(processed_at, now())
WHERE chunk_count = 0
  AND processing_status IN ('REGISTERED', 'PROCESSING', 'PROCESSED')
  AND source_registry_id IS NOT NULL;
