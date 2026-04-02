-- Corpus Documents Migration
-- Date: 2026-01-18
-- Purpose: Create authoritative corpus_documents table for citation metadata
--
-- Rules:
-- - corpus_documents is authoritative for corpus citation metadata
-- - file_hash is the natural key (unique)
-- - Keep public.documents for backward compatibility (legacy)
-- - Runtime assessment uploads must NOT write to corpus_documents

-- ============================================================================
-- 1. Create corpus_documents table (AUTHORITATIVE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.corpus_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Natural key
  file_hash TEXT UNIQUE NOT NULL,
  
  -- Core identity
  canonical_path TEXT NULL,
  original_filename TEXT NULL,
  file_stem TEXT NULL,
  
  -- Citation-ready title
  inferred_title TEXT NULL,
  title_confidence SMALLINT NOT NULL DEFAULT 0 CHECK (title_confidence >= 0 AND title_confidence <= 100),
  
  -- Raw PDF metadata (do not overwrite)
  pdf_meta_title TEXT NULL,
  pdf_meta_author TEXT NULL,
  pdf_meta_subject TEXT NULL,
  pdf_meta_creator TEXT NULL,
  pdf_meta_producer TEXT NULL,
  pdf_meta_creation_date TIMESTAMPTZ NULL,
  pdf_meta_mod_date TIMESTAMPTZ NULL,
  
  -- Citation fields (structured)
  publisher TEXT NULL,
  publication_date DATE NULL,
  source_url TEXT NULL,
  citation_short TEXT NULL,
  citation_full TEXT NULL,
  locator_scheme TEXT NOT NULL DEFAULT 'page' CHECK (locator_scheme IN ('page', 'section', 'paragraph', 'url_fragment')),
  
  -- Quality/warnings
  ingestion_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.corpus_documents IS
'Authoritative corpus document citation metadata. Use file_hash as natural key. Do not write from runtime assessment uploads.';

COMMENT ON COLUMN public.corpus_documents.file_hash IS
'SHA256 hash of document content. Natural key (unique).';

COMMENT ON COLUMN public.corpus_documents.canonical_path IS
'Final archived path after PDF is moved to canonical location. Do not store transient/temp paths.';

COMMENT ON COLUMN public.corpus_documents.inferred_title IS
'Best title inferred from PDF metadata + first-page text + filename. UI should display this if present.';

COMMENT ON COLUMN public.corpus_documents.title_confidence IS
'Confidence score 0-100: 90=pdf_meta_title, 70=first-page heading, 50=filename-derived, 10=fallback.';

COMMENT ON COLUMN public.corpus_documents.publisher IS
'Inferred publisher (e.g., "CISA", "FEMA", "ISC"). Conservative inference only.';

COMMENT ON COLUMN public.corpus_documents.ingestion_warnings IS
'Array of warning strings from ingestion (e.g., "numeric_filename_no_title", "multiple_dates_detected"). Append-only set semantics.';

-- ============================================================================
-- 2. Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_corpus_documents_file_hash 
  ON public.corpus_documents(file_hash);

CREATE INDEX IF NOT EXISTS idx_corpus_documents_inferred_title 
  ON public.corpus_documents(inferred_title) 
  WHERE inferred_title IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_corpus_documents_publisher 
  ON public.corpus_documents(publisher) 
  WHERE publisher IS NOT NULL;

-- ============================================================================
-- 3. Updated_at trigger
-- ============================================================================

-- =========================
-- updated_at helper function
-- =========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$func$;

-- =========================
-- Drop trigger if exists (idempotent)
-- =========================
DROP TRIGGER IF EXISTS trg_corpus_documents_set_updated_at ON public.corpus_documents;

-- =========================
-- Create trigger (no DO block)
-- =========================
CREATE TRIGGER trg_corpus_documents_set_updated_at
BEFORE UPDATE ON public.corpus_documents
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 4. Backward compatibility view (Option A)
-- ============================================================================

CREATE OR REPLACE VIEW public.documents_corpus_view AS
SELECT 
  cd.id as document_id,
  cd.file_hash,
  cd.canonical_path as file_path,
  cd.original_filename,
  cd.file_stem,
  cd.inferred_title as title,
  cd.inferred_title,
  cd.title_confidence,
  cd.publisher,
  cd.publication_date,
  cd.source_url,
  cd.citation_short,
  cd.citation_full,
  cd.ingestion_warnings,
  cd.created_at as ingested_at,
  cd.created_at,
  cd.updated_at
FROM public.corpus_documents cd;

COMMENT ON VIEW public.documents_corpus_view IS
'Backward compatibility view exposing corpus_documents as documents-like structure. Use for UI reads.';
