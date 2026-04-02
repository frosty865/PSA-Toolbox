-- CORPUS: Ensure module_standards.status allows DRAFT (idempotent).
-- Original 20260126_1200 already has DRAFT; this migration is for any DB that had an older constraint.

BEGIN;

DO $$
DECLARE
  v_conname text;
  v_def text;
BEGIN
  FOR v_conname IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'module_standards'
      AND c.contype = 'c'
  LOOP
    SELECT pg_get_constraintdef(c.oid) INTO v_def FROM pg_constraint c WHERE c.conname = v_conname;
    IF v_def ILIKE '%status%' THEN
      EXECUTE format('ALTER TABLE public.module_standards DROP CONSTRAINT IF EXISTS %I', v_conname);
      EXIT;
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.module_standards
DROP CONSTRAINT IF EXISTS module_standards_status_chk;

ALTER TABLE public.module_standards
ADD CONSTRAINT module_standards_status_chk
CHECK (status IN ('DRAFT', 'APPROVED', 'DEPRECATED'));

COMMIT;
