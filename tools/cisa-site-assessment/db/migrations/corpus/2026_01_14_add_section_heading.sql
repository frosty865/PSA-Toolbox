-- CORPUS: Add Section Heading Support
-- Date: 2026-01-14
-- Purpose: Add section_heading columns to chunks and candidates for better linkage
--
-- HARD RULE: This migration is for CORPUS project ONLY
-- Do NOT run this on RUNTIME project

-- ============================================================================
-- 1. Add section_heading to document_chunks
-- ============================================================================

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS section_heading TEXT;

-- ============================================================================
-- 2. Add section_heading to ofc_candidate_queue
-- ============================================================================

ALTER TABLE ofc_candidate_queue
  ADD COLUMN IF NOT EXISTS section_heading TEXT;

-- ============================================================================
-- 3. Add section_heading to question_candidate_queue
-- ============================================================================

ALTER TABLE question_candidate_queue
  ADD COLUMN IF NOT EXISTS section_heading TEXT;

-- ============================================================================
-- 4. Add indexes for heading-based queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_chunks_heading ON document_chunks(document_id, section_heading);
CREATE INDEX IF NOT EXISTS idx_ofc_heading ON ofc_candidate_queue(document_id, section_heading);
CREATE INDEX IF NOT EXISTS idx_q_heading ON question_candidate_queue(document_id, section_heading);

-- ============================================================================
-- 5. Comments
-- ============================================================================

COMMENT ON COLUMN document_chunks.section_heading IS
'Section heading extracted from document (best-effort). Used for semantic linkage. CORPUS project only.';

COMMENT ON COLUMN ofc_candidate_queue.section_heading IS
'Section heading where OFC candidate was found. Used for semantic linkage. CORPUS project only.';

COMMENT ON COLUMN question_candidate_queue.section_heading IS
'Section heading where question candidate was found. Used for semantic linkage. CORPUS project only.';
