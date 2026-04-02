-- RUNTIME: Module instance tables (doctrine generation output) + assessment_modules intent columns
-- Run on RUNTIME database only.
--
-- Tables: module_instances, module_instance_criteria, module_instance_criterion_responses, module_instance_ofcs
-- Alters: assessment_modules (intent_*), module_ofc_sources (module_instance_ofc_id)

-- 1) assessment_modules: intent columns for standard selection
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assessment_modules' AND column_name='intent_standard_key') THEN
    ALTER TABLE public.assessment_modules ADD COLUMN intent_standard_key TEXT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assessment_modules' AND column_name='intent_confidence') THEN
    ALTER TABLE public.assessment_modules ADD COLUMN intent_confidence TEXT NOT NULL DEFAULT 'UNSET';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assessment_modules' AND column_name='intent_locked') THEN
    ALTER TABLE public.assessment_modules ADD COLUMN intent_locked BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assessment_modules' AND column_name='intent_explanation') THEN
    ALTER TABLE public.assessment_modules ADD COLUMN intent_explanation JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

COMMENT ON COLUMN public.assessment_modules.intent_standard_key IS 'Selected module standard key from doctrine. Not baseline.';
COMMENT ON COLUMN public.assessment_modules.intent_confidence IS 'Intent resolver confidence: UNSET|LOW|MEDIUM|HIGH.';
COMMENT ON COLUMN public.assessment_modules.intent_locked IS 'When true, intent (standard_key) is manually locked.';
COMMENT ON COLUMN public.assessment_modules.intent_explanation IS 'Intent resolver explanation (e.g. why this standard).';

-- 2) module_instances
CREATE TABLE IF NOT EXISTS public.module_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code TEXT NOT NULL REFERENCES public.assessment_modules(module_code) ON DELETE CASCADE,
  standard_key TEXT NOT NULL,
  standard_version TEXT NOT NULL,
  attributes_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(module_code)
);

CREATE INDEX IF NOT EXISTS idx_module_instances_module_code ON public.module_instances(module_code);
CREATE INDEX IF NOT EXISTS idx_module_instances_standard_key ON public.module_instances(standard_key);

COMMENT ON TABLE public.module_instances IS 'One generated instance per module_code. Output of doctrine generation.';

-- 3) module_instance_criteria
CREATE TABLE IF NOT EXISTS public.module_instance_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_instance_id UUID NOT NULL REFERENCES public.module_instances(id) ON DELETE CASCADE,
  criterion_key TEXT NOT NULL,
  title TEXT NOT NULL,
  question_text TEXT NOT NULL,
  discipline_subtype_id UUID NULL,
  applicability TEXT NOT NULL DEFAULT 'APPLIES' CHECK (applicability IN ('APPLIES','N_A')),
  order_index INT NOT NULL DEFAULT 0,
  UNIQUE(module_instance_id, criterion_key)
);

CREATE INDEX IF NOT EXISTS idx_module_instance_criteria_instance ON public.module_instance_criteria(module_instance_id);

COMMENT ON TABLE public.module_instance_criteria IS 'Criteria questions for this instance. applicability from attributes + applicability_rule.';

-- 4) module_instance_criterion_responses
CREATE TABLE IF NOT EXISTS public.module_instance_criterion_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_instance_criterion_id UUID NOT NULL REFERENCES public.module_instance_criteria(id) ON DELETE CASCADE,
  response_enum TEXT NOT NULL CHECK (response_enum IN ('YES','NO','N_A')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(module_instance_criterion_id)
);

CREATE INDEX IF NOT EXISTS idx_module_instance_criterion_responses_criterion ON public.module_instance_criterion_responses(module_instance_criterion_id);

COMMENT ON TABLE public.module_instance_criterion_responses IS 'User response per criterion. One row per criterion.';

-- 5) module_instance_ofcs
CREATE TABLE IF NOT EXISTS public.module_instance_ofcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_instance_id UUID NOT NULL REFERENCES public.module_instances(id) ON DELETE CASCADE,
  criterion_key TEXT NOT NULL,
  template_key TEXT NOT NULL,
  discipline_subtype_id UUID NOT NULL,
  ofc_text TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  UNIQUE(module_instance_id, criterion_key, template_key)
);

CREATE INDEX IF NOT EXISTS idx_module_instance_ofcs_instance ON public.module_instance_ofcs(module_instance_id);

COMMENT ON TABLE public.module_instance_ofcs IS 'Instantiated OFCs from templates. Shown when criterion is NO. module_ofc_sources can link here.';

-- 6) module_ofc_sources: optional link to module_instance_ofcs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='module_ofc_sources' AND column_name='module_instance_ofc_id') THEN
    ALTER TABLE public.module_ofc_sources ADD COLUMN module_instance_ofc_id UUID NULL REFERENCES public.module_instance_ofcs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Make module_ofc_id nullable so one of (module_ofc_id, module_instance_ofc_id) can be set
ALTER TABLE public.module_ofc_sources ALTER COLUMN module_ofc_id DROP NOT NULL;

ALTER TABLE public.module_ofc_sources DROP CONSTRAINT IF EXISTS chk_module_ofc_sources_ref;
ALTER TABLE public.module_ofc_sources ADD CONSTRAINT chk_module_ofc_sources_ref CHECK (
  (module_ofc_id IS NOT NULL AND module_instance_ofc_id IS NULL) OR
  (module_ofc_id IS NULL AND module_instance_ofc_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_module_ofc_sources_instance_ofc ON public.module_ofc_sources(module_instance_ofc_id) WHERE module_instance_ofc_id IS NOT NULL;

COMMENT ON COLUMN public.module_ofc_sources.module_instance_ofc_id IS 'When set, links to module_instance_ofcs (doctrine flow). Otherwise module_ofc_id (legacy/import).';
