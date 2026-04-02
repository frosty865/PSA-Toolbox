-- Migrate assessment_technology_profiles to new schema
-- Drops old table and creates new one aligned with VOFC Engine model
-- Date: 2025-01-13

-- ============================================================================
-- 1) Drop old table if it exists (with old schema)
-- ============================================================================

DROP TABLE IF EXISTS public.assessment_technology_profiles CASCADE;

-- ============================================================================
-- 2) Create new assessment_technology_profiles table
-- ============================================================================

CREATE TABLE public.assessment_technology_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_instance_id uuid NOT NULL,
  discipline_subtype_id uuid NOT NULL,
  technology_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notes text NULL,
  
  -- Uniqueness: one technology_code per instance+subtype (allows multiple for hybrid)
  UNIQUE(assessment_instance_id, discipline_subtype_id, technology_code),
  
  -- Foreign key constraints
  CONSTRAINT fk_atp_assessment_instance
    FOREIGN KEY (assessment_instance_id)
    REFERENCES public.assessment_instances(id)
    ON DELETE CASCADE,
    
  CONSTRAINT fk_atp_discipline_subtype
    FOREIGN KEY (discipline_subtype_id)
    REFERENCES public.discipline_subtypes(id)
    ON DELETE RESTRICT
);

-- Indexes
CREATE INDEX idx_atp_assessment_instance_id
  ON public.assessment_technology_profiles(assessment_instance_id);

CREATE INDEX idx_atp_subtype_id
  ON public.assessment_technology_profiles(discipline_subtype_id);

CREATE INDEX idx_atp_technology_code
  ON public.assessment_technology_profiles(technology_code);

-- Comments
COMMENT ON TABLE public.assessment_technology_profiles IS
'Technology profile metadata per assessment instance and subtype. Non-scored metadata only; does not affect baseline scoring or OFC triggers.';

COMMENT ON COLUMN public.assessment_technology_profiles.technology_code IS
'Technology type code (e.g., "CCTV_ANALOG", "IP_CAMERA_VMS", "PROX_CARD_READER"). Multiple codes per subtype allowed for hybrid systems.';

COMMENT ON COLUMN public.assessment_technology_profiles.notes IS
'Optional notes for this technology selection. Informational only.';

-- ============================================================================
-- 3) Add updated_at trigger (if trigger framework exists)
-- ============================================================================

-- Only add trigger if update_updated_at_column function exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_assessment_technology_profiles_updated_at ON public.assessment_technology_profiles;
    CREATE TRIGGER update_assessment_technology_profiles_updated_at
      BEFORE UPDATE ON public.assessment_technology_profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

