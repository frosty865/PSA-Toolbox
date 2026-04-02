-- Bind Rekeying Procedures baseline question to discipline_subtype_id
-- Date: 2026-01-24
-- Purpose: Bind BASE-KEY-KEY_REKEYING_PROCEDURES question to Rekeying Procedures subtype
-- 
-- IMPORTANT: This migration MUST run against RUNTIME database only
-- Run with: npx tsx tools/run_sql.ts db/migrations/runtime/20260124_0012_bind_rekeying_procedures_question_to_subtype.sql

-- ============================================================================
-- Update question to bind to discipline_subtype_id
-- ============================================================================

UPDATE public.baseline_spines_runtime
SET discipline_subtype_id = '20d11544-f449-46f2-9aa8-39cfcf8a134b'
WHERE canon_id = 'BASE-KEY-KEY_REKEYING_PROCEDURES'
  AND discipline_subtype_id IS NULL;

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 
  canon_id,
  discipline_code,
  subtype_code,
  discipline_subtype_id,
  CASE 
    WHEN discipline_subtype_id = '20d11544-f449-46f2-9aa8-39cfcf8a134b' THEN 'BOUND'
    WHEN discipline_subtype_id IS NOT NULL THEN 'BOUND_TO_DIFFERENT_SUBTYPE'
    ELSE 'NOT_BOUND'
  END as binding_status
FROM public.baseline_spines_runtime
WHERE canon_id = 'BASE-KEY-KEY_REKEYING_PROCEDURES';
