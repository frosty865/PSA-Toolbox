-- =============================================================================
-- Purge all TEST assessments directly in Postgres (Supabase SQL Editor, psql, etc.)
-- Does NOT use the HTTP admin API — no ADMIN_API_TOKEN required.
--
-- Test rows match app logic:
--   qa_flag = true
--   OR non-empty test_run_id
--   OR facility_name LIKE '[QA]%'
--   OR upper(facility_name) LIKE '[TEST]%'
--
-- BEFORE YOU RUN THE DELETE BLOCK:
--   1. Run only the PREVIEW section and confirm the listed ids/names.
--   2. Backup if needed (Supabase: backup / point-in-time).
--   3. If any DELETE fails on a missing table, comment out that line for your schema.
--
-- Database: use the RUNTIME database (same as RUNTIME_DATABASE_URL / Supabase project).
--
-- Note: public.assessment_responses may use assessment_instance_id OR assessment_id
-- (see analytics/reports/pool_cleanup_runtime_authoritative.sql). The purge block handles both.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PREVIEW (safe — read-only)
-- -----------------------------------------------------------------------------
SELECT id,
       facility_name,
       qa_flag,
       test_run_id,
       created_at
FROM public.assessments
WHERE (
    qa_flag = true
    OR (test_run_id IS NOT NULL AND btrim(test_run_id::text) <> '')
    OR facility_name LIKE '[QA]%'
    OR upper(facility_name) LIKE '[TEST]%'
  )
ORDER BY created_at DESC;

SELECT COUNT(*) AS test_assessments_to_remove
FROM public.assessments
WHERE (
    qa_flag = true
    OR (test_run_id IS NOT NULL AND btrim(test_run_id::text) <> '')
    OR facility_name LIKE '[QA]%'
    OR upper(facility_name) LIKE '[TEST]%'
  );

-- -----------------------------------------------------------------------------
-- PURGE (destructive — run after preview)
-- -----------------------------------------------------------------------------
BEGIN;

-- Store ids as text so uuid (assessments.id) and text (assessment_instances.id / facility_id) all match
CREATE TEMP TABLE tmp_purge_assessments (id text PRIMARY KEY) ON COMMIT DROP;

INSERT INTO tmp_purge_assessments (id)
SELECT id::text
FROM public.assessments
WHERE (
    qa_flag = true
    OR (test_run_id IS NOT NULL AND btrim(test_run_id::text) <> '')
    OR facility_name LIKE '[QA]%'
    OR upper(facility_name) LIKE '[TEST]%'
  );

CREATE TEMP TABLE tmp_purge_instances (id text PRIMARY KEY) ON COMMIT DROP;

INSERT INTO tmp_purge_instances (id)
SELECT ai.id::text
FROM public.assessment_instances ai
WHERE ai.facility_id::text IN (SELECT id FROM tmp_purge_assessments)
   OR ai.id::text IN (SELECT id FROM tmp_purge_assessments);

-- Instance-scoped (order matches app delete_assessment_cascade)
DELETE FROM public.assessment_technology_profiles
WHERE assessment_instance_id::text IN (SELECT id FROM tmp_purge_instances);

-- assessment_responses: RUNTIME schemas differ — some use assessment_instance_id, others assessment_id only
DO $purge_ar$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assessment_responses'
      AND column_name = 'assessment_instance_id'
  ) THEN
    DELETE FROM public.assessment_responses ar
    WHERE ar.assessment_instance_id::text IN (SELECT id FROM tmp_purge_instances);
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assessment_responses'
      AND column_name = 'assessment_id'
  ) THEN
    DELETE FROM public.assessment_responses ar
    WHERE ar.assessment_id::text IN (SELECT id FROM tmp_purge_assessments);
  END IF;
END $purge_ar$;

-- Assessment-scoped (assessment_id may be uuid or text per deployment)
DELETE FROM public.assessment_question_responses
WHERE assessment_id::text IN (SELECT id FROM tmp_purge_assessments);

DELETE FROM public.assessment_expansion_responses
WHERE assessment_id::text IN (SELECT id FROM tmp_purge_assessments);

DELETE FROM public.assessment_expansion_profiles
WHERE assessment_id::text IN (SELECT id FROM tmp_purge_assessments);

DELETE FROM public.assessment_question_universe
WHERE assessment_id::text IN (SELECT id FROM tmp_purge_assessments);

DELETE FROM public.assessment_required_elements
WHERE assessment_id::text IN (SELECT id FROM tmp_purge_assessments);

DELETE FROM public.assessment_status
WHERE assessment_id::text IN (SELECT id FROM tmp_purge_assessments);

DELETE FROM public.assessment_definitions
WHERE assessment_id::text IN (SELECT id FROM tmp_purge_assessments);

DELETE FROM public.ofc_nominations
WHERE assessment_id::text IN (SELECT id FROM tmp_purge_assessments);

DELETE FROM public.assessment_followup_responses
WHERE assessment_id::text IN (SELECT id FROM tmp_purge_assessments);

DELETE FROM public.assessment_module_question_responses
WHERE assessment_id::text IN (SELECT id FROM tmp_purge_assessments);

DELETE FROM public.assessment_module_instances
WHERE assessment_id::text IN (SELECT id FROM tmp_purge_assessments);

DELETE FROM public.assessment_applied_ofcs
WHERE assessment_id::text IN (SELECT id FROM tmp_purge_assessments);

DELETE FROM public.assessment_applied_vulnerabilities
WHERE assessment_id::text IN (SELECT id FROM tmp_purge_assessments);

-- Instances last (report_snapshots etc. may CASCADE from instance FKs)
DELETE FROM public.assessment_instances
WHERE id::text IN (SELECT id FROM tmp_purge_instances);

DELETE FROM public.assessments
WHERE id::text IN (SELECT id FROM tmp_purge_assessments);

COMMIT;

-- Verify nothing left matching test rule
-- SELECT COUNT(*) FROM public.assessments WHERE qa_flag = true OR ... ;
