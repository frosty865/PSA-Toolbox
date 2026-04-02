-- Document Citation Metadata Migration
-- Date: 2026-01-16
-- Purpose: Add citation-ready metadata fields to documents table for deterministic PDF ingestion
--
-- Rules:
-- - Keep existing documents.title for backward compatibility
-- - UI should display inferred_title if present, else title, else file_stem
-- - No SAFE-related fields (SAFE is deprecated)
-- - Deterministic, repeatable, idempotent extraction

-- ============================================================================
-- 1. Add Citation Metadata Columns to documents table
-- ============================================================================

DO $$
BEGIN
  -- Filename tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'original_filename'
  ) THEN
    ALTER TABLE public.documents 
      ADD COLUMN original_filename TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'file_stem'
  ) THEN
    ALTER TABLE public.documents 
      ADD COLUMN file_stem TEXT NULL;
  END IF;

  -- Title inference
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'inferred_title'
  ) THEN
    ALTER TABLE public.documents 
      ADD COLUMN inferred_title TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'title_confidence'
  ) THEN
    ALTER TABLE public.documents 
      ADD COLUMN title_confidence SMALLINT NOT NULL DEFAULT 0 CHECK (title_confidence >= 0 AND title_confidence <= 100);
  END IF;

  -- PDF metadata fields (raw, do not overwrite)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'pdf_meta_title'
  ) THEN
    ALTER TABLE public.documents 
      ADD COLUMN pdf_meta_title TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'pdf_meta_author'
  ) THEN
    ALTER TABLE public.documents 
      ADD COLUMN pdf_meta_author TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'pdf_meta_subject'
  ) THEN
    ALTER TABLE public.documents 
      ADD COLUMN pdf_meta_subject TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'pdf_meta_creator'
  ) THEN
    ALTER TABLE public.documents 
      ADD COLUMN pdf_meta_creator TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'pdf_meta_producer'
  ) THEN
    ALTER TABLE public.documents 
      ADD COLUMN pdf_meta_producer TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'pdf_meta_creation_date'
  ) THEN
    ALTER TABLE public.documents 
      ADD COLUMN pdf_meta_creation_date TIMESTAMPTZ NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'pdf_meta_mod_date'
  ) THEN
    ALTER TABLE public.documents 
      ADD COLUMN pdf_meta_mod_date TIMESTAMPTZ NULL;
  END IF;

  -- Citation fields (structured)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'publisher'
  ) THEN
    ALTER TABLE public.documents 
      ADD COLUMN publisher TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'publication_date'
  ) THEN
    ALTER TABLE public.documents 
      ADD COLUMN publication_date DATE NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'source_url'
  ) THEN
    ALTER TABLE public.documents 
      ADD COLUMN source_url TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'citation_short'
  ) THEN
    ALTER TABLE public.documents 
      ADD COLUMN citation_short TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'citation_full'
  ) THEN
    ALTER TABLE public.documents 
      ADD COLUMN citation_full TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'locator_scheme'
  ) THEN
    ALTER TABLE public.documents 
      ADD COLUMN locator_scheme TEXT NOT NULL DEFAULT 'page' CHECK (locator_scheme IN ('page', 'section', 'paragraph', 'url_fragment'));
  END IF;

  -- Ingestion warnings
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'ingestion_warnings'
  ) THEN
    ALTER TABLE public.documents 
      ADD COLUMN ingestion_warnings JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- ============================================================================
-- 2. Add Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_documents_file_hash 
  ON public.documents(file_hash) 
  WHERE file_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_inferred_title 
  ON public.documents(inferred_title) 
  WHERE inferred_title IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_publisher 
  ON public.documents(publisher) 
  WHERE publisher IS NOT NULL;

-- ============================================================================
-- 3. Comments
-- ============================================================================

COMMENT ON COLUMN public.documents.original_filename IS
'Original filename from filesystem (preserved for reference).';

COMMENT ON COLUMN public.documents.file_stem IS
'Filename without extension (for fallback title inference).';

COMMENT ON COLUMN public.documents.inferred_title IS
'Best title inferred from PDF metadata + first-page text + filename. UI should display this if present.';

COMMENT ON COLUMN public.documents.title_confidence IS
'Confidence score 0-100 for inferred_title: 90=pdf_meta_title, 70=first-page heading, 50=filename-derived, 10=fallback.';

COMMENT ON COLUMN public.documents.publisher IS
'Inferred publisher (e.g., "CISA", "FEMA", "ISC"). Conservative inference only.';

COMMENT ON COLUMN public.documents.publication_date IS
'Inferred publication date from title or first-page text.';

COMMENT ON COLUMN public.documents.citation_short IS
'Short citation format: "Publisher — Title (Month YYYY)" if publisher + title available.';

COMMENT ON COLUMN public.documents.citation_full IS
'Full citation format: "Publisher. Title. Publication date. URL (Retrieved date)." if available.';

COMMENT ON COLUMN public.documents.locator_scheme IS
'Locator scheme for citations: "page" (default for PDFs), "section", "paragraph", or "url_fragment".';

COMMENT ON COLUMN public.documents.ingestion_warnings IS
'Array of warning strings from ingestion (e.g., "numeric_filename_no_title", "multiple_dates_detected").';
