-- Migration: Create Assessment Modules as First-Class Objects
-- Date: 2026-01-21
-- Purpose: Create tables for assessment modules, module questions, and module instances
--
-- HARD RULE: This migration is for RUNTIME project ONLY
-- Do NOT run this on CORPUS project

-- ============================================================================
-- 1. Create assessment_modules table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assessment_modules (
  module_code TEXT PRIMARY KEY,
  module_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  CONSTRAINT module_code_format CHECK (module_code ~ '^MODULE_[A-Z0-9_]+$')
);

COMMENT ON TABLE public.assessment_modules IS
'Stores assessment module definitions. Modules are optional, additive question sets that can be included in assessments.';

COMMENT ON COLUMN public.assessment_modules.module_code IS
'Unique module identifier. Must start with "MODULE_" and contain only uppercase letters, numbers, and underscores.';

COMMENT ON COLUMN public.assessment_modules.module_name IS
'Human-readable module name (e.g., "Public Venue Crowd Management").';

COMMENT ON COLUMN public.assessment_modules.description IS
'Optional description of the module purpose and scope.';

COMMENT ON COLUMN public.assessment_modules.is_active IS
'Soft delete flag. Set to false to disable a module without deleting it.';

-- ============================================================================
-- 2. Create assessment_module_questions table
-- ============================================================================

-- Create table without FK constraint first (baseline_spines_runtime may not exist)
CREATE TABLE IF NOT EXISTS public.assessment_module_questions (
  module_code TEXT NOT NULL REFERENCES public.assessment_modules(module_code) ON DELETE CASCADE,
  question_canon_id TEXT NOT NULL,
  question_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  PRIMARY KEY (module_code, question_canon_id)
);

-- Add FK constraint to baseline_spines_runtime if that table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'baseline_spines_runtime'
  ) THEN
    -- Check if FK constraint already exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'assessment_module_questions_question_canon_id_fkey'
    ) THEN
      ALTER TABLE public.assessment_module_questions
      ADD CONSTRAINT assessment_module_questions_question_canon_id_fkey
      FOREIGN KEY (question_canon_id) 
      REFERENCES public.baseline_spines_runtime(canon_id) 
      ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assessment_module_questions_module_code 
  ON public.assessment_module_questions(module_code);

CREATE INDEX IF NOT EXISTS idx_assessment_module_questions_canon_id 
  ON public.assessment_module_questions(question_canon_id);

COMMENT ON TABLE public.assessment_module_questions IS
'Links modules to their constituent questions. Many-to-many relationship between modules and baseline questions.';

COMMENT ON COLUMN public.assessment_module_questions.question_order IS
'Deterministic ordering of questions within the module. Lower numbers appear first.';

-- ============================================================================
-- 3. Create assessment_module_instances table
-- ============================================================================

-- Create table without FK constraint first (assessments may not exist)
CREATE TABLE IF NOT EXISTS public.assessment_module_instances (
  assessment_id UUID NOT NULL,
  module_code TEXT NOT NULL REFERENCES public.assessment_modules(module_code) ON DELETE CASCADE,
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enabled_by UUID,
  
  PRIMARY KEY (assessment_id, module_code)
);

-- Add FK constraint to assessments if that table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'assessments'
  ) THEN
    -- Check if FK constraint already exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'assessment_module_instances_assessment_id_fkey'
    ) THEN
      ALTER TABLE public.assessment_module_instances
      ADD CONSTRAINT assessment_module_instances_assessment_id_fkey
      FOREIGN KEY (assessment_id) 
      REFERENCES public.assessments(id) 
      ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assessment_module_instances_assessment_id 
  ON public.assessment_module_instances(assessment_id);

CREATE INDEX IF NOT EXISTS idx_assessment_module_instances_module_code 
  ON public.assessment_module_instances(module_code);

COMMENT ON TABLE public.assessment_module_instances IS
'Links assessments to enabled modules. Many-to-many relationship. Removing a module instance does not delete assessment responses.';

COMMENT ON COLUMN public.assessment_module_instances.enabled_at IS
'Timestamp when the module was enabled for this assessment.';

-- ============================================================================
-- 4. Add constraints and validation
-- ============================================================================

-- Ensure module_code uniqueness is enforced (already enforced by PRIMARY KEY)
-- Ensure question_canon_id references valid baseline questions (enforced by FOREIGN KEY)
-- Ensure assessment_id references valid assessments (enforced by FOREIGN KEY)

-- ============================================================================
-- 5. Create helper functions
-- ============================================================================

-- Function to validate module code format
CREATE OR REPLACE FUNCTION validate_module_code(code TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN code ~ '^MODULE_[A-Z0-9_]+$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION validate_module_code IS
'Validates that a module code follows the required format (MODULE_ prefix, uppercase, alphanumeric + underscore).';
