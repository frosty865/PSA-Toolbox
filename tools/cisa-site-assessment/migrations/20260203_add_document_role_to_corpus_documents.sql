-- Add document_role to corpus_documents
-- Date: 2026-02-03
-- Purpose: Separate OFC authoring sources from authority/guidance sources

-- ============================================================================
-- 1. Add document_role column with safe default
-- ============================================================================

ALTER TABLE public.corpus_documents
ADD COLUMN IF NOT EXISTS document_role TEXT NOT NULL DEFAULT 'AUTHORITY_SOURCE';

COMMENT ON COLUMN public.corpus_documents.document_role IS
'Document role: OFC_SOURCE = generates OFC candidates; AUTHORITY_SOURCE = guidance/authority for citations only.';

-- ============================================================================
-- 2. Add constraint to enforce valid values
-- ============================================================================

ALTER TABLE public.corpus_documents
DROP CONSTRAINT IF EXISTS corpus_documents_document_role_chk;

ALTER TABLE public.corpus_documents
ADD CONSTRAINT corpus_documents_document_role_chk
CHECK (document_role IN ('OFC_SOURCE','AUTHORITY_SOURCE'));

-- ============================================================================
-- 3. Backfill existing documents (safety; DEFAULT should handle new rows)
-- ============================================================================

UPDATE public.corpus_documents
SET document_role = 'AUTHORITY_SOURCE'
WHERE document_role IS NULL;

-- ============================================================================
-- 4. Create index for efficient role filtering
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_corpus_documents_document_role 
  ON public.corpus_documents(document_role)
  WHERE document_role = 'OFC_SOURCE';

COMMENT ON INDEX idx_corpus_documents_document_role IS
'Index for efficient filtering of OFC_SOURCE documents during mining.';
