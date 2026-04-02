-- Initialize OFC Library Table and View in RUNTIME Database
-- Run this in your RUNTIME database (psa_runtime) to fix "OFC library table or view not initialized" error
-- Date: 2026-01-24

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

CREATE INDEX IF NOT EXISTS idx_ofc_library_citations_ofc 
  ON public.ofc_library_citations(ofc_id);

CREATE INDEX IF NOT EXISTS idx_ofc_library_citations_source 
  ON public.ofc_library_citations(source_id);

-- ============================================================================
-- 4. Updated_at trigger function (if not exists)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. Updated_at trigger for ofc_library
-- ============================================================================

DROP TRIGGER IF EXISTS update_ofc_library_updated_at ON public.ofc_library;
CREATE TRIGGER update_ofc_library_updated_at
  BEFORE UPDATE ON public.ofc_library
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

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
  COUNT(olc.source_id)::text as citation_count,
  ol.created_at,
  ol.updated_at
FROM public.ofc_library ol
LEFT JOIN public.ofc_library_citations olc ON ol.ofc_id = olc.ofc_id
WHERE ol.status = 'ACTIVE'
GROUP BY ol.ofc_id
HAVING COUNT(olc.source_id) >= 1;

COMMENT ON VIEW public.v_eligible_ofc_library IS
'OFCs eligible for nomination: ACTIVE status and >= 1 citation.';

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify tables exist
SELECT 
  'ofc_library' as table_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'ofc_library'
  ) THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 
  'ofc_library_citations',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'ofc_library_citations'
  ) THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 
  'canonical_sources',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'canonical_sources'
  ) THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 
  'v_eligible_ofc_library',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'v_eligible_ofc_library'
  ) THEN 'EXISTS' ELSE 'MISSING' END;
