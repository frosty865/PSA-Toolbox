-- Lock ofc_origin on ofc_candidate_queue
-- Date: 2026-01-24
-- Purpose: Enforce ofc_origin as required, validated field (NOT NULL + CHECK)
-- IMPORTANT: Run against CORPUS database only

BEGIN;

-- 1) Add column if missing
ALTER TABLE public.ofc_candidate_queue
  ADD COLUMN IF NOT EXISTS ofc_origin text;

-- 2) Backfill NULL/empty/unknown values safely
-- Rule: anything not explicitly MODULE becomes CORPUS
UPDATE public.ofc_candidate_queue
SET ofc_origin = 'CORPUS'
WHERE ofc_origin IS NULL 
   OR btrim(ofc_origin) = '' 
   OR upper(btrim(ofc_origin)) NOT IN ('CORPUS','MODULE');

-- 3) Enforce CHECK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_ofc_candidate_queue_ofc_origin'
    AND conrelid = 'public.ofc_candidate_queue'::regclass
  ) THEN
    ALTER TABLE public.ofc_candidate_queue
      ADD CONSTRAINT chk_ofc_candidate_queue_ofc_origin
      CHECK (ofc_origin IN ('CORPUS','MODULE'));
  END IF;
END$$;

-- 4) Enforce NOT NULL
ALTER TABLE public.ofc_candidate_queue
  ALTER COLUMN ofc_origin SET NOT NULL;

-- 5) Add index for module list filtering
CREATE INDEX IF NOT EXISTS idx_ofc_candidate_queue_ofc_origin
  ON public.ofc_candidate_queue (ofc_origin);

-- 6) Add composite index for common query patterns (origin + status)
CREATE INDEX IF NOT EXISTS idx_ofc_candidate_queue_ofc_origin_status
  ON public.ofc_candidate_queue (ofc_origin, status)
  WHERE ofc_origin IS NOT NULL;

COMMENT ON COLUMN public.ofc_candidate_queue.ofc_origin IS
'Origin discriminator: CORPUS = mined/imported from corpus documents, MODULE = created during module research. REQUIRED, NOT NULL, CHECK constrained to CORPUS|MODULE.';

COMMIT;
