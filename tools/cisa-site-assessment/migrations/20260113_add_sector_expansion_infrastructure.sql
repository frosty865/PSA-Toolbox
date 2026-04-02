-- Sector/Subsector Expansion Infrastructure (Phase 1)
-- Additive expansion layer for sector/subsector-specific questions
-- Date: 2025-01-13
--
-- Rules:
-- - Expansion is additive only, explicitly applied, versioned, and reported separately
-- - NO changes to baseline questions, baseline scoring, or baseline OFC promotion guards
-- - NO inference / auto-application of profiles
-- - QA/test assessment exclusion rules remain in place

-- ============================================================================
-- 1. Expansion profiles registry
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sector_expansion_profiles (
  profile_id TEXT PRIMARY KEY,
  sector TEXT NOT NULL,
  subsector TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  effective_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
  description TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sector_expansion_profiles IS
'Registry of sector/subsector expansion profiles. Profiles define additional questions beyond baseline. Explicitly applied to assessments only.';

COMMENT ON COLUMN public.sector_expansion_profiles.profile_id IS
'Unique identifier for the profile (e.g., "COMMERCIAL_FACILITIES_SHOPPING_MALLS_v1").';

COMMENT ON COLUMN public.sector_expansion_profiles.status IS
'Profile lifecycle: DRAFT (being developed), ACTIVE (available for application), RETIRED (no longer used).';

COMMENT ON COLUMN public.sector_expansion_profiles.effective_date IS
'Date when this profile version becomes effective. Used for versioning and audit.';

-- ============================================================================
-- 2. Profiles applied to assessments (explicit only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assessment_expansion_profiles (
  assessment_id UUID NOT NULL,
  profile_id TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_by TEXT NULL,
  PRIMARY KEY (assessment_id, profile_id),
  CONSTRAINT fk_aep_assessment 
    FOREIGN KEY (assessment_id) 
    REFERENCES public.assessments(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_aep_profile 
    FOREIGN KEY (profile_id) 
    REFERENCES public.sector_expansion_profiles(profile_id) 
    ON DELETE RESTRICT
);

COMMENT ON TABLE public.assessment_expansion_profiles IS
'Explicit application of expansion profiles to assessments. No auto-application; profiles must be manually applied.';

COMMENT ON COLUMN public.assessment_expansion_profiles.applied_by IS
'Optional identifier of who applied the profile (user/actor).';

-- ============================================================================
-- 3. Expansion question templates (initially empty)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.expansion_questions (
  question_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  subtype_code TEXT NOT NULL,
  question_text TEXT NOT NULL,
  response_enum TEXT[] NOT NULL,
  introduced_version INTEGER NOT NULL CHECK (introduced_version > 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RETIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_eq_profile 
    FOREIGN KEY (profile_id) 
    REFERENCES public.sector_expansion_profiles(profile_id) 
    ON DELETE CASCADE
);

COMMENT ON TABLE public.expansion_questions IS
'Expansion question templates. Questions are scoped to profiles and subtypes. Initially empty; content added in Phase 2.';

COMMENT ON COLUMN public.expansion_questions.subtype_code IS
'PSA discipline subtype code (e.g., "VSS_SYSTEMS", "ACS_DOOR_READERS"). Links to taxonomy.';

COMMENT ON COLUMN public.expansion_questions.response_enum IS
'Allowed response values (e.g., ["YES","NO","N_A"]). Must match assessment response values.';

COMMENT ON COLUMN public.expansion_questions.introduced_version IS
'Profile version when this question was introduced. Used for versioning and audit.';

-- ============================================================================
-- 4. Expansion responses (per assessment)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assessment_expansion_responses (
  assessment_id UUID NOT NULL,
  question_id TEXT NOT NULL,
  response TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (assessment_id, question_id),
  CONSTRAINT fk_aer_assessment 
    FOREIGN KEY (assessment_id) 
    REFERENCES public.assessments(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_aer_question 
    FOREIGN KEY (question_id) 
    REFERENCES public.expansion_questions(question_id) 
    ON DELETE CASCADE
);

COMMENT ON TABLE public.assessment_expansion_responses IS
'Responses to expansion questions. Separate from baseline responses. Never affects baseline scoring.';

-- ============================================================================
-- 5. Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sep_sector_subsector 
  ON public.sector_expansion_profiles(sector, subsector);

CREATE INDEX IF NOT EXISTS idx_sep_status_effective 
  ON public.sector_expansion_profiles(status, effective_date);

CREATE INDEX IF NOT EXISTS idx_aep_assessment 
  ON public.assessment_expansion_profiles(assessment_id);

CREATE INDEX IF NOT EXISTS idx_eq_profile_subtype 
  ON public.expansion_questions(profile_id, subtype_code);

CREATE INDEX IF NOT EXISTS idx_eq_status 
  ON public.expansion_questions(status);

CREATE INDEX IF NOT EXISTS idx_aer_assessment 
  ON public.assessment_expansion_responses(assessment_id);

-- ============================================================================
-- 6. Updated_at triggers (if trigger framework exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_sector_expansion_profiles_updated_at ON public.sector_expansion_profiles;
    CREATE TRIGGER update_sector_expansion_profiles_updated_at
      BEFORE UPDATE ON public.sector_expansion_profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    
    DROP TRIGGER IF EXISTS update_expansion_questions_updated_at ON public.expansion_questions;
    CREATE TRIGGER update_expansion_questions_updated_at
      BEFORE UPDATE ON public.expansion_questions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- 7. Seed: ZERO content by default
-- ============================================================================
-- No profiles or questions inserted in this migration.
-- Profiles will be created via admin UI/API in Phase 1 (manual), or later seed scripts.

