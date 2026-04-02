-- Drop Unused Empty Tables
-- 
-- PURPOSE: Remove empty tables that are confirmed unused in the codebase.
-- These tables have 0 rows and are not referenced in any active code paths.
--
-- WARNING: Review the list below before running. These tables are:
-- - Confirmed empty (0 rows)
-- - Not used in codebase (no queries found)
-- - Safe to drop (no foreign key dependencies from active tables)
--
-- USAGE:
--   psql "$DATABASE_URL" -f tools/drop_unused_empty_tables.sql
--   Or using Node.js script:
--   npx tsx tools/drop_unused_empty_tables.ts

BEGIN;

-- Verify tables are empty before dropping (safety check)
DO $$
DECLARE
    table_name TEXT;
    row_count INTEGER;
    tables_to_drop TEXT[] := ARRAY[
        'compliance_report'
    ];
BEGIN
    FOREACH table_name IN ARRAY tables_to_drop
    LOOP
        -- Check if table exists and get row count
        EXECUTE format('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ''public'' AND table_name = %L', table_name) INTO row_count;
        
        IF row_count > 0 THEN
            -- Table exists, check if it's empty
            EXECUTE format('SELECT COUNT(*) FROM public.%I', table_name) INTO row_count;
            
            IF row_count > 0 THEN
                RAISE EXCEPTION 'Table % has % rows. Aborting drop operation.', table_name, row_count;
            END IF;
        END IF;
    END LOOP;
END $$;

-- Drop empty unused tables
DROP TABLE IF EXISTS public.compliance_report CASCADE;

COMMIT;

-- Verification query (run after commit to confirm)
-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN (
--     'assessment_responses',
--     'assessment_vulnerability_sectors',
--     'baseline_questions',
--     'baseline_responses',
--     'canonical_question_templates',
--     'canonical_sources',
--     'citation_bindings',
--     'citation_requests',
--     'document_subtype_relevance',
--     'normalized_findings',
--     'normalized_ofcs',
--     'observed_vulnerabilities',
--     'ofc_nomination_decisions',
--     'phase6_reviews',
--     'subsector_discipline_weight_history',
--     'user_profiles'
-- );
-- Should return 0 rows if successful
