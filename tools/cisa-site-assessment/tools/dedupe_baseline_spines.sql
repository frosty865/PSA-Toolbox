-- Deduplication Script for Baseline Subtype Spines
-- Purpose: Ensure exactly ONE active baseline spine per subtype_code
-- Policy: Keep the most specific question_text, prefer BASE-* canon_ids
-- Generated: 2026-01-16

-- ============================================================================
-- BEFORE: Report duplicates
-- ============================================================================
SELECT 
  'BEFORE DEDUPLICATION' AS stage,
  subtype_code, 
  COUNT(*) AS active_rows,
  array_agg(canon_id ORDER BY canon_id) AS canon_ids
FROM public.baseline_spines_runtime
WHERE active=true 
  AND subtype_code IS NOT NULL 
  AND subtype_code <> ''
GROUP BY subtype_code
HAVING COUNT(*) > 1
ORDER BY active_rows DESC, subtype_code;

-- ============================================================================
-- DEDUPLICATION LOGIC
-- ============================================================================
-- Ranking heuristics (lower rank = better, keep first):
-- 1. Canon ID pattern (STRICT: BASE-* preferred, non-BASE only if allowlisted):
--    - BASE-<DISCIPLINE>-<NUMBER> (e.g., BASE-VSS-001) = rank 0
--    - BASE-<DISCIPLINE>-<SUBTYPE> (e.g., BASE-PER-PER_PEDESTRIAN_ACCESS_CONTROL_POINTS) = rank 1
--    - Other BASE-* patterns = rank 2
--    - Non-BASE patterns (legacy) = rank 10 (heavily penalized, only wins if allowlisted)
-- 2. Question specificity: Non-generic questions rank better (rank 1 vs 2)
--    - Only matters when canon_rank is equal (e.g., both are BASE-*)
-- 3. Tiebreaker: Lexicographic order of canon_id

BEGIN;

WITH ranked AS (
  SELECT
    canon_id,
    subtype_code,
    question_text,
    active,
    -- Question specificity rank: 1 = specific, 2 = generic template
    CASE
      WHEN question_text ~* '^Is (a|an) .* capability implemented\?$' THEN 2
      ELSE 1
    END AS question_rank,
    -- Canon ID pattern rank: lower = better
    -- Non-BASE patterns heavily penalized (rank 10) to prevent legacy creep
    -- Allowlist: Add canon_ids here that should be considered despite non-BASE pattern
    -- (Currently empty - INT-001 will be migrated to BASE-INT-INT_ACCESS_RESTRICTED_AREAS)
    CASE
      -- Pattern: BASE-<DISCIPLINE>-<NUMBER> (e.g., BASE-VSS-001, BASE-PER-001)
      WHEN canon_id ~ '^BASE-[A-Z]{2,5}-\d{1,4}$' THEN 0
      -- Pattern: BASE-<DISCIPLINE>-<SUBTYPE> (e.g., BASE-PER-PER_PEDESTRIAN_ACCESS_CONTROL_POINTS)
      WHEN canon_id ~ '^BASE-[A-Z]{2,5}-[A-Z_]+$' THEN 1
      -- Other BASE-* patterns
      WHEN canon_id LIKE 'BASE-%' THEN 2
      -- Non-BASE patterns (legacy) - heavily penalized unless allowlisted
      -- Allowlist check: Add specific canon_ids here if needed
      WHEN canon_id IN (
        -- Example: 'LEGACY-ID-001'  -- Add allowlisted legacy IDs here
      ) THEN 3  -- Allowlisted legacy IDs get rank 3
      ELSE 10   -- Non-BASE patterns get rank 10 (will lose to any BASE-* pattern)
    END AS canon_rank
  FROM public.baseline_spines_runtime
  WHERE active=true 
    AND subtype_code IS NOT NULL 
    AND subtype_code <> ''
),
keepers AS (
  -- For each subtype_code, keep the row with best ranking
  SELECT DISTINCT ON (subtype_code)
    canon_id AS keep_canon_id,
    subtype_code,
    question_text,
    question_rank,
    canon_rank
  FROM ranked
  ORDER BY 
    subtype_code,
    canon_rank ASC,          -- STRICT: Prefer BASE-* patterns (0-2) over non-BASE (10)
    question_rank ASC,       -- When canon_rank is equal, prefer specific questions (1) over generic (2)
    canon_id ASC             -- Tiebreaker: lexicographic order
)
UPDATE public.baseline_spines_runtime b
SET active = false
FROM ranked r
JOIN keepers k ON k.subtype_code = r.subtype_code
WHERE b.canon_id = r.canon_id
  AND r.canon_id <> k.keep_canon_id
  AND b.active = true;

-- ============================================================================
-- AFTER: Verify no duplicates remain
-- ============================================================================
SELECT 
  'AFTER DEDUPLICATION' AS stage,
  subtype_code, 
  COUNT(*) AS active_rows,
  array_agg(canon_id ORDER BY canon_id) AS canon_ids
FROM public.baseline_spines_runtime
WHERE active=true 
  AND subtype_code IS NOT NULL 
  AND subtype_code <> ''
GROUP BY subtype_code
HAVING COUNT(*) > 1
ORDER BY active_rows DESC, subtype_code;

-- Expected: Zero rows (each subtype_code should have exactly one active row)

-- ============================================================================
-- SUMMARY: Show what was kept for key subtypes
-- ============================================================================
SELECT 
  'KEPT ROWS (Sample)' AS stage,
  subtype_code,
  canon_id,
  left(question_text, 60) AS question_preview,
  CASE
    WHEN question_text ~* '^Is (a|an) .* capability implemented\?$' THEN 'GENERIC'
    ELSE 'SPECIFIC'
  END AS question_type
FROM public.baseline_spines_runtime
WHERE active=true 
  AND subtype_code IS NOT NULL 
  AND subtype_code <> ''
  AND subtype_code IN (
    'PER_VEHICLE_ACCESS_CONTROL_POINTS',
    'PER_PEDESTRIAN_ACCESS_CONTROL_POINTS',
    'INT_ACCESS_RESTRICTED_AREAS'
  )
ORDER BY subtype_code;

COMMIT;

-- ============================================================================
-- NOTES
-- ============================================================================
-- After running this script:
-- 1. Verify the "AFTER DEDUPLICATION" query returns zero rows
-- 2. Check that specific questions are kept (e.g., PER_PEDESTRIAN_ACCESS_CONTROL_POINTS)
-- 3. Confirm legacy canon_ids (e.g., INT-001) are deactivated if BASE-* alternatives exist
-- 4. Verify total subtype-anchored count is now 105 (one per subtype_code)
