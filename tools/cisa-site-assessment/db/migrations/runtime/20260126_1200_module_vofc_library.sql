-- Module VOFC Library Migration
-- Date: 2026-01-26
-- Purpose: Create module_ofc_library and module_ofc_citations tables for VOFCs loaded from XLSX
--
-- These tables are separate from module_ofcs (which is for module-curated OFCs).
-- VOFCs are loaded from seed data (e.g., VOFC_Library.xlsx) and linked to source_registry.
--
-- NOTE: This migration assumes source_registry exists in this database (RUNTIME).
-- If source_registry is in CORPUS, the loader will handle cross-database references.
-- If source_registry doesn't exist here, you may need to create it or use CORPUS_DATABASE_URL.

-- ============================================================================
-- 1. Create module_ofc_library table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.module_ofc_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code TEXT NOT NULL REFERENCES public.assessment_modules(module_code) ON DELETE CASCADE,
  title TEXT NOT NULL,
  vofc_text TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RETIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.module_ofc_library IS
'Module-specific VOFCs (Options for Consideration) loaded from seed data (e.g., VOFC_Library.xlsx). Separate from module_ofcs (curated OFCs).';

COMMENT ON COLUMN public.module_ofc_library.vofc_text IS
'Full text of the VOFC (Option for Consideration).';

COMMENT ON COLUMN public.module_ofc_library.tags IS
'Array of tags for categorization (e.g., ["vehicle-ramming", "hvm"]).';

CREATE INDEX IF NOT EXISTS idx_module_ofc_library_module_code 
  ON public.module_ofc_library(module_code);

CREATE INDEX IF NOT EXISTS idx_module_ofc_library_status 
  ON public.module_ofc_library(status) 
  WHERE status = 'ACTIVE';

-- ============================================================================
-- 2. Create module_ofc_citations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.module_ofc_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_ofc_id UUID NOT NULL REFERENCES public.module_ofc_library(id) ON DELETE CASCADE,
  source_registry_id UUID NOT NULL,
  locator_type TEXT NOT NULL DEFAULT 'XLSX_SHEET_ROW' CHECK (locator_type IN ('XLSX_SHEET_ROW', 'page', 'section', 'paragraph', 'url_fragment')),
  locator_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  quote TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.module_ofc_citations IS
'Citations linking module VOFCs to source_registry entries. Supports XLSX locators (sheet/row) and other locator types.';

COMMENT ON COLUMN public.module_ofc_citations.source_registry_id IS
'References public.source_registry(id). No FK constraint if source_registry is in different database.';

COMMENT ON COLUMN public.module_ofc_citations.locator_type IS
'Type of locator: XLSX_SHEET_ROW for XLSX sources, or page/section/paragraph/url_fragment for other sources.';

COMMENT ON COLUMN public.module_ofc_citations.locator_json IS
'JSON locator data. For XLSX_SHEET_ROW: {"sheet": "...", "row": 123}. For others: appropriate structure.';

CREATE INDEX IF NOT EXISTS idx_module_ofc_citations_module_ofc_id 
  ON public.module_ofc_citations(module_ofc_id);

CREATE INDEX IF NOT EXISTS idx_module_ofc_citations_source_registry_id 
  ON public.module_ofc_citations(source_registry_id);

-- ============================================================================
-- 3. Updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_module_ofc_library_set_updated_at ON public.module_ofc_library;

CREATE TRIGGER trg_module_ofc_library_set_updated_at
BEFORE UPDATE ON public.module_ofc_library
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
