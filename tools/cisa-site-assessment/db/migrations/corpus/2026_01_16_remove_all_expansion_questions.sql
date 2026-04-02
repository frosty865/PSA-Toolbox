-- CORPUS: Remove All Expansion Questions
-- Date: 2026-01-16
-- Purpose: Remove all expansion questions from the CORPUS database
--
-- HARD RULE: This migration is for CORPUS project ONLY
-- Do NOT run this on RUNTIME project

-- ============================================================================
-- 1. Delete all expansion questions
-- ============================================================================

-- First, check if there are any related records in corpus_candidate_question_links
-- Note: This table doesn't have a foreign key constraint, but we should clean it up
-- to avoid orphaned references

DELETE FROM public.corpus_candidate_question_links
WHERE universe = 'EXPANSION';

-- Now delete all expansion questions
DELETE FROM public.expansion_questions;

-- ============================================================================
-- 2. Verify deletion
-- ============================================================================

-- Count remaining expansion questions (should be 0)
DO $$
DECLARE
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count FROM public.expansion_questions;
  
  IF remaining_count > 0 THEN
    RAISE EXCEPTION 'Failed to delete all expansion questions. % questions remain.', remaining_count;
  ELSE
    RAISE NOTICE 'Successfully deleted all expansion questions.';
  END IF;
END $$;

COMMENT ON TABLE public.expansion_questions IS
'Expansion questions table (now empty). All questions have been removed.';
