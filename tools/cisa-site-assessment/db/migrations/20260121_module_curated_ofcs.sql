-- Migration: Module-Curated OFCs
-- Date: 2026-01-21
-- Purpose: Add tables for module-curated OFCs (separate from baseline/OFC canon)
--
-- HARD RULE: This migration is for RUNTIME project ONLY
-- Do NOT run this on CORPUS project
--
-- These tables store IST-numbered OFCs as "module-curated OFCs" for display
-- and later linkage to questions/OFC templates, without touching baseline.

BEGIN;

-- ============================================================================
-- 1. Create module_curated_ofcs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.module_curated_ofcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code TEXT NOT NULL REFERENCES public.assessment_modules(module_code) ON DELETE CASCADE,
  ofc_id TEXT NOT NULL,              -- e.g., IST_OFC_000061
  ofc_num INT NULL,                  -- 61
  ofc_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (module_code, ofc_id)
);

CREATE INDEX IF NOT EXISTS idx_module_curated_ofcs_module 
  ON public.module_curated_ofcs(module_code);

CREATE INDEX IF NOT EXISTS idx_module_curated_ofcs_ofcnum 
  ON public.module_curated_ofcs(ofc_num);

COMMENT ON TABLE public.module_curated_ofcs IS
'Stores module-curated OFCs (IST-numbered OFCs) for display and linkage. Separate from baseline OFC canon.';

COMMENT ON COLUMN public.module_curated_ofcs.module_code IS
'References the assessment module that curates this OFC.';

COMMENT ON COLUMN public.module_curated_ofcs.ofc_id IS
'IST OFC identifier (e.g., IST_OFC_000061).';

COMMENT ON COLUMN public.module_curated_ofcs.ofc_num IS
'Numeric OFC number (e.g., 61). Nullable for non-numeric OFCs.';

COMMENT ON COLUMN public.module_curated_ofcs.ofc_text IS
'Full text of the OFC recommendation.';

-- ============================================================================
-- 2. Create module_curated_ofc_sources table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.module_curated_ofc_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_curated_ofc_id UUID NOT NULL REFERENCES public.module_curated_ofcs(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_label TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_module_curated_ofc_sources_ofc 
  ON public.module_curated_ofc_sources(module_curated_ofc_id);

COMMENT ON TABLE public.module_curated_ofc_sources IS
'Source URLs for module-curated OFCs. Links to external references.';

COMMENT ON COLUMN public.module_curated_ofc_sources.source_url IS
'URL to the source document or reference.';

COMMENT ON COLUMN public.module_curated_ofc_sources.source_label IS
'Optional label for the source (e.g., link text).';

COMMIT;
