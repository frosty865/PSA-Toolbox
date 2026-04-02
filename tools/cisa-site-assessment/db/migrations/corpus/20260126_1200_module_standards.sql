-- CORPUS: Module Standards Registry (doctrine)
-- Run on CORPUS database only.
-- Tables: module_standards, module_standard_attributes, module_standard_criteria,
--         module_standard_criterion_ofc_templates, module_standard_references

-- A) module_standards
CREATE TABLE IF NOT EXISTS public.module_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  version TEXT NOT NULL DEFAULT 'v1',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','DEPRECATED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_standards_status ON public.module_standards(status);
CREATE INDEX IF NOT EXISTS idx_module_standards_standard_key ON public.module_standards(standard_key);

COMMENT ON TABLE public.module_standards IS 'Doctrine: approved module standards. Deterministic generation of criteria and OFCs. No baseline.';

-- B) module_standard_attributes
CREATE TABLE IF NOT EXISTS public.module_standard_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_id UUID NOT NULL REFERENCES public.module_standards(id) ON DELETE CASCADE,
  attr_key TEXT NOT NULL,
  attr_type TEXT NOT NULL CHECK (attr_type IN ('BOOL','ENUM')),
  enum_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  prompt TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  UNIQUE(standard_id, attr_key)
);

CREATE INDEX IF NOT EXISTS idx_module_standard_attributes_standard ON public.module_standard_attributes(standard_id);

COMMENT ON TABLE public.module_standard_attributes IS 'Structured intake for a standard (no scenarios). BOOL or ENUM.';

-- C) module_standard_criteria
CREATE TABLE IF NOT EXISTS public.module_standard_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_id UUID NOT NULL REFERENCES public.module_standards(id) ON DELETE CASCADE,
  criterion_key TEXT NOT NULL,
  title TEXT NOT NULL,
  question_text TEXT NOT NULL,
  discipline_id UUID NULL,
  discipline_subtype_id UUID NULL,
  applicability_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
  order_index INT NOT NULL DEFAULT 0,
  UNIQUE(standard_id, criterion_key)
);

CREATE INDEX IF NOT EXISTS idx_module_standard_criteria_standard ON public.module_standard_criteria(standard_id);

COMMENT ON TABLE public.module_standard_criteria IS 'Pass/fail criteria (YES/NO/N_A). applicability_rule + attributes => APPLIES or N_A.';

-- D) module_standard_criterion_ofc_templates
CREATE TABLE IF NOT EXISTS public.module_standard_criterion_ofc_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criterion_id UUID NOT NULL REFERENCES public.module_standard_criteria(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  discipline_subtype_id UUID NOT NULL,
  ofc_text_template TEXT NOT NULL,
  max_per_criterion INT NOT NULL DEFAULT 1,
  order_index INT NOT NULL DEFAULT 0,
  UNIQUE(criterion_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_module_standard_criterion_ofc_criterion ON public.module_standard_criterion_ofc_templates(criterion_id);

COMMENT ON TABLE public.module_standard_criterion_ofc_templates IS 'Maps criterion -> OFC templates to attach when NO. ofc_text_template is authored capability (WHAT, not HOW).';

-- E) module_standard_references (optional traceability)
CREATE TABLE IF NOT EXISTS public.module_standard_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_id UUID NOT NULL REFERENCES public.module_standards(id) ON DELETE CASCADE,
  source_registry_id UUID NULL,
  reference_label TEXT NULL,
  reference_url TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_module_standard_references_standard ON public.module_standard_references(standard_id);

COMMENT ON TABLE public.module_standard_references IS 'Optional: link standards to CORPUS source_registry or external URLs.';
