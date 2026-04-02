-- ============================================================================
-- report_snapshots: ON DELETE CASCADE for assessment_instance_id FK
-- ============================================================================
-- When rows in assessment_instances are deleted, automatically delete
-- referencing rows in report_snapshots so purge/test-cleanup does not fail.
-- No-op if public.report_snapshots does not exist (e.g. schema never had it).
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'report_snapshots'
  ) THEN
    ALTER TABLE public.report_snapshots
      DROP CONSTRAINT IF EXISTS report_snapshots_assessment_instance_id_fkey,
      ADD CONSTRAINT report_snapshots_assessment_instance_id_fkey
        FOREIGN KEY (assessment_instance_id)
        REFERENCES public.assessment_instances(id)
        ON DELETE CASCADE;
  END IF;
END $$;
