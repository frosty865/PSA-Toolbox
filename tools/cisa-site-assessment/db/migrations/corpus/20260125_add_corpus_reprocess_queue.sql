-- CORPUS: Reprocess queue for 0-chunk corpus_documents
-- Date: 2026-01-25
-- TARGET: CORPUS database only.

CREATE TABLE IF NOT EXISTS public.corpus_reprocess_queue (
  corpus_document_id UUID PRIMARY KEY REFERENCES public.corpus_documents(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ NULL,
  last_attempt_error TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_corpus_reprocess_queue_requested_at
  ON public.corpus_reprocess_queue (requested_at DESC);
