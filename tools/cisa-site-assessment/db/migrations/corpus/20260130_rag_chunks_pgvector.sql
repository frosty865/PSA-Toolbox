-- CORPUS: RAG vector store (pgvector)
-- Date: 2026-01-30
-- Purpose: Single shared vector store for RAG pipeline (retrieve → context pack → structured comprehension).
-- See docs/rag/VECTOR_SCHEMA_V1.md and docs/rag/INGEST_PIPELINE_V1.md.
--
-- TARGET: CORPUS database only.
-- Requires: pgvector extension (install with: CREATE EXTENSION IF NOT EXISTS vector;)
--
-- Embedding dimension: 768 (nomic-embed-text). Lock model; do not change mid-run or vectors are incompatible.

-- ============================================================================
-- 1. Enable pgvector
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 2. Create rag_chunks table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rag_chunks (
  chunk_id TEXT PRIMARY KEY,
  source_file TEXT NOT NULL,
  page_range TEXT,
  chunk_text TEXT NOT NULL,
  embedding vector(768) NOT NULL,
  content_hash TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent accidental duplicates if chunk_id strategy changes later
CREATE UNIQUE INDEX IF NOT EXISTS rag_chunks_chunk_id_uq ON public.rag_chunks(chunk_id);

COMMENT ON TABLE public.rag_chunks IS
'Local RAG vector store. Keep the embedding model fixed for the life of the store.';

COMMENT ON COLUMN public.rag_chunks.chunk_id IS
'Stable unique id (e.g. document_chunks.chunk_id). Same id = upsert overwrites.';

COMMENT ON COLUMN public.rag_chunks.source_file IS
'Display name for citation (e.g. inferred_title, file_stem, or original_filename from corpus_documents).';

COMMENT ON COLUMN public.rag_chunks.page_range IS
'Page locator string (e.g. "5" or "5-6"). For non-PDF, use locator or chunk index.';

COMMENT ON COLUMN public.rag_chunks.tags IS
'Filters for retrieval: source_type (CORPUS|MODULE_RESEARCH), module_domain (EV_PARKING|EV_CHARGING|null), standard_class (PHYSICAL_SECURITY_MEASURES|PHYSICAL_SECURITY_PLAN|null), doc_id/sha256 optional.';

COMMENT ON COLUMN public.rag_chunks.embedding IS
'Vector from embed(chunk_text). Dimension 768 = nomic-embed-text. Do not change model mid-run.';

-- ============================================================================
-- 3. Indexes
-- ============================================================================

-- ivfflat cosine; run ANALYZE public.rag_chunks after bulk load for good recall
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_ivfflat ON public.rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Optional: if you have many chunks, consider HNSW for lower latency:
-- CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_hnsw
--   ON public.rag_chunks USING hnsw (embedding vector_cosine_ops);

-- Tags filter (GIN for jsonb)
CREATE INDEX IF NOT EXISTS rag_chunks_tags_gin ON public.rag_chunks USING GIN (tags);

-- ============================================================================
-- 4. updated_at trigger
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_rag_chunks_set_updated_at ON public.rag_chunks;
    CREATE TRIGGER trg_rag_chunks_set_updated_at
      BEFORE UPDATE ON public.rag_chunks
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
