-- RUNTIME: Idempotent upsert support for module_chunk_comprehension
-- Adds UNIQUE(module_code, chunk_id), updated_at, and comprehension_error for failure rows

BEGIN;

-- Add columns if missing
ALTER TABLE public.module_chunk_comprehension
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NULL;

ALTER TABLE public.module_chunk_comprehension
  ADD COLUMN IF NOT EXISTS comprehension_error text NULL;

COMMENT ON COLUMN public.module_chunk_comprehension.comprehension_error IS
  'Set when LLM/parse failed; row still written so table is never empty due to parse errors.';

-- Unique constraint for ON CONFLICT upsert (one row per module_code + chunk_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_module_chunk_comprehension_module_chunk
  ON public.module_chunk_comprehension(module_code, chunk_id);

COMMIT;
