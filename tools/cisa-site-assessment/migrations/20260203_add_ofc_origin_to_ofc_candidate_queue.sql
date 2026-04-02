-- Add ofc_origin field to ofc_candidate_queue
-- Date: 2026-02-03
-- Purpose: Separate CORPUS OFCs from MODULE OFCs deterministically

-- ============================================================================
-- 1. Add ofc_origin column with constraint
-- ============================================================================

ALTER TABLE public.ofc_candidate_queue
ADD COLUMN IF NOT EXISTS ofc_origin TEXT NOT NULL DEFAULT 'CORPUS';

ALTER TABLE public.ofc_candidate_queue
ADD CONSTRAINT ofc_candidate_queue_ofc_origin_chk
CHECK (ofc_origin IN ('CORPUS','MODULE'));

COMMENT ON COLUMN public.ofc_candidate_queue.ofc_origin IS
'Origin discriminator: CORPUS = mined/imported from corpus documents, MODULE = created during module research.';

-- ============================================================================
-- 2. Create index for efficient filtering
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ofc_candidate_queue_ofc_origin 
  ON public.ofc_candidate_queue(ofc_origin);

CREATE INDEX IF NOT EXISTS idx_ofc_candidate_queue_ofc_origin_status 
  ON public.ofc_candidate_queue(ofc_origin, status);

-- ============================================================================
-- 3. Backfill existing rows
-- ============================================================================
-- All existing rows should be CORPUS (default already set)
-- If you have a reliable marker like submitted_by='MODULE_IMPORT', use it:

-- UPDATE public.ofc_candidate_queue
-- SET ofc_origin = 'MODULE'
-- WHERE submitted_by IN ('MODULE_IMPORT','MODULE_RESEARCH');
-- 
-- Note: Check if submitted_by column exists first. If not, all existing rows remain CORPUS (default).

-- ============================================================================
-- 4. Add discipline_id and discipline_subtype_id columns if missing
-- ============================================================================

ALTER TABLE public.ofc_candidate_queue
ADD COLUMN IF NOT EXISTS discipline_id UUID;

ALTER TABLE public.ofc_candidate_queue
ADD COLUMN IF NOT EXISTS discipline_subtype_id UUID;

ALTER TABLE public.ofc_candidate_queue
ADD COLUMN IF NOT EXISTS title TEXT;

CREATE INDEX IF NOT EXISTS idx_ofc_candidate_queue_discipline_subtype_id 
  ON public.ofc_candidate_queue(discipline_subtype_id)
  WHERE discipline_subtype_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ofc_candidate_queue_discipline_id 
  ON public.ofc_candidate_queue(discipline_id)
  WHERE discipline_id IS NOT NULL;

COMMENT ON COLUMN public.ofc_candidate_queue.discipline_id IS
'Discipline ID for subtype/discipline matching. NULL for unclassified candidates.';

COMMENT ON COLUMN public.ofc_candidate_queue.discipline_subtype_id IS
'Discipline subtype ID for subtype matching. Required for MODULE OFCs.';

COMMENT ON COLUMN public.ofc_candidate_queue.title IS
'Optional title for the OFC candidate.';

-- ============================================================================
-- 5. Update table comment
-- ============================================================================

COMMENT ON TABLE public.ofc_candidate_queue IS
'Queue of OFC candidate snippets extracted from documents. Supports both CORPUS (mined/imported) and MODULE (research-created) origins.';
