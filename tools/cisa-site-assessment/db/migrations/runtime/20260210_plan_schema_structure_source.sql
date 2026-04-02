-- RUNTIME: Add structure_source_registry_id to plan_schema_registry (which source was used for section extraction).

BEGIN;

ALTER TABLE public.plan_schema_registry
  ADD COLUMN IF NOT EXISTS structure_source_registry_id uuid NULL;

COMMENT ON COLUMN public.plan_schema_registry.structure_source_registry_id IS 'source_registry_id of the requirement document used for TOC/section extraction (Structure Source). NULL = not recorded.';

COMMIT;
