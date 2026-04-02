-- Migration: Add discipline_subtype_id to baseline_spines_runtime
-- Purpose: Enable UUID-to-UUID subtype matching between questions and OFCs
-- Date: 2026-02-02
-- 
-- This migration:
-- 1. Adds discipline_subtype_id UUID column to baseline_spines_runtime
-- 2. Backfills discipline_subtype_id from subtype_code via discipline_subtypes.code
-- 3. Adds index for join performance
-- 4. Adds FK constraint (deferrable, not enforced on legacy rows)

-- ============================================================================
-- 1. Add discipline_subtype_id column
-- ============================================================================

ALTER TABLE public.baseline_spines_runtime
ADD COLUMN IF NOT EXISTS discipline_subtype_id UUID;

-- ============================================================================
-- 2. Backfill discipline_subtype_id from subtype_code
-- ============================================================================

UPDATE public.baseline_spines_runtime q
SET discipline_subtype_id = ds.id
FROM public.discipline_subtypes ds
WHERE q.subtype_code = ds.code
  AND q.discipline_subtype_id IS NULL
  AND q.subtype_code IS NOT NULL;

-- ============================================================================
-- 3. Add index for join performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_baseline_spines_runtime_discipline_subtype_id
  ON public.baseline_spines_runtime(discipline_subtype_id)
  WHERE discipline_subtype_id IS NOT NULL;

-- ============================================================================
-- 4. Add FK constraint (deferrable, not enforced on legacy rows)
-- ============================================================================

-- Check if constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_baseline_spines_runtime_discipline_subtype'
  ) THEN
    ALTER TABLE public.baseline_spines_runtime
    ADD CONSTRAINT fk_baseline_spines_runtime_discipline_subtype
      FOREIGN KEY (discipline_subtype_id)
      REFERENCES public.discipline_subtypes(id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- ============================================================================
-- 5. Add comment
-- ============================================================================

COMMENT ON COLUMN public.baseline_spines_runtime.discipline_subtype_id IS
'UUID reference to discipline_subtypes.id. Used for subtype matching with OFCs. Backfilled from subtype_code via discipline_subtypes.code.';
