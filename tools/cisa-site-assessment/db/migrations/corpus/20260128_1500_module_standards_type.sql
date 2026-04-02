-- CORPUS: Add standard_type (OBJECT | PLAN) to module_standards
-- Run on CORPUS database only.
-- Run after 20260126_1200_module_standards.sql

BEGIN;

-- Add column (nullable first for safe backfill)
ALTER TABLE public.module_standards
ADD COLUMN IF NOT EXISTS standard_type text;

-- Backfill: default existing standards to OBJECT
UPDATE public.module_standards
SET standard_type = COALESCE(standard_type, 'OBJECT');

-- Enforce allowed values (idempotent: skip if constraint already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'module_standards' AND c.conname = 'module_standards_standard_type_chk'
  ) THEN
    ALTER TABLE public.module_standards
    ADD CONSTRAINT module_standards_standard_type_chk
    CHECK (standard_type IN ('OBJECT', 'PLAN'));
  END IF;
END $$;

-- Make required
ALTER TABLE public.module_standards
ALTER COLUMN standard_type SET NOT NULL;

-- Helpful index for filtering
CREATE INDEX IF NOT EXISTS idx_module_standards_status_type
ON public.module_standards (status, standard_type);

COMMIT;
