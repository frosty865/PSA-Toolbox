-- Migration: Module Baseline References (Informational Only)
-- Date: 2026-01-21
-- Purpose: Add table for module baseline references (informational, non-answerable)
--
-- HARD RULE: This migration is for RUNTIME project ONLY
-- Do NOT run this on CORPUS project
--
-- Baseline references are informational only and do NOT create assessment responses.
-- They provide UI guidance on which baseline questions are relevant to the module context.

BEGIN;

-- ============================================================================
-- 1. Create module_baseline_references table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.module_baseline_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code TEXT NOT NULL REFERENCES public.assessment_modules(module_code) ON DELETE CASCADE,
  baseline_canon_id TEXT NOT NULL REFERENCES public.baseline_spines_runtime(canon_id) ON DELETE CASCADE,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (module_code, baseline_canon_id)
);

CREATE INDEX IF NOT EXISTS idx_module_baseline_references_module 
  ON public.module_baseline_references(module_code);

CREATE INDEX IF NOT EXISTS idx_module_baseline_references_canon_id 
  ON public.module_baseline_references(baseline_canon_id);

COMMENT ON TABLE public.module_baseline_references IS
'Stores informational references to baseline questions for modules. These are UI guidance only and do NOT create assessment responses.';

COMMENT ON COLUMN public.module_baseline_references.module_code IS
'References the assessment module that provides this baseline reference.';

COMMENT ON COLUMN public.module_baseline_references.baseline_canon_id IS
'References a baseline question (canon_id) that is contextually relevant to this module. Informational only.';

COMMENT ON COLUMN public.module_baseline_references.note IS
'Optional note explaining why this baseline question is relevant to the module context.';

COMMIT;
