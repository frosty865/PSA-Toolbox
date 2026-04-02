-- Add source_key to ofc_library_citations (RUNTIME database)
-- Date: 2026-01-16
-- Purpose: Add source_key column to citations table in RUNTIME database
--
-- NOTE: This migration runs in RUNTIME database (wivohgbuuwxoyfyzntsd)
-- The source_registry table is in CORPUS database (yylslokiaovdythzrbgt)
-- No foreign key constraint - referential integrity enforced in application code

-- ============================================================================
-- Update ofc_library_citations to support source_key
-- ============================================================================

DO $$
BEGIN
  -- Add source_key column to citations table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_library_citations' 
    AND column_name = 'source_key'
  ) THEN
    ALTER TABLE public.ofc_library_citations 
      ADD COLUMN source_key TEXT NULL;
    -- Note: No foreign key constraint - source_registry is in CORPUS, citations are in RUNTIME
    -- Referential integrity is enforced in application code
    
    CREATE INDEX IF NOT EXISTS idx_ofc_library_citations_source_key 
      ON public.ofc_library_citations(source_key);
  END IF;

  -- Add locator_type column (replaces page_locator with structured locator)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_library_citations' 
    AND column_name = 'locator_type'
  ) THEN
    ALTER TABLE public.ofc_library_citations 
      ADD COLUMN locator_type TEXT NULL CHECK (locator_type IN ('page', 'section', 'paragraph', 'url_fragment'));
  END IF;

  -- Rename page_locator to locator (if exists and locator doesn't)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_library_citations' 
    AND column_name = 'page_locator'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_library_citations' 
    AND column_name = 'locator'
  ) THEN
    ALTER TABLE public.ofc_library_citations 
      RENAME COLUMN page_locator TO locator;
  END IF;

  -- Add locator column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_library_citations' 
    AND column_name = 'locator'
  ) THEN
    ALTER TABLE public.ofc_library_citations 
      ADD COLUMN locator TEXT NULL;
  END IF;

  -- Add retrieved_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_library_citations' 
    AND column_name = 'retrieved_at'
  ) THEN
    ALTER TABLE public.ofc_library_citations 
      ADD COLUMN retrieved_at TIMESTAMPTZ NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.ofc_library_citations.source_key IS
'References source_registry.source_key in CORPUS database. Required for new citations. Referential integrity enforced in application code.';

COMMENT ON COLUMN public.ofc_library_citations.locator_type IS
'Type of locator: "page", "section", "paragraph", or "url_fragment".';

COMMENT ON COLUMN public.ofc_library_citations.locator IS
'Locator value (e.g., "p.12", "Section 3.2", "para-4", "#heading-id").';

-- ============================================================================
-- Add constraint: citations must have source_key OR source_id (for migration)
-- ============================================================================

DO $$
BEGIN
  -- Add check constraint: at least one of source_key or source_id must be present
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_citation_has_source'
  ) THEN
    ALTER TABLE public.ofc_library_citations 
      ADD CONSTRAINT chk_citation_has_source 
      CHECK (source_key IS NOT NULL OR source_id IS NOT NULL);
  END IF;
END $$;
