-- Investigation Script: Why 111 subtype-anchored rows instead of 105?
-- Expected: 105 (from baseline_subtype_v1_seed.sql)
-- Actual: 111 (from verification query)
-- Difference: 6 extra rows

-- ============================================================================
-- CHECK FOR DUPLICATES (should return zero rows)
-- ============================================================================
SELECT subtype_code, COUNT(*) AS rows_per_subtype
FROM public.baseline_spines_runtime
WHERE active=true AND subtype_code IS NOT NULL AND subtype_code <> ''
GROUP BY subtype_code
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- If this returns rows, we have duplicates that need to be resolved

-- ============================================================================
-- CHECK PER DISCIPLINE SUBTYPES (expected: 9, actual: 11)
-- ============================================================================
SELECT 
  subtype_code,
  canon_id,
  active
FROM public.baseline_spines_runtime
WHERE discipline_code = 'PER' 
  AND subtype_code IS NOT NULL 
  AND subtype_code <> ''
ORDER BY subtype_code;

-- Expected PER subtypes (from audit):
-- 1. PER_BOLLARDS_BARRIERS
-- 2. PER_BOUNDARY_DEMARCATION
-- 3. PER_CLEAR_ZONES
-- 4. PER_FENCING
-- 5. PER_GATES
-- 6. PER_PEDESTRIAN_ACCESS_CONTROL_POINTS
-- 7. PER_PERIMETER_LIGHTING
-- 8. PER_PERIMETER_SIGNAGE
-- 9. PER_VEHICLE_ACCESS_CONTROL_POINTS

-- ============================================================================
-- FIND SUBTYPES NOT IN THE SEED (compare against audit list)
-- ============================================================================
-- This query helps identify which subtypes exist in DB but weren't in the seed
SELECT 
  discipline_code,
  subtype_code,
  canon_id,
  active
FROM public.baseline_spines_runtime
WHERE active=true 
  AND subtype_code IS NOT NULL 
  AND subtype_code <> ''
ORDER BY discipline_code, subtype_code;

-- Manually compare this list against the 105 subtypes in baseline_subtype_v1_audit.json
-- Look for subtypes that appear in DB but not in the audit's generated_subtypes list

-- ============================================================================
-- CHECK FOR INACTIVE ROWS THAT MIGHT BE COUNTED
-- ============================================================================
SELECT 
  COUNT(*) AS inactive_subtype_rows
FROM public.baseline_spines_runtime
WHERE active=false 
  AND subtype_code IS NOT NULL 
  AND subtype_code <> '';

-- Expected: 0 (seed only creates active=true rows)

-- ============================================================================
-- CHECK CANON_ID PATTERNS (to identify seed vs pre-existing rows)
-- ============================================================================
-- Seed uses format: BASE-<DISCIPLINE>-<SUBTYPE_CODE>
-- Check if all canon_ids match this pattern
SELECT 
  COUNT(*) AS total_subtype_rows,
  COUNT(*) FILTER (WHERE canon_id LIKE 'BASE-%') AS matches_seed_pattern,
  COUNT(*) FILTER (WHERE canon_id NOT LIKE 'BASE-%') AS different_pattern
FROM public.baseline_spines_runtime
WHERE active=true 
  AND subtype_code IS NOT NULL 
  AND subtype_code <> '';

-- All rows should match 'BASE-%' pattern if they came from the seed

-- ============================================================================
-- IDENTIFY THE ROW WITH DIFFERENT PATTERN
-- ============================================================================
SELECT 
  canon_id,
  discipline_code,
  subtype_code,
  active
FROM public.baseline_spines_runtime
WHERE active=true 
  AND subtype_code IS NOT NULL 
  AND subtype_code <> ''
  AND canon_id NOT LIKE 'BASE-%';

-- This shows the 1 row that doesn't match the seed pattern

-- ============================================================================
-- CHECK FOR DUPLICATE SUBTYPE_CODES (same subtype, different canon_ids)
-- ============================================================================
-- This finds subtypes that appear multiple times with different canon_ids
SELECT 
  subtype_code,
  COUNT(*) AS count,
  array_agg(canon_id ORDER BY canon_id) AS canon_ids
FROM public.baseline_spines_runtime
WHERE active=true 
  AND subtype_code IS NOT NULL 
  AND subtype_code <> ''
GROUP BY subtype_code
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- If this returns rows, we have duplicate subtype_codes with different canon_ids
-- This would explain why we have 110+ rows instead of 105
