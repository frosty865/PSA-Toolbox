-- RUNTIME: Add standard_class to assessment_modules (structure: OBJECT vs PLAN).
-- Standard class controls question/OFC template; topic is module_code/module_title only.
-- Run on RUNTIME database only.

BEGIN;

-- 1) Add standard_class column
ALTER TABLE public.assessment_modules
  ADD COLUMN IF NOT EXISTS standard_class TEXT;

-- 2) Backfill from existing columns if present, else default to PHYSICAL_SECURITY_MEASURES (OBJECT)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_modules' AND column_name = 'module_kind'
  ) THEN
    UPDATE public.assessment_modules
      SET standard_class = CASE
        WHEN UPPER(TRIM(module_kind)) = 'PLAN' THEN 'PHYSICAL_SECURITY_PLAN'
        ELSE 'PHYSICAL_SECURITY_MEASURES'
      END
      WHERE standard_class IS NULL;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessment_modules' AND column_name = 'module_type'
  ) THEN
    UPDATE public.assessment_modules
      SET standard_class = CASE
        WHEN UPPER(TRIM(module_type)) = 'PLAN' THEN 'PHYSICAL_SECURITY_PLAN'
        ELSE 'PHYSICAL_SECURITY_MEASURES'
      END
      WHERE standard_class IS NULL;
  ELSE
    UPDATE public.assessment_modules
      SET standard_class = 'PHYSICAL_SECURITY_MEASURES'
      WHERE standard_class IS NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.assessment_modules.standard_class IS 'Template class: PHYSICAL_SECURITY_MEASURES (OBJECT) or PHYSICAL_SECURITY_PLAN (PLAN). Topic is module_code/title only.';

COMMIT;
