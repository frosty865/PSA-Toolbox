-- Stores responses for questions in the frozen universe
CREATE TABLE IF NOT EXISTS public.assessment_question_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  question_code TEXT NOT NULL,
  response_enum TEXT NOT NULL CHECK (response_enum IN ('YES','NO','N_A')),
  detail JSONB NOT NULL DEFAULT '{}'::jsonb, -- future: checklist/components, notes, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, question_code)
);

CREATE INDEX IF NOT EXISTS idx_aqr_assessment ON public.assessment_question_responses (assessment_id);

COMMENT ON TABLE public.assessment_question_responses IS
'Stores responses for questions in the frozen question universe for each assessment.';

COMMENT ON COLUMN public.assessment_question_responses.response_enum IS
'Primary response value: YES, NO, or N_A.';

COMMENT ON COLUMN public.assessment_question_responses.detail IS
'Additional response details (e.g., checklist items, components, notes) stored as JSONB.';

-- Simple assessment status tracking (if you already have an assessments table with status, skip/adjust)
CREATE TABLE IF NOT EXISTS public.assessment_status (
  assessment_id UUID PRIMARY KEY REFERENCES public.assessments(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','IN_PROGRESS','COMPLETE')) DEFAULT 'DRAFT',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assessment_status IS
'Simple assessment status tracking. Note: If the assessments table already has a status column, this table may be redundant.';


