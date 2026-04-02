BEGIN;

-- If these columns already exist from 0003, this is safe:
ALTER TABLE public.ofc_nominations
  ADD COLUMN IF NOT EXISTS assessment_response_id uuid NULL,
  ADD COLUMN IF NOT EXISTS candidate_id uuid NULL;

-- Idempotency: only one nomination per assessment_response + candidate
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_ofc_nominations_response_candidate'
  ) THEN
    ALTER TABLE public.ofc_nominations
      ADD CONSTRAINT uq_ofc_nominations_response_candidate
      UNIQUE (assessment_id, assessment_response_id, candidate_id);
  END IF;
END$$;

-- Secondary protection: only one nomination per response + ofc
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_ofc_nominations_response_ofc'
  ) THEN
    ALTER TABLE public.ofc_nominations
      ADD CONSTRAINT uq_ofc_nominations_response_ofc
      UNIQUE (assessment_id, assessment_response_id, ofc_id);
  END IF;
END$$;

COMMIT;
