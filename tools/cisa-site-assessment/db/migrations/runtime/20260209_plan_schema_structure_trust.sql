-- RUNTIME: Add structure_trust to plan_schema_registry (audit: which mode was used for derivation).

BEGIN;

ALTER TABLE public.plan_schema_registry
  ADD COLUMN IF NOT EXISTS structure_trust text NOT NULL DEFAULT 'BALANCED';

COMMENT ON COLUMN public.plan_schema_registry.structure_trust IS 'Trust mode used for this derivation: TOC | BALANCED | INFERRED. Audit only; not auto-reused.';

COMMIT;
