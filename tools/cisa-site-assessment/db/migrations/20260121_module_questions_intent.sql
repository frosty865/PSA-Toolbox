-- Migration: Module Questions Intent Classification
-- Date: 2026-01-21
-- Purpose: Create table for module-specific questions (MODULEQ_ prefix) with intent classification
--
-- HARD RULE: This migration is for RUNTIME project ONLY
-- Do NOT run this on CORPUS project
--
-- Module-specific questions are separate from baseline questions and use MODULEQ_ prefix.
-- They are classified by intent to support convergence bridge inference.

BEGIN;

-- ============================================================================
-- 1. Create module_questions table for module-specific questions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.module_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code TEXT NOT NULL REFERENCES public.assessment_modules(module_code) ON DELETE CASCADE,
  module_question_id TEXT NOT NULL,  -- e.g., MODULEQ_EV_CHARGING_001
  question_text TEXT NOT NULL,
  question_intent TEXT NOT NULL DEFAULT 'PHYSICAL_CONTROL'
    CHECK (question_intent IN (
      'PHYSICAL_CONTROL',
      'GOVERNANCE_INTERFACE',
      'CONTINUITY_OPERATIONS',
      'DETECTION_ALERTING_PHYSICAL'
    )),
  question_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (module_code, module_question_id)
);

CREATE INDEX IF NOT EXISTS idx_module_questions_module_code 
  ON public.module_questions(module_code);

CREATE INDEX IF NOT EXISTS idx_module_questions_intent 
  ON public.module_questions(question_intent);

CREATE INDEX IF NOT EXISTS idx_module_questions_question_id 
  ON public.module_questions(module_question_id);

COMMENT ON TABLE public.module_questions IS
'Stores module-specific questions (MODULEQ_ prefix) that are generated from convergence bridge inference. These are PSA-scope questions addressing physical impact readiness, not cyber controls.';

COMMENT ON COLUMN public.module_questions.module_question_id IS
'Unique identifier for the module question (e.g., MODULEQ_EV_CHARGING_001). Must start with MODULEQ_ prefix.';

COMMENT ON COLUMN public.module_questions.question_text IS
'Full text of the module-specific question. Must be answerable as YES/NO/N_A based on physical observation or existence.';

COMMENT ON COLUMN public.module_questions.question_intent IS
'Classification of question intent: PHYSICAL_CONTROL, GOVERNANCE_INTERFACE, CONTINUITY_OPERATIONS, or DETECTION_ALERTING_PHYSICAL.';

COMMENT ON COLUMN public.module_questions.question_order IS
'Deterministic ordering of questions within the module. Lower numbers appear first.';

COMMIT;
