-- Migration: Baseline CORE + Modules Support
-- Date: 2026-01-14
-- Purpose: Add baseline_core_version and modules support to assessment definitions
--
-- HARD RULE: This migration is for RUNTIME project ONLY
-- Do NOT run this on CORPUS project

-- ============================================================================
-- 1. Create assessment_definitions table if it doesn't exist
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assessment_definitions (
  assessment_id UUID PRIMARY KEY REFERENCES public.assessments(id) ON DELETE CASCADE,
  baseline_core_version TEXT NOT NULL DEFAULT 'BASELINE_CORE_V1',
  sector_code TEXT NULL,
  subsector_code TEXT NULL,
  modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assessment_definitions IS
'Stores the question set composition for each assessment (baseline core version + optional modules + sector/subsector).';

COMMENT ON COLUMN public.assessment_definitions.baseline_core_version IS
'Version identifier for the baseline core question set (e.g., BASELINE_CORE_V1).';

COMMENT ON COLUMN public.assessment_definitions.modules IS
'Array of module codes that are included in this assessment (e.g., ["MODULE_PUBLIC_VENUE_CROWD_MANAGEMENT"]).';

-- ============================================================================
-- 2. Create assessment_question_universe table (frozen question order)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assessment_question_universe (
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  layer TEXT NOT NULL CHECK (layer IN ('BASELINE_CORE', 'SECTOR', 'SUBSECTOR', 'MODULE')),
  question_code TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (assessment_id, question_code)
);

CREATE INDEX IF NOT EXISTS idx_assessment_question_universe_assessment_order
  ON public.assessment_question_universe(assessment_id, order_index);

COMMENT ON TABLE public.assessment_question_universe IS
'Frozen question universe for each assessment, preserving deterministic ordering.';

COMMENT ON COLUMN public.assessment_question_universe.layer IS
'Question layer: BASELINE_CORE (always present), SECTOR, SUBSECTOR, or MODULE (additive).';

COMMENT ON COLUMN public.assessment_question_universe.order_index IS
'Deterministic ordering of questions within the assessment.';

COMMENT ON COLUMN public.assessment_question_universe.meta IS
'Additional metadata (e.g., group name for BASELINE_CORE questions).';

-- ============================================================================
-- 3. Handle existing baseline_version column if present
-- ============================================================================

DO $$
BEGIN
  -- Rename baseline_version to baseline_core_version if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'assessment_definitions'
    AND column_name = 'baseline_version'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'assessment_definitions'
    AND column_name = 'baseline_core_version'
  ) THEN
    ALTER TABLE public.assessment_definitions
    RENAME COLUMN baseline_version TO baseline_core_version;
  END IF;
END $$;


