-- Migration: Modules as Additive Content Bundles
-- Date: 2026-01-21
-- Purpose: Refactor modules to be fully additive and separate from baseline
--
-- HARD RULE: This migration is for RUNTIME project ONLY
-- Do NOT run this on CORPUS project
--
-- Modules are additive content bundles:
-- - Module Questions: NOT baseline questions, stored in module-owned tables
-- - Module OFCs: NOT baseline OFCs, stored only from module import payload
-- Baseline remains universal and unchanged.

BEGIN;

-- ============================================================================
-- 1. Update module_questions table to match new schema
-- ============================================================================

-- Drop existing table if it exists with old schema
DROP TABLE IF EXISTS public.module_questions CASCADE;

CREATE TABLE IF NOT EXISTS public.module_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code TEXT NOT NULL REFERENCES public.assessment_modules(module_code) ON DELETE CASCADE,
  module_question_id TEXT NOT NULL,  -- e.g., MODULEQ_EV_CHARGING_001
  question_text TEXT NOT NULL,
  response_enum TEXT[] NOT NULL DEFAULT ARRAY['YES','NO','N_A'],
  question_intent TEXT NOT NULL DEFAULT 'PHYSICAL_CONTROL'
    CHECK (question_intent IN (
      'PHYSICAL_CONTROL',
      'GOVERNANCE_INTERFACE',
      'CONTINUITY_OPERATIONS',
      'DETECTION_ALERTING_PHYSICAL'
    )),
  order_index INTEGER NOT NULL DEFAULT 0,
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
'Stores module-specific questions (MODULEQ_ prefix). These are NOT baseline questions and are answered only when module is attached to an assessment.';

COMMENT ON COLUMN public.module_questions.module_question_id IS
'Unique identifier for the module question (e.g., MODULEQ_EV_CHARGING_001). Must start with MODULEQ_ prefix.';

COMMENT ON COLUMN public.module_questions.question_text IS
'Full text of the module-specific question. Must be answerable as YES/NO/N_A.';

COMMENT ON COLUMN public.module_questions.response_enum IS
'Allowed response values. Fixed to ["YES","NO","N_A"].';

COMMENT ON COLUMN public.module_questions.order_index IS
'Deterministic ordering of questions within the module. Lower numbers appear first.';

-- ============================================================================
-- 2. Create module_import_batches table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.module_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code TEXT NOT NULL REFERENCES public.assessment_modules(module_code) ON DELETE CASCADE,
  import_source TEXT NOT NULL,
  import_sha256 TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_payload JSONB NOT NULL,
  UNIQUE (module_code, import_sha256)
);

CREATE INDEX IF NOT EXISTS idx_module_import_batches_module 
  ON public.module_import_batches(module_code);

CREATE INDEX IF NOT EXISTS idx_module_import_batches_sha256 
  ON public.module_import_batches(import_sha256);

COMMENT ON TABLE public.module_import_batches IS
'Tracks module import batches. Each import creates a batch record with SHA256 hash for deduplication.';

COMMENT ON COLUMN public.module_import_batches.import_source IS
'Source identifier for the import (e.g., "module_ev_charging_import.json").';

COMMENT ON COLUMN public.module_import_batches.import_sha256 IS
'SHA256 hash of the import payload for deduplication.';

COMMENT ON COLUMN public.module_import_batches.stats IS
'Import statistics (questions_count, ofcs_count, etc.).';

COMMENT ON COLUMN public.module_import_batches.raw_payload IS
'Full JSON payload of the import for audit/replay.';

-- ============================================================================
-- 3. Create module_ofcs table (replaces module_curated_ofcs)
-- ============================================================================

-- Migrate data from old table if it exists
DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'module_curated_ofcs'
  ) INTO v_exists;
  
  IF v_exists THEN
    -- Create new table structure
    CREATE TABLE IF NOT EXISTS public.module_ofcs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module_code TEXT NOT NULL REFERENCES public.assessment_modules(module_code) ON DELETE CASCADE,
      batch_id UUID REFERENCES public.module_import_batches(id) ON DELETE SET NULL,
      ofc_id TEXT NOT NULL,
      ofc_num INT NULL,
      ofc_text TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (module_code, ofc_id)
    );
    
    -- Migrate data (if any exists)
    INSERT INTO public.module_ofcs (module_code, ofc_id, ofc_num, ofc_text, order_index, created_at)
    SELECT module_code, ofc_id, ofc_num, ofc_text, 
           COALESCE(ofc_num, 999999)::INTEGER, created_at
    FROM public.module_curated_ofcs
    ON CONFLICT (module_code, ofc_id) DO NOTHING;
    
    -- Drop old table after migration
    DROP TABLE IF EXISTS public.module_curated_ofc_sources CASCADE;
    DROP TABLE IF EXISTS public.module_curated_ofcs CASCADE;
  ELSE
    -- Create new table without migration
    CREATE TABLE IF NOT EXISTS public.module_ofcs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module_code TEXT NOT NULL REFERENCES public.assessment_modules(module_code) ON DELETE CASCADE,
      batch_id UUID REFERENCES public.module_import_batches(id) ON DELETE SET NULL,
      ofc_id TEXT NOT NULL,
      ofc_num INT NULL,
      ofc_text TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (module_code, ofc_id)
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_module_ofcs_module 
  ON public.module_ofcs(module_code);

CREATE INDEX IF NOT EXISTS idx_module_ofcs_batch 
  ON public.module_ofcs(batch_id);

CREATE INDEX IF NOT EXISTS idx_module_ofcs_ofcnum 
  ON public.module_ofcs(ofc_num);

COMMENT ON TABLE public.module_ofcs IS
'Stores module-specific OFCs. These are NOT baseline OFCs and are displayed only when module is attached to an assessment.';

COMMENT ON COLUMN public.module_ofcs.batch_id IS
'References the import batch that created this OFC. Nullable for legacy data.';

COMMENT ON COLUMN public.module_ofcs.ofc_id IS
'Unique identifier for the OFC (e.g., EVP_OFC_001). Must be module-specific, NOT IST_OFC IDs.';

COMMENT ON COLUMN public.module_ofcs.order_index IS
'Deterministic ordering of OFCs within the module. Lower numbers appear first.';

-- ============================================================================
-- 4. Create module_ofc_sources table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.module_ofc_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_ofc_id UUID NOT NULL REFERENCES public.module_ofcs(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_label TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_module_ofc_sources_ofc 
  ON public.module_ofc_sources(module_ofc_id);

COMMENT ON TABLE public.module_ofc_sources IS
'Source URLs for module OFCs. Links to external references.';

-- ============================================================================
-- 5. Create assessment_module_question_responses table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assessment_module_question_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  module_code TEXT NOT NULL REFERENCES public.assessment_modules(module_code) ON DELETE CASCADE,
  module_question_id TEXT NOT NULL,
  question_text TEXT NOT NULL,
  response TEXT NOT NULL DEFAULT 'N_A' CHECK (response IN ('YES','NO','N_A')),
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id, module_code, module_question_id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_module_responses_assessment 
  ON public.assessment_module_question_responses(assessment_id);

CREATE INDEX IF NOT EXISTS idx_assessment_module_responses_module 
  ON public.assessment_module_question_responses(module_code);

CREATE INDEX IF NOT EXISTS idx_assessment_module_responses_question 
  ON public.assessment_module_question_responses(module_question_id);

COMMENT ON TABLE public.assessment_module_question_responses IS
'Stores assessment-level responses to module questions. Created when module is attached to an assessment. Separate from baseline responses.';

COMMENT ON COLUMN public.assessment_module_question_responses.module_question_id IS
'References the module question ID (e.g., MODULEQ_EV_CHARGING_001).';

COMMENT ON COLUMN public.assessment_module_question_responses.question_text IS
'Snapshot of question text at time of attachment (for historical accuracy).';

COMMENT ON COLUMN public.assessment_module_question_responses.response IS
'User response: YES, NO, or N_A (default).';

-- ============================================================================
-- 6. Remove baseline_references concept (if table exists)
-- ============================================================================

DROP TABLE IF EXISTS public.module_baseline_references CASCADE;

COMMENT ON SCHEMA public IS
'Module baseline_references table removed. Modules are fully additive and do not reference baseline questions.';

COMMIT;
