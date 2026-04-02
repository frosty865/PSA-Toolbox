-- Move canonical_sources and ofc_library_citations to RUNTIME database
-- Date: 2026-01-24
-- Purpose: Move tables from CORPUS to RUNTIME to support FK constraints and runtime queries
-- 
-- IMPORTANT: This migration MUST run against RUNTIME database only
-- Run with: npx tsx tools/run_sql.ts db/migrations/runtime/20260124_0011_move_citations_and_sources_to_runtime.sql
-- Or execute directly against RUNTIME database

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
'Bibliographic references for evidence-backed OFCs. Every OFC must cite at least one source. Moved from CORPUS to RUNTIME for FK integrity.';

CREATE INDEX IF NOT EXISTS idx_canonical_sources_type 
  ON public.canonical_sources(source_type);

CREATE INDEX IF NOT EXISTS idx_canonical_sources_title 
  ON public.canonical_sources(title);

-- ============================================================================
-- 2. OFC Library Citations (bind OFCs to sources)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ofc_library_citations (
  ofc_id UUID NOT NULL REFERENCES public.ofc_library(ofc_id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.canonical_sources(source_id) ON DELETE RESTRICT,
  excerpt TEXT NULL,
  page_locator TEXT NULL,
  -- Additional columns from migration 20260116_add_source_key_to_citations.sql
  source_key TEXT NULL,
  locator_type TEXT NULL CHECK (locator_type IN ('page', 'section', 'paragraph', 'url_fragment')),
  locator TEXT NULL,
  retrieved_at TIMESTAMPTZ NULL,
  PRIMARY KEY (ofc_id, source_id)
);

COMMENT ON TABLE public.ofc_library_citations IS
'Citations linking OFCs to canonical sources. Every OFC must have >= 1 citation (enforced in code). Moved from CORPUS to RUNTIME for FK integrity.';

COMMENT ON COLUMN public.ofc_library_citations.excerpt IS
'Optional short excerpt pointer (NOT long quotes).';

COMMENT ON COLUMN public.ofc_library_citations.page_locator IS
'Page or section reference (e.g., "p. 17" or "Sec 3.2"). Legacy column, prefer locator + locator_type.';

COMMENT ON COLUMN public.ofc_library_citations.source_key IS
'References source_registry.source_key in CORPUS database. Required for new citations. Referential integrity enforced in application code.';

COMMENT ON COLUMN public.ofc_library_citations.locator_type IS
'Type of locator: "page", "section", "paragraph", or "url_fragment".';

COMMENT ON COLUMN public.ofc_library_citations.locator IS
'Locator value (e.g., "p.12", "Section 3.2", "para-4", "#heading-id").';

CREATE INDEX IF NOT EXISTS idx_ofc_library_citations_ofc 
  ON public.ofc_library_citations(ofc_id);

CREATE INDEX IF NOT EXISTS idx_ofc_library_citations_source 
  ON public.ofc_library_citations(source_id);

CREATE INDEX IF NOT EXISTS idx_ofc_library_citations_source_key 
  ON public.ofc_library_citations(source_key);

-- Add check constraint: at least one of source_key or source_id must be present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_citation_has_source'
    AND conrelid = 'public.ofc_library_citations'::regclass
  ) THEN
    ALTER TABLE public.ofc_library_citations 
      ADD CONSTRAINT chk_citation_has_source 
      CHECK (source_key IS NOT NULL OR source_id IS NOT NULL);
  END IF;
END $$;

-- ============================================================================
-- 3. Recreate view: v_eligible_ofc_library (if it exists)
-- ============================================================================

DROP VIEW IF EXISTS public.v_eligible_ofc_library CASCADE;

CREATE VIEW public.v_eligible_ofc_library AS
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
'OFCs eligible for nomination: ACTIVE status and >= 1 citation. citation_count is TEXT to avoid INT32 serialization issues.';

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 
  'canonical_sources' as table_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'canonical_sources'
  ) THEN 'CREATED' ELSE 'FAILED' END as status
UNION ALL
SELECT 
  'ofc_library_citations' as table_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_library_citations'
  ) THEN 'CREATED' ELSE 'FAILED' END as status
UNION ALL
SELECT 
  'v_eligible_ofc_library' as table_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'v_eligible_ofc_library'
  ) THEN 'CREATED' ELSE 'FAILED' END as status;
