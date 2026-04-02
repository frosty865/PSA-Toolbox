-- Recreate v_eligible_ofc_library view
-- TARGET DB: RUNTIME
-- 
-- Run with: npx tsx tools/run_sql.ts tools/sql/recreate_v_eligible_ofc_library.sql
-- Or execute directly against RUNTIME database

-- ============================================================================
-- Drop existing view if it exists (CASCADE to handle any dependencies)
-- ============================================================================

DROP VIEW IF EXISTS public.v_eligible_ofc_library CASCADE;

-- ============================================================================
-- Create view: Eligible OFCs (citation count >= 1, status = ACTIVE)
-- ============================================================================

CREATE VIEW public.v_eligible_ofc_library AS
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

-- ============================================================================
-- Add comment
-- ============================================================================

COMMENT ON VIEW public.v_eligible_ofc_library IS
'OFCs eligible for nomination: ACTIVE status and >= 1 citation. citation_count is TEXT to avoid INT32 serialization issues.';

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 
  'v_eligible_ofc_library' as view_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'v_eligible_ofc_library'
  ) THEN 'CREATED' ELSE 'FAILED' END as status;
