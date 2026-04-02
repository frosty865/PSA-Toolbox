-- Add Technology Maturity Index (TMI) v1
-- Defines maturity levels and weights for comparative scoring (non-baseline)
-- Date: 2025-01-13

-- ============================================================================
-- 1) Create technology_maturity_definitions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.technology_maturity_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_code text NOT NULL,
  tech_type text NOT NULL,
  maturity_level integer NOT NULL CHECK (maturity_level >= 1 AND maturity_level <= 5),
  maturity_weight numeric(3,2) NOT NULL CHECK (maturity_weight > 0 AND maturity_weight <= 1.0),
  description text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Uniqueness: one maturity definition per discipline+tech_type
  UNIQUE (discipline_code, tech_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_technology_maturity_definitions_discipline
  ON public.technology_maturity_definitions(discipline_code);

CREATE INDEX IF NOT EXISTS idx_technology_maturity_definitions_tech_type
  ON public.technology_maturity_definitions(tech_type);

CREATE INDEX IF NOT EXISTS idx_technology_maturity_definitions_active
  ON public.technology_maturity_definitions(is_active)
  WHERE is_active = true;

-- Comments
COMMENT ON TABLE public.technology_maturity_definitions IS
'Canonical definitions of technology maturity levels and weights. Used for comparative scoring only; does not affect baseline compliance scoring.';

COMMENT ON COLUMN public.technology_maturity_definitions.maturity_level IS
'Maturity level from 1 (lowest) to 5 (highest). Represents technology capability sophistication.';

COMMENT ON COLUMN public.technology_maturity_definitions.maturity_weight IS
'Weight factor (0.00-1.00) applied to baseline score when calculating effective strength. Only applies when baseline score = 100%.';

COMMENT ON COLUMN public.technology_maturity_definitions.description IS
'Short capability-focused description (1-2 sentences) explaining what this maturity level represents.';

-- ============================================================================
-- 2) Add trigger to update updated_at timestamp
-- ============================================================================

DROP TRIGGER IF EXISTS update_technology_maturity_definitions_updated_at ON public.technology_maturity_definitions;
CREATE TRIGGER update_technology_maturity_definitions_updated_at
  BEFORE UPDATE ON public.technology_maturity_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3) Insert initial VSS (Video Surveillance Systems) maturity definitions
-- ============================================================================

-- Level 1: Basic Analog Systems
INSERT INTO public.technology_maturity_definitions (
  discipline_code, tech_type, maturity_level, maturity_weight, description
) VALUES (
  'VIDEO_SURVEILLANCE',
  'CCTV_ANALOG',
  1,
  0.60,
  'Basic analog CCTV system with standard recording capabilities. Limited remote access and basic monitoring features.'
) ON CONFLICT (discipline_code, tech_type) DO NOTHING;

-- Level 2: Digital DVR Systems
INSERT INTO public.technology_maturity_definitions (
  discipline_code, tech_type, maturity_level, maturity_weight, description
) VALUES (
  'VIDEO_SURVEILLANCE',
  'CCTV_DIGITAL_DVR',
  2,
  0.75,
  'Digital DVR-based system with improved storage, search capabilities, and basic network connectivity. Enhanced recording quality and management features.'
) ON CONFLICT (discipline_code, tech_type) DO NOTHING;

-- Level 3: IP Camera VMS
INSERT INTO public.technology_maturity_definitions (
  discipline_code, tech_type, maturity_level, maturity_weight, description
) VALUES (
  'VIDEO_SURVEILLANCE',
  'IP_CAMERA_VMS',
  3,
  0.90,
  'IP-based camera system with Video Management Software (VMS). Advanced features including remote access, analytics capabilities, and scalable architecture.'
) ON CONFLICT (discipline_code, tech_type) DO NOTHING;

-- Level 3: Hybrid Analog/IP
INSERT INTO public.technology_maturity_definitions (
  discipline_code, tech_type, maturity_level, maturity_weight, description
) VALUES (
  'VIDEO_SURVEILLANCE',
  'HYBRID_ANALOG_IP',
  3,
  0.85,
  'Hybrid system combining analog and IP cameras with unified management. Provides migration path and leverages existing infrastructure while adding modern capabilities.'
) ON CONFLICT (discipline_code, tech_type) DO NOTHING;

-- Level 3: Cloud Managed Video
INSERT INTO public.technology_maturity_definitions (
  discipline_code, tech_type, maturity_level, maturity_weight, description
) VALUES (
  'VIDEO_SURVEILLANCE',
  'CLOUD_MANAGED_VIDEO',
  3,
  0.88,
  'Cloud-managed video surveillance system with remote management, scalable storage, and managed service capabilities. Reduces on-premises infrastructure requirements.'
) ON CONFLICT (discipline_code, tech_type) DO NOTHING;

-- Level 4: Redundant IP VMS
INSERT INTO public.technology_maturity_definitions (
  discipline_code, tech_type, maturity_level, maturity_weight, description
) VALUES (
  'VIDEO_SURVEILLANCE',
  'IP_CAMERA_VMS_REDUNDANT',
  4,
  1.00,
  'IP camera VMS with redundant systems, high availability architecture, and advanced resilience features. Includes failover capabilities and comprehensive monitoring.'
) ON CONFLICT (discipline_code, tech_type) DO NOTHING;

-- Level 2: Mobile Trailer System
INSERT INTO public.technology_maturity_definitions (
  discipline_code, tech_type, maturity_level, maturity_weight, description
) VALUES (
  'VIDEO_SURVEILLANCE',
  'MOBILE_TRAILER_SYSTEM',
  2,
  0.70,
  'Mobile or trailer-mounted surveillance system with portable deployment capabilities. Suitable for temporary or remote monitoring needs.'
) ON CONFLICT (discipline_code, tech_type) DO NOTHING;

-- Level 2: Body Worn Video
INSERT INTO public.technology_maturity_definitions (
  discipline_code, tech_type, maturity_level, maturity_weight, description
) VALUES (
  'VIDEO_SURVEILLANCE',
  'BODY_WORN_VIDEO',
  2,
  0.72,
  'Body-worn video system for personnel. Provides mobile recording capabilities and situational awareness for field operations.'
) ON CONFLICT (discipline_code, tech_type) DO NOTHING;

-- ============================================================================
-- 4) Create view for maturity lookup (optional, for convenience)
-- ============================================================================

CREATE OR REPLACE VIEW public.technology_maturity_lookup AS
SELECT 
  tmd.discipline_code,
  tmd.tech_type,
  tmd.maturity_level,
  tmd.maturity_weight,
  tmd.description,
  tmd.is_active
FROM public.technology_maturity_definitions tmd
WHERE tmd.is_active = true;

COMMENT ON VIEW public.technology_maturity_lookup IS
'Active technology maturity definitions for lookup. Filters out inactive definitions.';

