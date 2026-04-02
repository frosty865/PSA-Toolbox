-- CORPUS: Citations for OFC templates (doctrine).
-- Every OFC template (criterion_key + template_key) must have >=1 citation before standard can be APPROVED.
-- Run on CORPUS database only.

CREATE TABLE IF NOT EXISTS public.module_standard_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_id UUID NOT NULL REFERENCES public.module_standards(id) ON DELETE CASCADE,
  criterion_key TEXT NOT NULL,
  template_key TEXT NOT NULL,
  source_registry_id UUID NULL,
  source_title TEXT NULL,
  source_publisher TEXT NULL,
  source_url TEXT NULL,
  publication_date DATE NULL,
  locator_type TEXT NOT NULL DEFAULT 'page' CHECK (locator_type IN ('page', 'section', 'paragraph', 'url_fragment', 'other')),
  locator_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_standard_citations_standard
  ON public.module_standard_citations(standard_id);
CREATE INDEX IF NOT EXISTS idx_module_standard_citations_ofc
  ON public.module_standard_citations(standard_id, criterion_key, template_key);

COMMENT ON TABLE public.module_standard_citations IS
  'Citations for OFC templates. At least one citation per (criterion_key, template_key) required before standard can be APPROVED.';
