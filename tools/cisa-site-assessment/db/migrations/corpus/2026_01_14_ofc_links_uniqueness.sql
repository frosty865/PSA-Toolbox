-- CORPUS: Enforce OFC Question Links Uniqueness
-- Date: 2026-01-14
-- Purpose: Add uniqueness constraint and indexes to prevent duplicate links
--
-- HARD RULE: This migration is for CORPUS project ONLY
-- Do NOT run this on RUNTIME project

-- ============================================================================
-- 1. Add uniqueness constraint
-- ============================================================================

DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_ofc_question_links_identity'
  ) THEN
    ALTER TABLE ofc_question_links
      ADD CONSTRAINT uq_ofc_question_links_identity
      UNIQUE (source_set, link_method, question_code, ofc_candidate_id);
  END IF;
END $$;

-- ============================================================================
-- 2. Add helpful indexes
-- ============================================================================

-- Index for source_set + link_method + question_code queries
CREATE INDEX IF NOT EXISTS idx_ofc_links_ss_method_q
  ON ofc_question_links(source_set, link_method, question_code);

-- Index for score-based queries
CREATE INDEX IF NOT EXISTS idx_ofc_links_score
  ON ofc_question_links(source_set, link_method, similarity_score DESC);

-- ============================================================================
-- 3. Comments
-- ============================================================================

COMMENT ON CONSTRAINT uq_ofc_question_links_identity ON ofc_question_links IS
'Ensures no duplicate links: same source_set + link_method + question_code + ofc_candidate_id. CORPUS project only.';
