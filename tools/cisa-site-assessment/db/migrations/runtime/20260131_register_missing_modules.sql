-- RUNTIME: Register missing assessment_modules so module_sources FK (module_sources_module_code_fkey) does not fail.
-- MODULE_PENDING: Organizational tag only (not a real module). Used so pending documents can have a module_sources row until assigned to a module in the UI. Run when module_documents or incoming PDFs reference module_codes not yet in assessment_modules (e.g. MODULE_EV_CHARGING, _PENDING).
-- Easy to extend: add more VALUES rows or run additional INSERT ... ON CONFLICT DO NOTHING.
--
-- Run commands (for PR / notes):
-- 1) Confirm FK target:
--    psql $env:RUNTIME_DB_URL -c "SELECT conname, pg_get_constraintdef(c.oid) AS def FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE conname = 'module_sources_module_code_fkey';"
-- 2) See which module_codes are missing (module_documents referenced but not registered):
--    psql $env:RUNTIME_DB_URL -c "WITH used AS (SELECT DISTINCT module_code FROM public.module_documents), registered AS (SELECT DISTINCT module_code FROM public.assessment_modules) SELECT u.module_code FROM used u LEFT JOIN registered r ON r.module_code = u.module_code WHERE r.module_code IS NULL ORDER BY u.module_code;"
-- 3) Apply migration:
--    cd D:\PSA_System\psa_rebuild && psql $env:RUNTIME_DB_URL -f db/migrations/runtime/20260131_register_missing_modules.sql
-- 4) Run watcher:
--    npx tsx tools/corpus/watch_module_ingestion.ts

INSERT INTO public.assessment_modules (module_code, module_name, is_active, created_at, updated_at)
VALUES
  ('MODULE_EV_CHARGING', 'EV Charging', true, now(), now()),
  ('MODULE_PENDING', 'Pending (organizational tag)', true, now(), now())
ON CONFLICT (module_code) DO NOTHING;
