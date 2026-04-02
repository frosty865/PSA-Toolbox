-- Migration: Add help_text column to baseline_spines_runtime
-- Generated: 2026-01-16
-- Purpose: Add optional help text to clarify baseline question intent

ALTER TABLE public.baseline_spines_runtime
ADD COLUMN IF NOT EXISTS help_text TEXT;

COMMENT ON COLUMN public.baseline_spines_runtime.help_text IS
'Optional plain-language guidance describing intent and what constitutes YES for this baseline question. PSA physical security scope only.';

-- ============================================================================
-- RUNBOOK
-- ============================================================================
-- 1. Execute this migration in Supabase SQL Editor
-- 2. Verify column exists:
--    SELECT column_name, data_type, is_nullable 
--    FROM information_schema.columns 
--    WHERE table_name = 'baseline_spines_runtime' AND column_name = 'help_text';
-- 3. Run backfill script to populate default help text:
--    node tools/backfill_baseline_help_text.ts --dry-run  (preview)
--    node tools/backfill_baseline_help_text.ts             (apply)
