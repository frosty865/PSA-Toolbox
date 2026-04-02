-- Migration: Add status column to assessment_modules
-- Date: 2026-01-22
-- Purpose: Support DRAFT status for modules without imported content
--
-- HARD RULE: This migration is for RUNTIME project ONLY
-- Do NOT run this on CORPUS project

BEGIN;

-- Add status column if it doesn't exist
ALTER TABLE public.assessment_modules
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE'
  CHECK (status IN ('DRAFT', 'ACTIVE'));

-- Update existing modules: if they have questions or OFCs, set to ACTIVE; otherwise DRAFT
UPDATE public.assessment_modules
SET status = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.module_questions WHERE module_code = assessment_modules.module_code
  ) OR EXISTS (
    SELECT 1 FROM public.module_ofcs WHERE module_code = assessment_modules.module_code
  )
  THEN 'ACTIVE'
  ELSE 'DRAFT'
END;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_assessment_modules_status 
  ON public.assessment_modules(status);

COMMENT ON COLUMN public.assessment_modules.status IS
'Module status: DRAFT = metadata only, no imported content; ACTIVE = has imported questions/OFCs and can be attached to assessments.';

COMMIT;
