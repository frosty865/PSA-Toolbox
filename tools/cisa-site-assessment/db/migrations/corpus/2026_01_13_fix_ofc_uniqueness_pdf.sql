-- CORPUS: Fix OFC Candidate Uniqueness for PDF Pages
-- Date: 2026-01-13
-- Purpose: Allow multiple OFC candidates on the same PDF page locator
--          by including candidate_hash in uniqueness constraint
--
-- HARD RULE: This migration is for CORPUS project ONLY
-- Do NOT run this on RUNTIME project

-- ============================================================================
-- 1. Drop old locator-only unique constraint if it exists
-- ============================================================================

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find unique constraint on (source_set, document_id, locator_type, locator, field_name)
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.ofc_candidate_queue'::regclass
        AND contype = 'u'
        AND conname = 'uq_ofc_candidate_queue_locator';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.ofc_candidate_queue DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END IF;
END $$;

-- ============================================================================
-- 2. Create new unique constraint including candidate_hash
-- ============================================================================

-- This allows multiple distinct OFC candidates on the same page
-- Uniqueness: (source_set, document_id, locator_type, locator, field_name, candidate_hash)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.ofc_candidate_queue'::regclass
        AND conname = 'uq_ofc_candidate_queue_locator_hash'
    ) THEN
        ALTER TABLE public.ofc_candidate_queue
        ADD CONSTRAINT uq_ofc_candidate_queue_locator_hash
        UNIQUE(source_set, document_id, locator_type, locator, field_name, candidate_hash);
    END IF;
END $$;

-- ============================================================================
-- 3. Comments
-- ============================================================================

COMMENT ON CONSTRAINT uq_ofc_candidate_queue_locator_hash ON public.ofc_candidate_queue IS
'Ensures candidates are unique by location AND content hash. Allows multiple distinct OFCs on the same page.';

