-- PHYSICAL_SECURITY_PLAN: structural standard class (PLAN).
-- Template for plan/checklist modules; topic is module_code/title only.

INSERT INTO public.module_standards (standard_key, name, description, version, status, standard_type)
VALUES (
  'PHYSICAL_SECURITY_PLAN',
  'Physical Security Plan (Plan)',
  'Template class for plan/checklist coverage. Does the plan address X? Topic is set by module.',
  'v1',
  'APPROVED',
  'PLAN'
)
ON CONFLICT (standard_key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, version = EXCLUDED.version, status = EXCLUDED.status, standard_type = EXCLUDED.standard_type, updated_at = now();
