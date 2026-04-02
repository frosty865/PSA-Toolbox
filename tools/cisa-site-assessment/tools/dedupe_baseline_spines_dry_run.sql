-- DRY-RUN: Deduplication Script for Baseline Subtype Spines
-- Purpose: Preview what would be deactivated WITHOUT making changes
-- Run this first to verify the logic before running dedupe_baseline_spines.sql

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
-- PREVIEW: What would be kept vs deactivated
-- ============================================================================
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
    CASE
      -- Pattern: BASE-<DISCIPLINE>-<NUMBER> (e.g., BASE-VSS-001, BASE-PER-001)
      WHEN canon_id ~ '^BASE-[A-Z]{2,5}-\d{1,4}$' THEN 0
      -- Pattern: BASE-<DISCIPLINE>-<SUBTYPE> (e.g., BASE-PER-PER_PEDESTRIAN_ACCESS_CONTROL_POINTS)
      WHEN canon_id ~ '^BASE-[A-Z]{2,5}-[A-Z_]+$' THEN 1
      -- Other BASE-* patterns
      WHEN canon_id LIKE 'BASE-%' THEN 2
      -- Non-BASE patterns (legacy) - heavily penalized unless allowlisted
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
SELECT 
  r.subtype_code,
  CASE 
    WHEN r.canon_id = k.keep_canon_id THEN 'KEEP (active)'
    ELSE 'DEACTIVATE (set active=false)'
  END AS action,
  r.canon_id,
  left(r.question_text, 60) AS question_preview,
  CASE
    WHEN r.question_text ~* '^Is (a|an) .* capability implemented\?$' THEN 'GENERIC'
    ELSE 'SPECIFIC'
  END AS question_type,
  r.question_rank,
  r.canon_rank
FROM ranked r
JOIN keepers k ON k.subtype_code = r.subtype_code
WHERE r.subtype_code IN (
  -- Show all subtypes with duplicates, plus key subtypes mentioned in acceptance
  SELECT subtype_code
  FROM public.baseline_spines_runtime
  WHERE active=true 
    AND subtype_code IS NOT NULL 
    AND subtype_code <> ''
  GROUP BY subtype_code
  HAVING COUNT(*) > 1
  
  UNION
  
  SELECT subtype_code
  FROM public.baseline_spines_runtime
  WHERE active=true 
    AND subtype_code IN (
      'PER_VEHICLE_ACCESS_CONTROL_POINTS',
      'PER_PEDESTRIAN_ACCESS_CONTROL_POINTS',
      'INT_ACCESS_RESTRICTED_AREAS'
    )
)
ORDER BY r.subtype_code, action DESC, r.canon_id;

-- ============================================================================
-- SUMMARY: Count of rows that would be deactivated
-- ============================================================================
WITH ranked AS (
  SELECT
    canon_id,
    subtype_code,
    CASE
      WHEN question_text ~* '^Is (a|an) .* capability implemented\?$' THEN 2
      ELSE 1
    END AS question_rank,
    CASE
      WHEN canon_id ~ '^BASE-[A-Z]{2,5}-\d{1,4}$' THEN 0
      WHEN canon_id ~ '^BASE-[A-Z]{2,5}-[A-Z_]+$' THEN 1
      WHEN canon_id LIKE 'BASE-%' THEN 2
      WHEN canon_id IN (
        -- Example: 'LEGACY-ID-001'  -- Add allowlisted legacy IDs here
      ) THEN 3
      ELSE 10
    END AS canon_rank
  FROM public.baseline_spines_runtime
  WHERE active=true 
    AND subtype_code IS NOT NULL 
    AND subtype_code <> ''
),
keepers AS (
  SELECT DISTINCT ON (subtype_code)
    canon_id AS keep_canon_id,
    subtype_code
  FROM ranked
  ORDER BY subtype_code, canon_rank ASC, question_rank ASC, canon_id ASC
)
SELECT 
  'DRY-RUN SUMMARY' AS stage,
  COUNT(*) AS rows_to_deactivate,
  COUNT(DISTINCT r.subtype_code) AS affected_subtypes
FROM ranked r
JOIN keepers k ON k.subtype_code = r.subtype_code
WHERE r.canon_id <> k.keep_canon_id;
