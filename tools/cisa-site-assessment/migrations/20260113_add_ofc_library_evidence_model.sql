-- Evidence-Backed OFC Library Migration
-- Date: 2025-01-13
-- Purpose: Replace formulaic OFC generation with citation-required library system
--
-- Rules:
-- - Every OFC must have >= 1 citation (enforced in code)
-- - OFCs are selected from library, not generated
-- - Missing library OFCs create stubs (no invented text)

-- ============================================================================
-- 1. Canonical Sources (bibliographic references)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.canonical_sources (
  source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NULL,
  publisher TEXT NULL,
  published_date DATE NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('PDF','WEB','GUIDE','STANDARD','MEMO','OTHER')),
  uri TEXT NULL,
  citation_text TEXT NOT NULL,
  content_hash TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.canonical_sources IS
'Bibliographic references for evidence-backed OFCs. Every OFC must cite at least one source.';

COMMENT ON COLUMN public.canonical_sources.citation_text IS
'Formatted reference string (e.g., "DHS, Protective Security Assessment Guide, 2023, p. 45").';

COMMENT ON COLUMN public.canonical_sources.source_type IS
'Type of source: PDF, WEB, GUIDE, STANDARD, MEMO, OTHER.';

CREATE INDEX IF NOT EXISTS idx_canonical_sources_type 
  ON public.canonical_sources(source_type);

CREATE INDEX IF NOT EXISTS idx_canonical_sources_title 
  ON public.canonical_sources(title);

-- ============================================================================
-- 2. OFC Library (curated OFC entries)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ofc_library (
  ofc_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('BASELINE','SECTOR','SUBSECTOR')),
  sector TEXT NULL,
  subsector TEXT NULL,

  link_type TEXT NOT NULL CHECK (link_type IN ('PRIMARY_QUESTION','EXPANSION_QUESTION')),
  link_key TEXT NOT NULL,
  
  trigger_response TEXT NOT NULL DEFAULT 'NO' CHECK (trigger_response IN ('NO')),
  ofc_text TEXT NOT NULL,
  solution_role TEXT NOT NULL CHECK (solution_role IN ('PARTIAL','COMPLETE')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RETIRED')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT chk_baseline_no_sector 
    CHECK (
      (scope = 'BASELINE' AND sector IS NULL AND subsector IS NULL) OR
      (scope != 'BASELINE')
    ),
  CONSTRAINT chk_sector_has_sector 
    CHECK (
      (scope = 'SECTOR' AND sector IS NOT NULL) OR
      (scope != 'SECTOR')
    ),
  CONSTRAINT chk_subsector_has_both 
    CHECK (
      (scope = 'SUBSECTOR' AND sector IS NOT NULL AND subsector IS NOT NULL) OR
      (scope != 'SUBSECTOR')
    ),
  CONSTRAINT uq_ofc_library_unique 
    UNIQUE(scope, sector, subsector, link_type, link_key, trigger_response, ofc_text)
);

COMMENT ON TABLE public.ofc_library IS
'Curated OFC library. Every OFC must have >= 1 citation. OFCs are selected, not generated.';

COMMENT ON COLUMN public.ofc_library.link_type IS
'PRIMARY_QUESTION: links to ALT_SAFE question_key; EXPANSION_QUESTION: links to expansion question_id.';

COMMENT ON COLUMN public.ofc_library.link_key IS
'For PRIMARY_QUESTION: ALT_SAFE question_key; For EXPANSION_QUESTION: expansion question_id.';

COMMENT ON COLUMN public.ofc_library.solution_role IS
'PARTIAL: addresses part of the gap; COMPLETE: fully addresses the gap.';

CREATE INDEX IF NOT EXISTS idx_ofc_library_scope 
  ON public.ofc_library(scope);

CREATE INDEX IF NOT EXISTS idx_ofc_library_link 
  ON public.ofc_library(link_type, link_key);

CREATE INDEX IF NOT EXISTS idx_ofc_library_status 
  ON public.ofc_library(status);

CREATE INDEX IF NOT EXISTS idx_ofc_library_sector_subsector 
  ON public.ofc_library(sector, subsector) 
  WHERE sector IS NOT NULL;

-- ============================================================================
-- 3. OFC Library Citations (bind OFCs to sources)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ofc_library_citations (
  ofc_id UUID NOT NULL REFERENCES public.ofc_library(ofc_id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.canonical_sources(source_id) ON DELETE RESTRICT,
  excerpt TEXT NULL,
  page_locator TEXT NULL,
  PRIMARY KEY (ofc_id, source_id)
);

COMMENT ON TABLE public.ofc_library_citations IS
'Citations linking OFCs to canonical sources. Every OFC must have >= 1 citation (enforced in code).';

COMMENT ON COLUMN public.ofc_library_citations.excerpt IS
'Optional short excerpt pointer (NOT long quotes).';

COMMENT ON COLUMN public.ofc_library_citations.page_locator IS
'Page or section reference (e.g., "p. 17" or "Sec 3.2").';

CREATE INDEX IF NOT EXISTS idx_ofc_library_citations_ofc 
  ON public.ofc_library_citations(ofc_id);

CREATE INDEX IF NOT EXISTS idx_ofc_library_citations_source 
  ON public.ofc_library_citations(source_id);

-- ============================================================================
-- 4. Update ofc_nominations table (add library fields)
-- ============================================================================

-- Add fields to existing ofc_nominations table if they don't exist
DO $$
BEGIN
  -- Add ofc_id (FK to ofc_library)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_nominations' 
    AND column_name = 'ofc_id'
  ) THEN
    ALTER TABLE public.ofc_nominations 
      ADD COLUMN ofc_id UUID NULL REFERENCES public.ofc_library(ofc_id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_ofc_nominations_ofc_id 
      ON public.ofc_nominations(ofc_id);
  END IF;

  -- Add link_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_nominations' 
    AND column_name = 'link_type'
  ) THEN
    ALTER TABLE public.ofc_nominations 
      ADD COLUMN link_type TEXT NULL CHECK (link_type IN ('PRIMARY_QUESTION','EXPANSION_QUESTION'));
  END IF;

  -- Add link_key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_nominations' 
    AND column_name = 'link_key'
  ) THEN
    ALTER TABLE public.ofc_nominations 
      ADD COLUMN link_key TEXT NULL;
  END IF;

  -- Add scope
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_nominations' 
    AND column_name = 'scope'
  ) THEN
    ALTER TABLE public.ofc_nominations 
      ADD COLUMN scope TEXT NULL CHECK (scope IN ('BASELINE','SECTOR','SUBSECTOR'));
  END IF;

  -- Add ofc_text_snapshot (copied from library when nominated)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_nominations' 
    AND column_name = 'ofc_text_snapshot'
  ) THEN
    ALTER TABLE public.ofc_nominations 
      ADD COLUMN ofc_text_snapshot TEXT NULL;
  END IF;

  -- Update status_reason to allow 'MISSING_LIBRARY_OFC'
  -- Note: This assumes status_reason is TEXT; if it has a CHECK constraint, we may need to alter it
  -- For now, we'll rely on application-level validation
END $$;

-- ============================================================================
-- 5. Updated_at triggers
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_ofc_library_updated_at ON public.ofc_library;
    CREATE TRIGGER update_ofc_library_updated_at
      BEFORE UPDATE ON public.ofc_library
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- 6. View: Eligible OFCs (citation count >= 1, status = ACTIVE)
-- ============================================================================

CREATE OR REPLACE VIEW public.v_eligible_ofc_library AS
SELECT 
  ol.ofc_id,
  ol.scope,
  ol.sector,
  ol.subsector,
  ol.link_type,
  ol.link_key,
  ol.trigger_response,
  ol.ofc_text,
  ol.solution_role,
  ol.status,
  COUNT(olc.source_id) as citation_count,
  ol.created_at,
  ol.updated_at
FROM public.ofc_library ol
LEFT JOIN public.ofc_library_citations olc ON ol.ofc_id = olc.ofc_id
WHERE ol.status = 'ACTIVE'
GROUP BY ol.ofc_id
HAVING COUNT(olc.source_id) >= 1;

COMMENT ON VIEW public.v_eligible_ofc_library IS
'OFCs eligible for nomination: ACTIVE status and >= 1 citation.';

