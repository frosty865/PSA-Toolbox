-- Add Technology Differentiation Layer (non-scored)
-- Enables technology-specific metadata and overlays without contaminating Baseline v2
-- Date: 2025-01-13

-- ============================================================================
-- 1) Create assessment_technology_profiles table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assessment_technology_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL,
  discipline_code text NOT NULL,
  subtype_code text NOT NULL,
  tech_family text NOT NULL,  -- e.g., "VIDEO_SURVEILLANCE"
  tech_type text NOT NULL,   -- e.g., "CCTV_ANALOG", "IP_CAMERA_VMS", etc.
  tech_variant text NULL,    -- optional variant details
  confidence text NOT NULL DEFAULT 'OBSERVED' CHECK (confidence IN ('OBSERVED', 'VERIFIED', 'REPORTED')),
  notes text NULL,           -- short, non-implementation notes
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Uniqueness: one tech_type per assessment+subtype (allows multiple types for hybrid)
  UNIQUE (assessment_id, subtype_code, tech_type),
  
  -- Foreign key to assessments (with cascade delete)
  CONSTRAINT fk_assessment_technology_profiles_assessment
    FOREIGN KEY (assessment_id)
    REFERENCES public.assessments(id)
    ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_assessment_technology_profiles_assessment_id
  ON public.assessment_technology_profiles(assessment_id);

CREATE INDEX IF NOT EXISTS idx_assessment_technology_profiles_subtype_code
  ON public.assessment_technology_profiles(subtype_code);

CREATE INDEX IF NOT EXISTS idx_assessment_technology_profiles_tech_type
  ON public.assessment_technology_profiles(tech_type);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_assessment_technology_profiles_assessment_subtype
  ON public.assessment_technology_profiles(assessment_id, subtype_code);

-- Comments
COMMENT ON TABLE public.assessment_technology_profiles IS
'Technology differentiation metadata per assessment. Non-scored, field-verifiable technology details that do not affect baseline scoring.';

COMMENT ON COLUMN public.assessment_technology_profiles.tech_family IS
'High-level technology category (e.g., VIDEO_SURVEILLANCE, ACCESS_CONTROL, etc.).';

COMMENT ON COLUMN public.assessment_technology_profiles.tech_type IS
'Specific technology type (e.g., CCTV_ANALOG, IP_CAMERA_VMS, HYBRID_ANALOG_IP). Multiple types per subtype allowed for hybrid systems.';

COMMENT ON COLUMN public.assessment_technology_profiles.tech_variant IS
'Optional variant details (e.g., "coax + DVR", "ONVIF VMS", "managed service"). No vendor names unless explicitly allowed.';

COMMENT ON COLUMN public.assessment_technology_profiles.confidence IS
'Confidence level: OBSERVED (field observation), VERIFIED (confirmed), REPORTED (from documentation).';

-- ============================================================================
-- 2) Create tech_question_templates table (for overlay questions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tech_question_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tech_type text NOT NULL,        -- e.g., "CCTV_ANALOG", "IP_CAMERA_VMS"
  discipline_code text NOT NULL,
  subtype_code text NOT NULL,
  question_text text NOT NULL,    -- observable question (PSA scope only)
  response_enum text[] NOT NULL DEFAULT ARRAY['YES', 'NO', 'N_A']::text[],
  overlay_level text NOT NULL DEFAULT 'TECH' CHECK (overlay_level = 'TECH'),
  order_index int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Indexes
  CONSTRAINT idx_tech_question_templates_tech_type
    CHECK (tech_type IS NOT NULL AND length(tech_type) > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tech_question_templates_tech_type
  ON public.tech_question_templates(tech_type);

CREATE INDEX IF NOT EXISTS idx_tech_question_templates_subtype
  ON public.tech_question_templates(discipline_code, subtype_code);

CREATE INDEX IF NOT EXISTS idx_tech_question_templates_active
  ON public.tech_question_templates(is_active)
  WHERE is_active = true;

-- Comments
COMMENT ON TABLE public.tech_question_templates IS
'Technology-specific overlay questions. These are optional, non-baseline questions shown only when matching tech_type is selected. Do NOT affect baseline scoring.';

COMMENT ON COLUMN public.tech_question_templates.overlay_level IS
'Always "TECH" to distinguish from baseline questions. These are overlay-only.';

COMMENT ON COLUMN public.tech_question_templates.question_text IS
'Observable question text (PSA scope only). Must NOT include "how to implement" language.';

-- ============================================================================
-- 3) Create tech_question_responses table (for overlay question answers)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tech_question_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL,
  tech_question_template_id uuid NOT NULL,
  response text NOT NULL CHECK (response IN ('YES', 'NO', 'N_A')),
  notes text NULL,
  responded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Uniqueness: one response per assessment+question
  UNIQUE (assessment_id, tech_question_template_id),
  
  -- Foreign keys
  CONSTRAINT fk_tech_question_responses_assessment
    FOREIGN KEY (assessment_id)
    REFERENCES public.assessments(id)
    ON DELETE CASCADE,
    
  CONSTRAINT fk_tech_question_responses_template
    FOREIGN KEY (tech_question_template_id)
    REFERENCES public.tech_question_templates(id)
    ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tech_question_responses_assessment_id
  ON public.tech_question_responses(assessment_id);

CREATE INDEX IF NOT EXISTS idx_tech_question_responses_template_id
  ON public.tech_question_responses(tech_question_template_id);

-- Comments
COMMENT ON TABLE public.tech_question_responses IS
'Responses to technology-specific overlay questions. Stored separately from baseline responses and do NOT affect baseline scoring.';

-- ============================================================================
-- 4) Extend OFC templates with tech applicability (optional)
-- ============================================================================

-- Check if ofc_templates table exists and add column if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_templates'
  ) THEN
    -- Add applicable_tech_types column if it doesn't exist
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'ofc_templates'
      AND column_name = 'applicable_tech_types'
    ) THEN
      ALTER TABLE public.ofc_templates
      ADD COLUMN applicable_tech_types text[] NULL;
      
      COMMENT ON COLUMN public.ofc_templates.applicable_tech_types IS
      'Optional array of tech_type values. If present, OFC template only applies when assessment has matching tech_type. If NULL, applies universally.';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 5) Add trigger to update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to assessment_technology_profiles
DROP TRIGGER IF EXISTS update_assessment_technology_profiles_updated_at ON public.assessment_technology_profiles;
CREATE TRIGGER update_assessment_technology_profiles_updated_at
  BEFORE UPDATE ON public.assessment_technology_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply to tech_question_templates
DROP TRIGGER IF EXISTS update_tech_question_templates_updated_at ON public.tech_question_templates;
CREATE TRIGGER update_tech_question_templates_updated_at
  BEFORE UPDATE ON public.tech_question_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply to tech_question_responses
DROP TRIGGER IF EXISTS update_tech_question_responses_updated_at ON public.tech_question_responses;
CREATE TRIGGER update_tech_question_responses_updated_at
  BEFORE UPDATE ON public.tech_question_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

