-- RUNTIME: Versioned plan schemas (schema-first pipeline). One row per module + structure source; is_active for "current".
-- Separate from plan_schema_registry; new pipeline uses plan_schemas + plan_schemas_sections + plan_schemas_elements.

BEGIN;

-- 1) One schema per module + structure source (versionable, regression-safe)
CREATE TABLE IF NOT EXISTS public.plan_schemas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code text NOT NULL,
  structure_source_registry_id uuid NOT NULL,
  derive_method text NOT NULL CHECK (derive_method IN ('TOC', 'HEADINGS', 'LEGACY')),
  confidence text NOT NULL CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  schema_hash text NOT NULL,
  schema_json jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_schemas_module_code ON public.plan_schemas(module_code);
CREATE INDEX IF NOT EXISTS idx_plan_schemas_structure_source ON public.plan_schemas(structure_source_registry_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_schemas_active_per_module
  ON public.plan_schemas(module_code)
  WHERE is_active = true;

-- 2) Flattened sections (for UI + querying) — distinct name to avoid conflict with plan_schema_sections
CREATE TABLE IF NOT EXISTS public.plan_schemas_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_schema_id uuid NOT NULL REFERENCES public.plan_schemas(id) ON DELETE CASCADE,
  section_ord int NOT NULL,
  section_key text NOT NULL,
  section_title text NOT NULL,
  source_locator jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_schemas_sections_ord
  ON public.plan_schemas_sections(plan_schema_id, section_ord);

-- 3) Vital elements under each section
CREATE TABLE IF NOT EXISTS public.plan_schemas_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_schema_id uuid NOT NULL REFERENCES public.plan_schemas(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.plan_schemas_sections(id) ON DELETE CASCADE,
  element_ord int NOT NULL,
  element_key text NOT NULL,
  element_label text NOT NULL,
  is_core boolean NOT NULL DEFAULT false,
  source_excerpt text NULL,
  source_locator jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_schemas_elements_ord
  ON public.plan_schemas_elements(section_id, element_ord);

COMMENT ON TABLE public.plan_schemas IS 'Versioned plan schema per module + structure source; schema-first pipeline.';
COMMENT ON TABLE public.plan_schemas_sections IS 'Sections for a versioned plan schema.';
COMMENT ON TABLE public.plan_schemas_elements IS 'Vital elements per section for versioned plan schema.';

COMMIT;
