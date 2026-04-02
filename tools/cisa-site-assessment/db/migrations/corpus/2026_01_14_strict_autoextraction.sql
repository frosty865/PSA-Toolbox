-- CORPUS: Strict Autoextraction Reset (Phase 1)
-- Date: 2026-01-14
-- Purpose: Add strict classification and promotion bucket columns to question_candidate_queue
--
-- HARD RULE: This migration is for CORPUS project ONLY
-- Do NOT run this on RUNTIME project

-- ============================================================================
-- 1. Create question_candidate_queue if it doesn't exist
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='question_candidate_queue') THEN
    CREATE TABLE question_candidate_queue (
      candidate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_set TEXT NOT NULL,
      document_id UUID NOT NULL,
      locator_type TEXT NOT NULL,
      locator TEXT NOT NULL,
      question_text TEXT NOT NULL,
      context TEXT NOT NULL DEFAULT '',
      mined_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- ============================================================================
-- 2. Add strict classification columns
-- ============================================================================

ALTER TABLE question_candidate_queue
  ADD COLUMN IF NOT EXISTS methodology_type TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS psa_scope_ok BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS needs_rewrite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rewrite_text TEXT,
  ADD COLUMN IF NOT EXISTS rewrite_rationale TEXT,
  ADD COLUMN IF NOT EXISTS has_citable_ofc BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_ofc_candidate_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS promotion_bucket TEXT NOT NULL DEFAULT 'CONTEXT_ONLY';
  -- PROMOTABLE | BASELINE_REVISION | CONTEXT_ONLY

-- ============================================================================
-- 3. Add indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_qcq_bucket ON question_candidate_queue(source_set, promotion_bucket);
CREATE INDEX IF NOT EXISTS idx_qcq_method ON question_candidate_queue(source_set, methodology_type);

-- ============================================================================
-- 4. Comments
-- ============================================================================

COMMENT ON COLUMN question_candidate_queue.methodology_type IS
'Question type classification: YESNO, CHECKLIST, OPEN_ENDED, FRAGMENT, NON_PHYSICAL, CONTEXT_ONLY, UNKNOWN. CORPUS project only.';

COMMENT ON COLUMN question_candidate_queue.psa_scope_ok IS
'Whether question is within PSA physical security scope. CORPUS project only.';

COMMENT ON COLUMN question_candidate_queue.needs_rewrite IS
'Whether question text needs reframing to preserve meaning. CORPUS project only.';

COMMENT ON COLUMN question_candidate_queue.rewrite_text IS
'Reframed question text (if needs_rewrite=true). CORPUS project only.';

COMMENT ON COLUMN question_candidate_queue.rewrite_rationale IS
'Explanation for rewrite. CORPUS project only.';

COMMENT ON COLUMN question_candidate_queue.has_citable_ofc IS
'Whether at least one citable OFC exists in the same control area. CORPUS project only.';

COMMENT ON COLUMN question_candidate_queue.linked_ofc_candidate_ids IS
'Array of OFC candidate IDs linked to this question (within 1 page). CORPUS project only.';

COMMENT ON COLUMN question_candidate_queue.promotion_bucket IS
'Promotion routing: PROMOTABLE (admin review), BASELINE_REVISION (manual only), CONTEXT_ONLY (learning corpus). CORPUS project only.';
