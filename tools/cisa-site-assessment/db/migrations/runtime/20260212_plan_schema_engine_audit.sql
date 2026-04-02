-- RUNTIME: Audit metadata for plan schema derivation (engine, method, confidence, model).

BEGIN;

ALTER TABLE public.plan_schema_registry
  ADD COLUMN IF NOT EXISTS engine_used text NULL;
ALTER TABLE public.plan_schema_registry
  ADD COLUMN IF NOT EXISTS derive_method text NULL;
ALTER TABLE public.plan_schema_registry
  ADD COLUMN IF NOT EXISTS confidence text NULL;
ALTER TABLE public.plan_schema_registry
  ADD COLUMN IF NOT EXISTS model_used text NULL;

COMMENT ON COLUMN public.plan_schema_registry.engine_used IS 'TOC_PREFERRED | LEGACY. Which derivation engine was used.';
COMMENT ON COLUMN public.plan_schema_registry.derive_method IS 'TOC | HEADINGS | LEGACY_LLM. How sections/elements were produced.';
COMMENT ON COLUMN public.plan_schema_registry.confidence IS 'HIGH | MEDIUM | LOW. Audit confidence for this derivation.';
COMMENT ON COLUMN public.plan_schema_registry.model_used IS 'Ollama model name when LEGACY_LLM was used; NULL for TOC path.';

COMMIT;
