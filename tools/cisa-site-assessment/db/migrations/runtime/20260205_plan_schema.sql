-- RUNTIME: Store derived plan schema per module (sections + critical elements).
-- Replaces manual plan packs; each PLAN module derives structure from its requirement sources.

BEGIN;

CREATE TABLE IF NOT EXISTS public.plan_schema_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code text NOT NULL UNIQUE,
  schema_version int NOT NULL DEFAULT 1,
  source_set_hash text NOT NULL,
  derived_at timestamptz NOT NULL DEFAULT now(),
  derived_model text NULL,
  notes text NULL
);

CREATE TABLE IF NOT EXISTS public.plan_schema_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id uuid NOT NULL REFERENCES public.plan_schema_registry(id) ON DELETE CASCADE,
  section_order int NOT NULL,
  section_key text NOT NULL,
  section_title text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plan_schema_sections_schema_order
  ON public.plan_schema_sections(schema_id, section_order);

CREATE TABLE IF NOT EXISTS public.plan_schema_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.plan_schema_sections(id) ON DELETE CASCADE,
  element_order int NOT NULL,
  element_key text NOT NULL,
  element_title text NOT NULL,
  observation text NOT NULL,
  ofc text NOT NULL,
  impact text NOT NULL,
  evidence_terms text[] NULL
);

CREATE INDEX IF NOT EXISTS idx_plan_schema_elements_section_order
  ON public.plan_schema_elements(section_id, element_order);

COMMENT ON TABLE public.plan_schema_registry IS 'One row per PLAN module: derived schema from requirement sources (templates/guides).';
COMMENT ON TABLE public.plan_schema_sections IS 'Sections (TOC/headings) for a plan schema.';
COMMENT ON TABLE public.plan_schema_elements IS 'Critical elements per section: observation + exactly one OFC + impact.';

COMMIT;
