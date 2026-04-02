BEGIN;

ALTER TABLE public.ofc_nominations
  ADD COLUMN IF NOT EXISTS assessment_response_id uuid NULL;

ALTER TABLE public.ofc_nominations
  ADD COLUMN IF NOT EXISTS candidate_id uuid NULL;

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_ofc_nominations_assessment_response_id
  ON public.ofc_nominations (assessment_response_id);

CREATE INDEX IF NOT EXISTS idx_ofc_nominations_candidate_id
  ON public.ofc_nominations (candidate_id);

COMMIT;
