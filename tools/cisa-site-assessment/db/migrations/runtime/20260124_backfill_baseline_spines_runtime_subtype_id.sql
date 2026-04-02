-- Backfill discipline_subtype_id for baseline spines
-- Date: 2026-01-24
-- Purpose: Backfill discipline_subtype_id using subtype_code mapping to discipline_subtypes.code
-- 
-- IMPORTANT: This migration MUST run against RUNTIME database only
-- Run with: npx tsx tools/run_sql.ts db/migrations/runtime/20260124_backfill_baseline_spines_runtime_subtype_id.sql

BEGIN;

-- ============================================================================
-- Backfill discipline_subtype_id using subtype_code mapping
-- ============================================================================
-- Maps baseline_spines_runtime.subtype_code to discipline_subtypes.code
-- Only updates rows where discipline_subtype_id IS NULL

UPDATE public.baseline_spines_runtime b
SET discipline_subtype_id = ds.id
FROM public.discipline_subtypes ds
WHERE b.discipline_subtype_id IS NULL
  AND b.subtype_code IS NOT NULL
  AND ds.code = b.subtype_code
  AND ds.is_active = true;

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 
  COUNT(*) FILTER (WHERE discipline_subtype_id IS NOT NULL) as bound_count,
  COUNT(*) FILTER (WHERE discipline_subtype_id IS NULL AND subtype_code IS NOT NULL) as unbound_with_subtype_code,
  COUNT(*) FILTER (WHERE discipline_subtype_id IS NULL AND subtype_code IS NULL) as unbound_no_subtype_code,
  COUNT(*) as total_rows
FROM public.baseline_spines_runtime;

COMMIT;
