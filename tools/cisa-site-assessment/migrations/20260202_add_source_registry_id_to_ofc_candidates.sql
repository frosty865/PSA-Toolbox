-- Add source_registry_id to ofc_candidate_queue
-- Date: 2026-02-02
-- Purpose: Enable external verification for IST OFCs (legally verified sources)

-- ============================================================================
-- 1. Add source_registry_id column (nullable, no FK constraint yet)
-- ============================================================================

ALTER TABLE public.ofc_candidate_queue
ADD COLUMN IF NOT EXISTS source_registry_id UUID;

COMMENT ON COLUMN public.ofc_candidate_queue.source_registry_id IS
'References public.source_registry(id) for externally verified IST OFCs. NULL for mined candidates.';

-- ============================================================================
-- 2. Create index for efficient lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ofc_candidate_queue_source_registry_id 
  ON public.ofc_candidate_queue(source_registry_id)
  WHERE source_registry_id IS NOT NULL;

-- ============================================================================
-- 3. Note: Foreign key constraint will be added after backfill completes
-- ============================================================================
-- 
-- After backfilling IST OFCs with source_registry_id values, add:
-- ALTER TABLE public.ofc_candidate_queue
-- ADD CONSTRAINT ofc_candidate_queue_source_registry_id_fkey
-- FOREIGN KEY (source_registry_id) REFERENCES public.source_registry(id) ON DELETE RESTRICT;
