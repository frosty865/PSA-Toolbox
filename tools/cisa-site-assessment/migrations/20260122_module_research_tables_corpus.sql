-- Module Research Layer Tables - CORPUS
-- 
-- Purpose: Link module sources to canonical corpus documents/chunks
-- These tables are in CORPUS because they reference corpus_documents and document_chunks
--
-- TARGET DB: CORPUS

BEGIN;

-- Verify corpus_documents table exists (required dependency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'corpus_documents'
  ) THEN
    RAISE EXCEPTION 'corpus_documents table does not exist. Run corpus schema migrations first.';
  END IF;
END $$;

-- Verify document_chunks table exists (required dependency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'document_chunks'
  ) THEN
    RAISE EXCEPTION 'document_chunks table does not exist. Run corpus schema migrations first.';
  END IF;
END $$;

-- Link module_sources (in RUNTIME) to canonical corpus_documents (in CORPUS)
-- NOTE: module_source_id references RUNTIME.module_sources.id (cross-database, no FK)
--       corpus_document_id references CORPUS.corpus_documents.id (same database, FK enforced)
CREATE TABLE IF NOT EXISTS public.module_source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_source_id UUID NOT NULL,
  -- FOREIGN KEY (module_source_id) REFERENCES <RUNTIME_DB>.public.module_sources(id) ON DELETE CASCADE,
  -- ^ Cannot enforce FK across databases - application code must ensure referential integrity
  corpus_document_id UUID NOT NULL REFERENCES public.corpus_documents(id) ON DELETE CASCADE,
  module_code TEXT NOT NULL,
  -- ^ Denormalized for fast filtering (references RUNTIME.assessment_modules.module_code)
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(module_source_id, corpus_document_id)
);

CREATE INDEX IF NOT EXISTS idx_module_source_documents_source
  ON public.module_source_documents(module_source_id);
CREATE INDEX IF NOT EXISTS idx_module_source_documents_doc
  ON public.module_source_documents(corpus_document_id);
CREATE INDEX IF NOT EXISTS idx_module_source_documents_module_code
  ON public.module_source_documents(module_code);

COMMENT ON TABLE public.module_source_documents IS
'Links module_sources (RUNTIME) to canonical corpus_documents (CORPUS) after ingestion. Many-to-many relationship. module_source_id references RUNTIME database (no FK).';

-- Link modules to document_chunks for fast retrieval/mining
-- NOTE: module_code references RUNTIME.assessment_modules.module_code (cross-database, no FK)
--       chunk_id references CORPUS.document_chunks.chunk_id (same database, FK enforced)
CREATE TABLE IF NOT EXISTS public.module_chunk_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code TEXT NOT NULL,
  -- FOREIGN KEY (module_code) REFERENCES <RUNTIME_DB>.public.assessment_modules(module_code) ON DELETE CASCADE,
  -- ^ Cannot enforce FK across databases - application code must ensure referential integrity
  chunk_id UUID NOT NULL REFERENCES public.document_chunks(chunk_id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(module_code, chunk_id)
);

CREATE INDEX IF NOT EXISTS idx_module_chunk_links_module_code
  ON public.module_chunk_links(module_code);
CREATE INDEX IF NOT EXISTS idx_module_chunk_links_chunk_id
  ON public.module_chunk_links(chunk_id);

COMMENT ON TABLE public.module_chunk_links IS
'Links modules (RUNTIME) to document_chunks (CORPUS) for fast retrieval and mining. Enables "show me all chunks for this module" queries. module_code references RUNTIME database (no FK).';

COMMIT;
