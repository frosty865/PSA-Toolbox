-- Restore discipline_subtypes table from archive
-- Date: 2026-01-16
-- Purpose: Recreate discipline_subtypes table that was accidentally dropped
--
-- This migration:
-- 1. Creates the discipline_subtypes table if it doesn't exist
-- 2. Data should be imported using: npx tsx tools/restore_discipline_subtypes.ts
--
-- HARD RULE: This migration is for RUNTIME project ONLY

-- ============================================================================
-- 1. Create discipline_subtypes table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.discipline_subtypes (
  id uuid PRIMARY KEY,
  discipline_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  code text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  overview text,
  indicators_of_risk text[],
  common_failures text[],
  assessment_questions text[],
  mitigation_guidance text[],
  standards_references text[],
  psa_notes text,
  
  CONSTRAINT fk_discipline_subtypes_discipline
    FOREIGN KEY (discipline_id)
    REFERENCES public.disciplines(id)
    ON DELETE RESTRICT
);

-- ============================================================================
-- 2. Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_discipline_subtypes_discipline_id
  ON public.discipline_subtypes(discipline_id);

CREATE INDEX IF NOT EXISTS idx_discipline_subtypes_code
  ON public.discipline_subtypes(code)
  WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_discipline_subtypes_active
  ON public.discipline_subtypes(is_active)
  WHERE is_active = true;

-- ============================================================================
-- 3. Add comments
-- ============================================================================

COMMENT ON TABLE public.discipline_subtypes IS
'Discipline subtypes - detailed categorization within each discipline. Restored from taxonomy/discipline_subtypes.json archive.';

COMMENT ON COLUMN public.discipline_subtypes.code IS
'Stable subtype code identifier (format: DISCIPLINE_CODE_SUBTYPE_SLUG). Maps to subtype_code field in archive JSON.';

-- ============================================================================
-- 4. Next steps
-- ============================================================================
-- After running this migration, import data using:
--   npx tsx tools/restore_discipline_subtypes.ts
--
-- This will restore all 104 discipline subtypes from taxonomy/discipline_subtypes.json
