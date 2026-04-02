-- Migration Script: INT-001 -> BASE-INT-INT_ACCESS_RESTRICTED_AREAS
-- Purpose: Replace legacy INT-001 with canonical BASE-* format, preserving better question wording
-- Generated: 2026-01-16

BEGIN;

-- ============================================================================
-- STEP 1: Inspect both rows BEFORE migration
-- ============================================================================
SELECT 
  'BEFORE MIGRATION' AS stage,
  canon_id, 
  discipline_code, 
  subtype_code, 
  question_text, 
  active,
  canon_version
FROM public.baseline_spines_runtime
WHERE canon_id IN ('INT-001', 'BASE-INT-INT_ACCESS_RESTRICTED_AREAS')
ORDER BY canon_id;

-- ============================================================================
-- STEP 2: Copy the better wording from INT-001 into the BASE-* row, and ensure BASE-* is active
-- ============================================================================
UPDATE public.baseline_spines_runtime base
SET
  question_text = legacy.question_text,
  active = true,
  canon_version = COALESCE(base.canon_version, 'baseline_v1')
FROM public.baseline_spines_runtime legacy
WHERE base.canon_id = 'BASE-INT-INT_ACCESS_RESTRICTED_AREAS'
  AND legacy.canon_id = 'INT-001';

-- ============================================================================
-- STEP 3: Deactivate INT-001
-- ============================================================================
UPDATE public.baseline_spines_runtime
SET active = false
WHERE canon_id = 'INT-001';

-- ============================================================================
-- STEP 4: Validate migration results
-- ============================================================================
-- 4a) Show all rows for this subtype (should show BASE-* active, INT-001 inactive)
SELECT 
  'AFTER MIGRATION' AS stage,
  subtype_code, 
  canon_id, 
  left(question_text, 80) AS question_preview, 
  active,
  canon_version
FROM public.baseline_spines_runtime
WHERE subtype_code = 'INT_ACCESS_RESTRICTED_AREAS'
ORDER BY active DESC, canon_id;

-- 4b) Verify exactly one active row for this subtype
SELECT 
  'VALIDATION' AS stage,
  subtype_code, 
  COUNT(*) AS active_rows
FROM public.baseline_spines_runtime
WHERE active=true 
  AND subtype_code='INT_ACCESS_RESTRICTED_AREAS'
GROUP BY subtype_code;

-- Expected: active_rows = 1

COMMIT;

-- ============================================================================
-- NOTES
-- ============================================================================
-- After running this script:
-- 1. BASE-INT-INT_ACCESS_RESTRICTED_AREAS should be active with the INT-001 question text
-- 2. INT-001 should be inactive
-- 3. Only one active row should exist for INT_ACCESS_RESTRICTED_AREAS
-- 4. The question text should be: "Are restricted areas controlled at their entry points?"
