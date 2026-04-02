-- Remove confidence concept and add optional evidence_basis
-- Technology profiles should not have pseudo-intel semantics
-- Date: 2025-01-13

-- ============================================================================
-- 1) Add evidence_basis column (optional, informational only)
-- ============================================================================

ALTER TABLE public.assessment_technology_profiles
ADD COLUMN IF NOT EXISTS evidence_basis text NULL;

COMMENT ON COLUMN public.assessment_technology_profiles.evidence_basis IS
'Optional informational field indicating basis for technology selection. Allowed values: DIRECT_OBSERVATION, SYSTEM_DEMONSTRATION, INTERFACE_EVIDENCE, DOCUMENTATION_REVIEWED, STAKEHOLDER_STATEMENT. Does not affect scoring or logic.';

-- ============================================================================
-- 2) Remove confidence column and constraint
-- ============================================================================

-- Drop the check constraint first
ALTER TABLE public.assessment_technology_profiles
DROP CONSTRAINT IF EXISTS assessment_technology_profiles_confidence_check;

-- Drop the column
ALTER TABLE public.assessment_technology_profiles
DROP COLUMN IF EXISTS confidence;

-- ============================================================================
-- 3) Update comments
-- ============================================================================

COMMENT ON TABLE public.assessment_technology_profiles IS
'Technology differentiation metadata per assessment. Non-scored, field-verifiable technology details that do not affect baseline scoring.';

