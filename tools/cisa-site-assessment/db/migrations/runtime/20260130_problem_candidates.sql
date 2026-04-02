-- RUNTIME: problem_candidates table for reviewed problem statements → promoted to canonical OFCs
-- Phase 2B: Only admin promotion can create canonical OFCs; problem_candidates holds PENDING/REJECTED/ACCEPTED.

CREATE TABLE IF NOT EXISTS public.problem_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_subtype_id UUID NOT NULL REFERENCES public.discipline_subtypes(id) ON DELETE RESTRICT,
  problem_statement TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REJECTED', 'ACCEPTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.problem_candidates IS
'Reviewed problem candidates; only PENDING can be promoted to canonical OFC. Admin authors capability statement on promote.';

COMMENT ON COLUMN public.problem_candidates.discipline_subtype_id IS
'Required; copied to ofc_library on promote. Subtype gates OFC attachment to questions.';

COMMENT ON COLUMN public.problem_candidates.problem_statement IS
'Problem/vulnerability statement from evidence.';

COMMENT ON COLUMN public.problem_candidates.evidence IS
'Structured evidence (chunk_ids, excerpts, source keys).';

COMMENT ON COLUMN public.problem_candidates.status IS
'PENDING = reviewable; REJECTED = not promoted; ACCEPTED = promoted to OFC.';

CREATE INDEX IF NOT EXISTS idx_problem_candidates_status ON public.problem_candidates(status);
CREATE INDEX IF NOT EXISTS idx_problem_candidates_discipline_subtype ON public.problem_candidates(discipline_subtype_id);
