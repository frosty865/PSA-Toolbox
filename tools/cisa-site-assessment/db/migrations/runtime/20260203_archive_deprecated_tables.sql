-- RUNTIME: Move deprecated/unused tables to archive schema (idempotent).
-- Purpose: Identify deprecated tables per config/db_schema_status.json and move them to archive.
-- Data is preserved; tables are not dropped.
--
-- Run: psql "$RUNTIME_DB_URL" -f db/migrations/runtime/20260203_archive_deprecated_tables.sql
-- Or: npx tsx tools/run_sql.ts db/migrations/runtime/20260203_archive_deprecated_tables.sql (if run_sql uses RUNTIME)

BEGIN;

CREATE SCHEMA IF NOT EXISTS archive;

-- Move each deprecated/unused table to archive if it exists in public and not already in archive.
-- List aligned with config/db_schema_status.json archive_candidates.RUNTIME.
DO $$
DECLARE
  t text;
  tables_to_archive text[] := ARRAY[
    'assessment_questions', 'assessment_templates', 'assessment_vulnerability_sectors',
    'baseline_questions', 'baseline_questions_legacy', 'baseline_responses',
    'canonical_disciplines', 'canonical_manifest', 'canonical_ofc_patterns',
    'canonical_question_no_map', 'canonical_question_templates', 'canonical_subtypes',
    'canonical_vulnerability_patterns', 'citation_bindings', 'citation_requests',
    'compliance_report', 'discipline_subtypes', 'document_subtype_relevance',
    'drift_scan', 'normalized_findings', 'normalized_ofcs', 'observed_vulnerabilities',
    'ofc_nomination_decisions', 'ofc_wipe_log', 'phase6_reviews', 'report_snapshots',
    'sector_metrics', 'subdiscipline_sector_filter', 'subsector_discipline_map',
    'subsector_discipline_weight_history', 'subsector_metrics',
    'technology_maturity_definitions', 'technology_maturity_lookup', 'user_profiles'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_archive
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t)
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'archive' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA archive', t);
      RAISE NOTICE 'Archived: public.% -> archive.%', t, t;
    END IF;
  END LOOP;
END $$;

COMMIT;
