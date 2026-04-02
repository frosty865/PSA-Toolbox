-- Add TECHNOLOGY_LIBRARY to document_role (corpus_documents)
-- Date: 2026-02-01
-- Purpose: Support Technology Library ingestion and RAG (chunk + tag with library: technology)

-- ============================================================================
-- 1. Drop existing constraint and add extended constraint
-- ============================================================================

ALTER TABLE public.corpus_documents
DROP CONSTRAINT IF EXISTS corpus_documents_document_role_chk;

ALTER TABLE public.corpus_documents
ADD CONSTRAINT corpus_documents_document_role_chk
CHECK (document_role IN ('OFC_SOURCE','AUTHORITY_SOURCE','TECHNOLOGY_LIBRARY'));

COMMENT ON COLUMN public.corpus_documents.document_role IS
'Document role: OFC_SOURCE = generates OFC candidates; AUTHORITY_SOURCE = guidance/authority; TECHNOLOGY_LIBRARY = technology library for RAG.';

-- ============================================================================
-- 2. Partial index for TECHNOLOGY_LIBRARY (optional, for backfill/retrieval)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_corpus_documents_document_role_technology_library
  ON public.corpus_documents(document_role)
  WHERE document_role = 'TECHNOLOGY_LIBRARY';

COMMENT ON INDEX idx_corpus_documents_document_role_technology_library IS
'Index for filtering Technology Library documents during RAG backfill and reporting.';
