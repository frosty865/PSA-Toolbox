-- Fix INT32 serialization issues in database views
-- Cast all COUNT() operations to text to prevent INT32 overflow errors
-- 
-- Run with: npx tsx tools/run_sql.ts tools/sql/fix_views_int32_counts.sql

-- ============================================================================
-- 1. Fix v_eligible_ofc_library view
-- ============================================================================

DROP VIEW IF EXISTS public.v_eligible_ofc_library CASCADE;

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

COMMENT ON VIEW public.v_eligible_ofc_library IS
'OFCs eligible for nomination: ACTIVE status and >= 1 citation. citation_count is TEXT to avoid INT32 serialization issues.';

-- ============================================================================
-- 2. Fix v_normalized_summary view (if tables exist)
-- ============================================================================

DO $$
BEGIN
    -- Only recreate v_normalized_summary if normalized_vulnerabilities exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'normalized_vulnerabilities'
    ) THEN
        DROP VIEW IF EXISTS public.v_normalized_summary CASCADE;

        -- Check if normalized_ofcs exists for UNION ALL
        IF EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'normalized_ofcs'
        ) THEN
            CREATE VIEW public.v_normalized_summary AS
            SELECT 
                'vulnerability' AS record_type,
                discipline,
                discipline_subtype,
                status,
                COUNT(*)::text AS count
            FROM public.normalized_vulnerabilities
            GROUP BY discipline, discipline_subtype, status

            UNION ALL

            SELECT 
                'ofc' AS record_type,
                discipline,
                discipline_subtype,
                status,
                COUNT(*)::text AS count
            FROM public.normalized_ofcs
            GROUP BY discipline, discipline_subtype, status
            ORDER BY record_type, discipline, discipline_subtype, status;
        ELSE
            -- Only vulnerabilities table exists
            CREATE VIEW public.v_normalized_summary AS
            SELECT 
                'vulnerability' AS record_type,
                discipline,
                discipline_subtype,
                status,
                COUNT(*)::text AS count
            FROM public.normalized_vulnerabilities
            GROUP BY discipline, discipline_subtype, status
            ORDER BY record_type, discipline, discipline_subtype, status;
        END IF;

        COMMENT ON VIEW public.v_normalized_summary IS
'Summary counts by record type, discipline, subtype, and status. count is TEXT to avoid INT32 serialization issues.';
    END IF;
END $$;

-- ============================================================================
-- 3. Fix v_question_coverage view (if exists)
-- ============================================================================

DO $$
BEGIN
    -- Only recreate v_question_coverage if ofc_candidate_targets exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ofc_candidate_targets'
    ) THEN
        DROP VIEW IF EXISTS public.v_question_coverage CASCADE;

        CREATE VIEW public.v_question_coverage AS
        SELECT 
          target_type,
          target_key,
          COUNT(DISTINCT candidate_id) FILTER (WHERE match_mode = 'UNIVERSAL')::text as universal_candidate_count,
          COUNT(DISTINCT candidate_id) FILTER (WHERE match_mode = 'CONTEXT')::text as context_candidate_count,
          MAX(match_score) FILTER (WHERE match_mode = 'UNIVERSAL') as best_universal_score,
          MAX(match_score) FILTER (WHERE match_mode = 'CONTEXT') as best_context_score,
          -- Count promoted OFCs from library
          (SELECT COUNT(*)::text FROM public.ofc_library ol 
           WHERE ol.link_type = CASE 
             WHEN oct.target_type = 'BASE_PRIMARY' THEN 'PRIMARY_QUESTION'
             WHEN oct.target_type = 'EXPANSION_QUESTION' THEN 'EXPANSION_QUESTION'
           END
           AND ol.link_key = oct.target_key
           AND ol.status = 'ACTIVE'
          ) as promoted_ofc_count
        FROM public.ofc_candidate_targets oct
        GROUP BY target_type, target_key;

        COMMENT ON VIEW public.v_question_coverage IS
        'Coverage summary: candidate counts and promoted OFC counts per question. All count fields are TEXT to avoid INT32 serialization issues.';
    END IF;
END $$;
