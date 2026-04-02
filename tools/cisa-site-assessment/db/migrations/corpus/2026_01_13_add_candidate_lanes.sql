-- CORPUS: Add Candidate Lanes for Derived Questions
-- Date: 2026-01-13
-- Purpose: Add lane routing to protect baseline questions and categorize derived questions
--
-- HARD RULE: This migration is for CORPUS project ONLY
-- Do NOT run this on RUNTIME project

-- ============================================================================
-- 1. Add lane columns to question_candidate_queue
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'question_candidate_queue' 
        AND column_name = 'lane'
    ) THEN
        ALTER TABLE public.question_candidate_queue
        ADD COLUMN lane TEXT NOT NULL DEFAULT 'EXPANSION'
            CHECK (lane IN ('EXPANSION', 'BASELINE_REVISION_CANDIDATE', 'CONTEXT_ONLY'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'question_candidate_queue' 
        AND column_name = 'general_applicability_score'
    ) THEN
        ALTER TABLE public.question_candidate_queue
        ADD COLUMN general_applicability_score NUMERIC NOT NULL DEFAULT 0.0
            CHECK (general_applicability_score >= 0.0 AND general_applicability_score <= 1.0);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'question_candidate_queue' 
        AND column_name = 'lane_reason'
    ) THEN
        ALTER TABLE public.question_candidate_queue
        ADD COLUMN lane_reason TEXT NULL;
    END IF;
END $$;

-- ============================================================================
-- 2. Add indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_qcand_lane 
    ON public.question_candidate_queue(source_set, lane);

CREATE INDEX IF NOT EXISTS idx_qcand_general_app 
    ON public.question_candidate_queue(source_set, general_applicability_score);

-- ============================================================================
-- 3. Comments
-- ============================================================================

COMMENT ON COLUMN public.question_candidate_queue.lane IS
'Routing lane: EXPANSION (overlay-specific), BASELINE_REVISION_CANDIDATE (general but not auto-promoted), CONTEXT_ONLY (facility info). CORPUS project only.';

COMMENT ON COLUMN public.question_candidate_queue.general_applicability_score IS
'Heuristic score 0..1 indicating how generally applicable the question is across facilities. CORPUS project only.';

COMMENT ON COLUMN public.question_candidate_queue.lane_reason IS
'Explanation for lane assignment. CORPUS project only.';

