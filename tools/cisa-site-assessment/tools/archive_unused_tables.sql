-- Archive Unused Tables with Data
-- 
-- PURPOSE: Move unused tables that contain data to an archive schema.
-- This preserves historical data while cleaning up the public schema.
--
-- WARNING: Review the list below before running. These tables are:
-- - Confirmed unused in codebase (no queries found)
-- - Contain data (rows > 0)
-- - Will be moved to archive schema (not deleted)
--
-- USAGE:
--   psql "$DATABASE_URL" -f tools/archive_unused_tables.sql
--   Or using Node.js script:
--   npx tsx tools/archive_unused_tables.ts

BEGIN;

-- Create archive schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS archive;

-- Move unused/deprecated tables to archive schema (aligned with config/db_schema_status.json)
-- Note: ALTER TABLE ... SET SCHEMA is atomic and preserves all data, indexes, constraints

ALTER TABLE IF EXISTS public.assessment_questions SET SCHEMA archive;
ALTER TABLE IF EXISTS public.assessment_templates SET SCHEMA archive;
ALTER TABLE IF EXISTS public.assessment_vulnerability_sectors SET SCHEMA archive;
ALTER TABLE IF EXISTS public.baseline_questions SET SCHEMA archive;
ALTER TABLE IF EXISTS public.baseline_questions_legacy SET SCHEMA archive;
ALTER TABLE IF EXISTS public.baseline_responses SET SCHEMA archive;
ALTER TABLE IF EXISTS public.canonical_disciplines SET SCHEMA archive;
ALTER TABLE IF EXISTS public.canonical_manifest SET SCHEMA archive;
ALTER TABLE IF EXISTS public.canonical_ofc_patterns SET SCHEMA archive;
ALTER TABLE IF EXISTS public.canonical_question_no_map SET SCHEMA archive;
ALTER TABLE IF EXISTS public.canonical_question_templates SET SCHEMA archive;
ALTER TABLE IF EXISTS public.canonical_subtypes SET SCHEMA archive;
ALTER TABLE IF EXISTS public.canonical_vulnerability_patterns SET SCHEMA archive;
ALTER TABLE IF EXISTS public.citation_bindings SET SCHEMA archive;
ALTER TABLE IF EXISTS public.citation_requests SET SCHEMA archive;
ALTER TABLE IF EXISTS public.compliance_report SET SCHEMA archive;
ALTER TABLE IF EXISTS public.discipline_subtypes SET SCHEMA archive;
ALTER TABLE IF EXISTS public.document_subtype_relevance SET SCHEMA archive;
ALTER TABLE IF EXISTS public.drift_scan SET SCHEMA archive;
ALTER TABLE IF EXISTS public.normalized_findings SET SCHEMA archive;
ALTER TABLE IF EXISTS public.normalized_ofcs SET SCHEMA archive;
ALTER TABLE IF EXISTS public.observed_vulnerabilities SET SCHEMA archive;
ALTER TABLE IF EXISTS public.ofc_nomination_decisions SET SCHEMA archive;
ALTER TABLE IF EXISTS public.ofc_wipe_log SET SCHEMA archive;
ALTER TABLE IF EXISTS public.phase6_reviews SET SCHEMA archive;
ALTER TABLE IF EXISTS public.report_snapshots SET SCHEMA archive;
ALTER TABLE IF EXISTS public.sector_metrics SET SCHEMA archive;
ALTER TABLE IF EXISTS public.subdiscipline_sector_filter SET SCHEMA archive;
ALTER TABLE IF EXISTS public.subsector_discipline_map SET SCHEMA archive;
ALTER TABLE IF EXISTS public.subsector_discipline_weight_history SET SCHEMA archive;
ALTER TABLE IF EXISTS public.subsector_metrics SET SCHEMA archive;
ALTER TABLE IF EXISTS public.technology_maturity_definitions SET SCHEMA archive;
ALTER TABLE IF EXISTS public.technology_maturity_lookup SET SCHEMA archive;
ALTER TABLE IF EXISTS public.user_profiles SET SCHEMA archive;

COMMIT;

-- Verification query (run after commit to confirm)
-- SELECT 
--   table_schema,
--   table_name,
--   (SELECT COUNT(*) FROM information_schema.columns 
--    WHERE table_schema = t.table_schema AND table_name = t.table_name) as column_count
-- FROM information_schema.tables t
-- WHERE table_schema = 'archive'
--   AND table_name IN (
--     'assessment_questions',
--     'assessment_templates',
--     'baseline_questions_legacy',
--     'canonical_disciplines',
--     'canonical_manifest',
--     'canonical_ofc_patterns',
--     'canonical_question_no_map',
--     'canonical_subtypes',
--     'canonical_vulnerability_patterns',
--     'compliance_report',
--     'discipline_subtypes',
--     'drift_scan',
--     'ofc_wipe_log',
--     'report_snapshots',
--     'sector_metrics',
--     'subdiscipline_sector_filter',
--     'subsector_discipline_map',
--     'subsector_metrics',
--     'technology_maturity_definitions',
--     'technology_maturity_lookup'
--   )
-- ORDER BY table_name;
-- Should show all tables in archive schema if successful
