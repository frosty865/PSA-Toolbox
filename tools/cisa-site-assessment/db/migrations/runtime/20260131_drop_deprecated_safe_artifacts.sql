-- Drop Deprecated SAFE Artifacts (Runtime)
-- Date: 2026-01-31
-- Purpose: Remove deprecated SAFE-related tables/columns if they exist.
-- Idempotent: safe to run multiple times.
--
-- Add explicit table/column names below as they are discovered in the DB.
-- Do not guess; only uncomment and run for confirmed deprecated objects.

BEGIN;

-- Example placeholders: replace only with confirmed deprecated objects.
-- DROP TABLE IF EXISTS public.safe_assessment_templates;
-- DROP TABLE IF EXISTS public.safe_controls;
-- ALTER TABLE public.assessments DROP COLUMN IF EXISTS safe_version;

COMMIT;
