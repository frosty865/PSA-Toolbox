-- Verification Script for Baseline Subtype v1 Seed
-- Run this AFTER executing baseline_subtype_v1_seed.sql
-- Expected results:
--   - subtype_anchored_rows = 105
--   - No duplicate subtype_code entries
--   - PER_PEDESTRIAN_ACCESS_CONTROL_POINTS exists

-- ============================================================================
-- STEP 2: VERIFY DB COUNTS
-- ============================================================================
SELECT
  COUNT(*) AS total_rows,
  SUM(CASE WHEN active=true THEN 1 ELSE 0 END) AS active_rows,
  SUM(CASE WHEN subtype_code IS NOT NULL AND subtype_code <> '' THEN 1 ELSE 0 END) AS subtype_anchored_rows
FROM public.baseline_spines_runtime;

-- Expected: subtype_anchored_rows should equal 105 (taxonomy_count)

-- ============================================================================
-- UNIQUENESS CHECK (should return zero rows)
-- ============================================================================
SELECT subtype_code, COUNT(*) AS rows_per_subtype
FROM public.baseline_spines_runtime
WHERE active=true AND subtype_code IS NOT NULL AND subtype_code <> ''
GROUP BY subtype_code
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- Expected: Zero rows (one baseline spine per subtype_code)

-- ============================================================================
-- SPOT CHECK: Verify PER_PEDESTRIAN_ACCESS_CONTROL_POINTS exists
-- ============================================================================
SELECT 
  canon_id, 
  discipline_code, 
  subtype_code, 
  left(question_text, 80) AS preview, 
  canon_version,
  active
FROM public.baseline_spines_runtime
WHERE subtype_code = 'PER_PEDESTRIAN_ACCESS_CONTROL_POINTS';

-- Expected: 1 row with active=true

-- ============================================================================
-- SAMPLE: Show a few PER subtype entries
-- ============================================================================
SELECT 
  canon_id, 
  discipline_code, 
  subtype_code, 
  left(question_text, 80) AS preview
FROM public.baseline_spines_runtime
WHERE discipline_code = 'PER' 
  AND subtype_code IS NOT NULL 
  AND subtype_code <> ''
ORDER BY subtype_code
LIMIT 10;

-- Expected: Multiple PER subtype entries including PER_PEDESTRIAN_ACCESS_CONTROL_POINTS

-- ============================================================================
-- COUNT BY DISCIPLINE
-- ============================================================================
SELECT 
  discipline_code,
  COUNT(*) AS total_subtype_spines
FROM public.baseline_spines_runtime
WHERE active=true 
  AND subtype_code IS NOT NULL 
  AND subtype_code <> ''
GROUP BY discipline_code
ORDER BY discipline_code;

-- Expected: Multiple disciplines with subtype-anchored baseline spines
