-- Fix INT32 serialization issue in v_eligible_ofc_library view
-- Cast COUNT() to text to prevent INT32 overflow errors
-- 
-- Run with: npx tsx tools/run_sql.ts tools/sql/fix_view_citation_count_int32.sql

CREATE OR REPLACE VIEW public.v_eligible_ofc_library AS
SELECT 
  ol.ofc_id,
  ol.scope,
  ol.sector,
  ol.subsector,
  ol.link_type,
  ol.link_key,
  ol.trigger_response,
  ol.ofc_text,
  ol.solution_role,
  ol.status,
  COUNT(olc.source_id)::text as citation_count,
  ol.created_at,
  ol.updated_at
FROM public.ofc_library ol
LEFT JOIN public.ofc_library_citations olc ON ol.ofc_id = olc.ofc_id
WHERE ol.status = 'ACTIVE'
GROUP BY ol.ofc_id
HAVING COUNT(olc.source_id) >= 1;

COMMENT ON VIEW public.v_eligible_ofc_library IS
'OFCs eligible for nomination: ACTIVE status and >= 1 citation. citation_count is TEXT to avoid INT32 serialization issues.';
