-- RUNTIME: Make v_canonical_ofcs_publish_ready return no rows (view should be empty).
-- Preserves view structure so existing references do not break.

CREATE OR REPLACE VIEW public.v_canonical_ofcs_publish_ready AS
SELECT
  o.*,
  (SELECT count(*) FROM public.canonical_ofc_citations c WHERE c.canonical_ofc_id = o.canonical_ofc_id) AS citation_count
FROM public.canonical_ofcs o
WHERE o.status = 'ACTIVE' AND false;
