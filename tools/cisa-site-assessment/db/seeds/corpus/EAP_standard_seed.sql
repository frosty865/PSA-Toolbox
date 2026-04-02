-- EAP (Emergency Action Plan) Module Standard — minimal PLAN-type seed
-- Run on CORPUS database after 20260128_1500_module_standards_type.sql
-- Proves OBJECT vs PLAN filtering; generation logic for PLAN is separate.

BEGIN;

INSERT INTO public.module_standards (standard_key, name, status, standard_type, description, version)
VALUES (
  'EAP',
  'Emergency Action Plan',
  'APPROVED',
  'PLAN',
  'Doctrine plan standard: generates plan coverage criteria and OFC templates.',
  'v1'
)
ON CONFLICT (standard_key) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  standard_type = EXCLUDED.standard_type,
  description = EXCLUDED.description,
  version = EXCLUDED.version,
  updated_at = now();

COMMIT;
