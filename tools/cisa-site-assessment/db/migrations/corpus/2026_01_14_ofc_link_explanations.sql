-- CORPUS: Add Link Explanations to OFC Question Links
-- Date: 2026-01-14
-- Purpose: Add link_explanation and link_method columns for HYBRID_V3 linking
--
-- HARD RULE: This migration is for CORPUS project ONLY
-- Do NOT run this on RUNTIME project

-- ============================================================================
-- 1. Add link_explanation JSONB column
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'ofc_question_links'
    AND column_name = 'link_explanation'
  ) THEN
    ALTER TABLE ofc_question_links
      ADD COLUMN link_explanation JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ============================================================================
-- 2. Add link_method TEXT column
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'ofc_question_links'
    AND column_name = 'link_method'
  ) THEN
    ALTER TABLE ofc_question_links
      ADD COLUMN link_method TEXT NOT NULL DEFAULT 'HYBRID_V3';
  END IF;
END $$;

-- ============================================================================
-- 3. Comments
-- ============================================================================

COMMENT ON COLUMN ofc_question_links.link_explanation IS
'JSONB explanation of why this link was created (variant used, scores, method). CORPUS project only.';

COMMENT ON COLUMN ofc_question_links.link_method IS
'Linking method used: HYBRID_V3, TFIDF_V2, etc. CORPUS project only.';
