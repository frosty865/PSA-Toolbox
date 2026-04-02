-- RUNTIME: Instance citations for doctrine-generated OFCs.
-- Every module_instance_ofc must have >=1 citation (enforced by trigger 20260128_1910).
-- Run on RUNTIME database only.

CREATE TABLE IF NOT EXISTS public.module_instance_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_instance_id UUID NOT NULL REFERENCES public.module_instances(id) ON DELETE CASCADE,
  criterion_key TEXT NOT NULL,
  template_key TEXT NOT NULL,
  source_title TEXT NULL,
  source_publisher TEXT NULL,
  source_url TEXT NULL,
  publication_date DATE NULL,
  locator_type TEXT NOT NULL DEFAULT 'page' CHECK (locator_type IN ('page', 'section', 'paragraph', 'url_fragment', 'other')),
  locator_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_instance_citations_instance
  ON public.module_instance_citations(module_instance_id);
CREATE INDEX IF NOT EXISTS idx_module_instance_citations_ofc
  ON public.module_instance_citations(module_instance_id, criterion_key, template_key);

COMMENT ON TABLE public.module_instance_citations IS
  'Citations for instance OFCs. At least one per (criterion_key, template_key) required (enforced by trigger).';
