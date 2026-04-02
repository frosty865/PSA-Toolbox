-- Wipe OFC Data Migration
-- Date: 2025-01-13
-- Purpose: Clear all OFC-related data because they no longer match current baseline questions
-- 
-- WARNING: This will permanently delete all OFC nominations, canonical OFCs, and related data.
-- This is a destructive operation. Use with caution.
--
-- Deletion order (respects foreign key constraints):
-- 1. Dependent tables (citations, decisions, transitions)
-- 2. Nominations
-- 3. Canonical OFCs
-- 4. Normalized OFCs (if exists)

BEGIN;

-- ============================================================================
-- 0. Capture counts before deletion for logging
-- ============================================================================

-- Create a log table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.ofc_wipe_log (
    wipe_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wiped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason TEXT NOT NULL,
    rows_deleted JSONB,
    wiped_by TEXT
);

-- Capture counts before deletion
DO $$
DECLARE
    citations_count INTEGER := 0;
    decisions_count INTEGER := 0;
    nominations_count INTEGER := 0;
    canonical_count INTEGER := 0;
    normalized_count INTEGER := 0;
BEGIN
    SELECT COUNT(*) INTO citations_count FROM public.canonical_ofc_citations;
    SELECT COUNT(*) INTO decisions_count FROM public.ofc_nomination_decisions;
    SELECT COUNT(*) INTO nominations_count FROM public.ofc_nominations;
    SELECT COUNT(*) INTO canonical_count FROM public.canonical_ofcs;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'normalized_ofcs'
    ) THEN
        SELECT COUNT(*) INTO normalized_count FROM public.normalized_ofcs;
    END IF;
    
    -- Log this wipe with pre-deletion counts
    INSERT INTO public.ofc_wipe_log (reason, rows_deleted, wiped_by)
    VALUES (
        'OFCs no longer match current baseline questions - data wiped for regeneration',
        jsonb_build_object(
            'canonical_ofc_citations', citations_count,
            'ofc_nomination_decisions', decisions_count,
            'ofc_nominations', nominations_count,
            'canonical_ofcs', canonical_count,
            'normalized_ofcs', normalized_count
        ),
        'MIGRATION'
    );
END $$;

-- ============================================================================
-- 1. Delete dependent records first (citations, decisions, transitions)
-- ============================================================================

-- Delete canonical OFC citations
DELETE FROM public.canonical_ofc_citations;

-- Delete OFC nomination decisions
DELETE FROM public.ofc_nomination_decisions;

-- Delete OFC state transitions (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ofc_state_transitions'
    ) THEN
        DELETE FROM public.ofc_state_transitions;
    END IF;
END $$;

-- ============================================================================
-- 2. Delete OFC nominations
-- ============================================================================

DELETE FROM public.ofc_nominations;

-- ============================================================================
-- 3. Delete canonical OFCs
-- ============================================================================

-- Note: There's a trigger that blocks deletion of canonical OFCs
-- We need to temporarily disable it, then delete, then re-enable it

-- Disable the delete protection trigger
DROP TRIGGER IF EXISTS trg_block_canonical_ofc_delete ON public.canonical_ofcs;

-- Clear self-referential foreign keys first
UPDATE public.canonical_ofcs 
SET supersedes_canonical_ofc_id = NULL 
WHERE supersedes_canonical_ofc_id IS NOT NULL;

-- Delete all canonical OFCs
DELETE FROM public.canonical_ofcs;

-- Re-enable the delete protection trigger (for future use)
CREATE TRIGGER trg_block_canonical_ofc_delete
BEFORE DELETE ON public.canonical_ofcs
FOR EACH ROW EXECUTE FUNCTION public.block_canonical_ofc_delete();

-- ============================================================================
-- 4. Delete normalized OFCs (if exists)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'normalized_ofcs'
    ) THEN
        DELETE FROM public.normalized_ofcs;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- Verification queries (run separately to verify)
-- ============================================================================
-- SELECT COUNT(*) FROM public.ofc_nominations; -- Should be 0
-- SELECT COUNT(*) FROM public.canonical_ofcs; -- Should be 0
-- SELECT COUNT(*) FROM public.canonical_ofc_citations; -- Should be 0
-- SELECT COUNT(*) FROM public.ofc_nomination_decisions; -- Should be 0

