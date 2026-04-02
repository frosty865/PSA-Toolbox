-- PHYSICAL_SECURITY_MEASURES: structural standard class (OBJECT).
-- Template for physical security measures; topic is module_code/title only.

INSERT INTO public.module_standards (standard_key, name, description, version, status, standard_type)
VALUES (
  'PHYSICAL_SECURITY_MEASURES',
  'Physical Security Measures (Object)',
  'Template class for physical security measures. YES/NO questions; observable physical evidence. Topic is set by module.',
  'v1',
  'APPROVED',
  'OBJECT'
)
ON CONFLICT (standard_key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, version = EXCLUDED.version, status = EXCLUDED.status, standard_type = EXCLUDED.standard_type, updated_at = now();
