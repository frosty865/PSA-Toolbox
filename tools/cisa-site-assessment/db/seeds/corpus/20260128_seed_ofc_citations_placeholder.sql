-- CORPUS: One placeholder citation per OFC template (so standards can be APPROVED and generation works).
-- Run after module_standard_citations table and standard seeds (EV_PARKING, EAP).
-- Inserts only for OFC templates that have zero citations; safe to re-run.

INSERT INTO public.module_standard_citations (
  standard_id,
  criterion_key,
  template_key,
  source_title,
  source_publisher,
  source_url,
  publication_date,
  locator_type,
  locator_value
)
SELECT
  c.standard_id,
  c.criterion_key,
  t.template_key,
  'Standard doctrine (placeholder)',
  NULL,
  NULL,
  NULL,
  'other',
  'Doctrine'
FROM public.module_standard_criterion_ofc_templates t
JOIN public.module_standard_criteria c ON c.id = t.criterion_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.module_standard_citations cit
  WHERE cit.standard_id = c.standard_id
    AND cit.criterion_key = c.criterion_key
    AND cit.template_key = t.template_key
);
