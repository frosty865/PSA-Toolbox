-- LLM_WIZARD: placeholder standard for module instances generated from chunks (Ollama).
-- No criteria/attributes; used so GET /api/admin/module-standards/LLM_WIZARD returns 200.

INSERT INTO public.module_standards (standard_key, name, description, version, status, standard_type)
VALUES (
  'LLM_WIZARD',
  'LLM-generated (chunk)',
  'Criteria and OFCs generated from ingested chunks via Ollama. No fixed doctrine.',
  'v1',
  'APPROVED',
  'OBJECT'
)
ON CONFLICT (standard_key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, version = EXCLUDED.version, status = EXCLUDED.status, standard_type = EXCLUDED.standard_type, updated_at = now();
