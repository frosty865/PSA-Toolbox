-- CORPUS: OFC to Question Links
-- Date: 2026-01-14
-- Purpose: Store links between OFC candidates and assessment questions (BASE + EXPANSION)
--
-- HARD RULE: This migration is for CORPUS project ONLY
-- Do NOT run this on RUNTIME project

-- ============================================================================
-- 1. Create ofc_question_links table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ofc_question_links (
  link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_set TEXT NOT NULL,
  scope_code TEXT NOT NULL DEFAULT 'BASELINE', -- 'BASELINE' or SUBSECTOR/SECTOR codes later
  question_code TEXT NOT NULL,
  ofc_candidate_id UUID NOT NULL REFERENCES ofc_candidate_queue(candidate_id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
  locator_type TEXT NOT NULL,
  locator TEXT NOT NULL,
  similarity_score DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. Add indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_oql_source_question
  ON ofc_question_links(source_set, scope_code, question_code);

CREATE INDEX IF NOT EXISTS idx_oql_ofc
  ON ofc_question_links(ofc_candidate_id);

CREATE INDEX IF NOT EXISTS idx_oql_score
  ON ofc_question_links(similarity_score DESC);

-- ============================================================================
-- 3. Comments
-- ============================================================================

COMMENT ON TABLE ofc_question_links IS
'Links OFC candidates to assessment questions (BASE + EXPANSION). Used for evidence coverage analysis. CORPUS project only.';

COMMENT ON COLUMN ofc_question_links.scope_code IS
'Question scope: BASELINE (universal) or sector/subsector codes for expansion questions. CORPUS project only.';

COMMENT ON COLUMN ofc_question_links.question_code IS
'Question identifier from baseline_questions or expansion_questions table. CORPUS project only.';

COMMENT ON COLUMN ofc_question_links.similarity_score IS
'TF-IDF cosine similarity score between OFC text and question text. CORPUS project only.';
