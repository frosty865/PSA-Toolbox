-- Copy Documents to Corpus Documents
-- TARGET DB: Supabase Postgres (psa-back)
-- Schema: public
-- Purpose: One-time copy of existing documents from public.documents to public.corpus_documents
-- 
-- This script copies citation metadata from the legacy public.documents table
-- to the authoritative public.corpus_documents table.
-- 
-- Idempotent: Uses ON CONFLICT DO NOTHING to skip existing file_hash entries.
-- Safe to run multiple times.

-- ============================================================================
-- Copy citation metadata from documents to corpus_documents
-- ============================================================================

INSERT INTO public.corpus_documents (
  file_hash,
  canonical_path,
  original_filename,
  file_stem,
  inferred_title,
  title_confidence,
  pdf_meta_title,
  pdf_meta_author,
  pdf_meta_subject,
  pdf_meta_creator,
  pdf_meta_producer,
  pdf_meta_creation_date,
  pdf_meta_mod_date,
  publisher,
  publication_date,
  source_url,
  citation_short,
  citation_full,
  locator_scheme,
  ingestion_warnings
)
SELECT
  d.file_hash,
  d.file_path as canonical_path,
  NULL as original_filename,  -- Not in source table
  NULL as file_stem,  -- Not in source table
  d.title as inferred_title,  -- Use title as inferred_title
  50 as title_confidence,  -- Default confidence for title-based inference
  NULL as pdf_meta_title,  -- Not in source table
  NULL as pdf_meta_author,  -- Not in source table
  NULL as pdf_meta_subject,  -- Not in source table
  NULL as pdf_meta_creator,  -- Not in source table
  NULL as pdf_meta_producer,  -- Not in source table
  NULL as pdf_meta_creation_date,  -- Not in source table
  NULL as pdf_meta_mod_date,  -- Not in source table
  NULL as publisher,  -- Not in source table
  NULL as publication_date,  -- Not in source table
  NULL as source_url,  -- Not in source table
  NULL as citation_short,  -- Not in source table
  NULL as citation_full,  -- Not in source table
  'page' as locator_scheme,  -- Default
  '[]'::jsonb as ingestion_warnings  -- Default
FROM public.documents d
WHERE d.file_hash IS NOT NULL
  AND d.file_hash != ''
ON CONFLICT (file_hash) DO NOTHING;

-- ============================================================================
-- Report results
-- ============================================================================

SELECT 
  COUNT(*) as total_copied,
  (SELECT COUNT(*) FROM public.documents WHERE file_hash IS NOT NULL AND file_hash != '') as total_source_documents,
  (SELECT COUNT(*) FROM public.corpus_documents) as total_corpus_documents
FROM public.corpus_documents;
