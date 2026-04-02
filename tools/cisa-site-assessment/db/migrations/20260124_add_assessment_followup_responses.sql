-- ============================================================================
-- Assessment Follow-up Responses
-- Stores YES-only descriptive branching responses from reference implementations
-- ============================================================================
-- Date: 2026-01-24
-- Purpose: Store follow-up responses linked to baseline question responses
--          These are descriptive context questions (YES-only) from reference implementations

CREATE TABLE IF NOT EXISTS public.assessment_followup_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  parent_response_id UUID NOT NULL, -- FK to assessment_responses.id (or assessment_question_responses.id)
  discipline_subtype_id UUID NOT NULL, -- FK to discipline_subtypes.id
  followup_key TEXT NOT NULL, -- Stable key from reference impl (index or slug)
  followup_text TEXT NOT NULL, -- Question text from reference impl
  response_type TEXT NOT NULL CHECK (response_type IN ('TEXT', 'ENUM', 'MULTISELECT')),
  response_value_text TEXT NULL, -- For TEXT type
  response_value_enum TEXT NULL, -- For ENUM type (single value)
  response_value_multi TEXT[] NULL, -- For MULTISELECT type (array)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT uq_followup_parent_key UNIQUE(parent_response_id, followup_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_followup_assessment 
  ON public.assessment_followup_responses(assessment_id);

CREATE INDEX IF NOT EXISTS idx_followup_discipline_subtype 
  ON public.assessment_followup_responses(discipline_subtype_id);

CREATE INDEX IF NOT EXISTS idx_followup_parent_response 
  ON public.assessment_followup_responses(parent_response_id);

-- Updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_followup_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_followup_responses_updated_at ON public.assessment_followup_responses;
CREATE TRIGGER update_followup_responses_updated_at
  BEFORE UPDATE ON public.assessment_followup_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_followup_updated_at_column();

-- Comments
COMMENT ON TABLE public.assessment_followup_responses IS
'Stores YES-only descriptive branching responses from reference implementations. Linked to baseline question responses via parent_response_id.';

COMMENT ON COLUMN public.assessment_followup_responses.parent_response_id IS
'References the baseline response ID (assessment_responses.id or assessment_question_responses.id).';

COMMENT ON COLUMN public.assessment_followup_responses.followup_key IS
'Stable identifier from reference implementation (e.g., index "0", "1", or slug). Used to match followup questions to responses.';

COMMENT ON COLUMN public.assessment_followup_responses.followup_text IS
'Question text from reference implementation section_3_descriptive_branching_yes_only.';

COMMENT ON COLUMN public.assessment_followup_responses.response_type IS
'Type of response: TEXT (textarea), ENUM (single select), MULTISELECT (checkbox list).';

COMMENT ON COLUMN public.assessment_followup_responses.response_value_text IS
'Response value for TEXT type responses.';

COMMENT ON COLUMN public.assessment_followup_responses.response_value_enum IS
'Response value for ENUM type responses (single selected value).';

COMMENT ON COLUMN public.assessment_followup_responses.response_value_multi IS
'Response values for MULTISELECT type responses (array of selected values).';
