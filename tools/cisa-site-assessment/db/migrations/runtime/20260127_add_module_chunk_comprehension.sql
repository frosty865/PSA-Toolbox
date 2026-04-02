-- RUNTIME: Module Chunk Comprehension Table
-- Stores structured comprehension outputs from chunks before vulnerability extraction
-- This is the "comprehension layer" that interprets chunks and labels them

BEGIN;

CREATE TABLE IF NOT EXISTS public.module_chunk_comprehension (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  module_code text NOT NULL,

  -- Evidence anchor (points back to CORPUS)
  source_registry_id uuid NOT NULL,
  doc_id uuid NOT NULL,
  chunk_id uuid NOT NULL,
  locator text NOT NULL DEFAULT '',

  -- Comprehension outputs
  primary_domains jsonb NOT NULL DEFAULT '[]'::jsonb,   -- 1..2
  secondary_domains jsonb NOT NULL DEFAULT '[]'::jsonb, -- 0..3
  explicit_topics jsonb NOT NULL DEFAULT '[]'::jsonb,   -- short topic strings
  implied_risks jsonb NOT NULL DEFAULT '[]'::jsonb,     -- short risk strings
  site_observable boolean NOT NULL,
  supports_question_generation boolean NOT NULL,
  generation_priority text NOT NULL, -- HIGH | MEDIUM | LOW
  life_safety_signal boolean NOT NULL, -- true when chunk materially supports life safety extraction
  ops_signal boolean NOT NULL,         -- true when chunk materially supports ops/procedures/exercises ownership
  cyber_awareness_signal boolean NOT NULL, -- phishing/scams/fraud only (no technical)

  -- Guardrails / traceability
  llm_model text NOT NULL,
  llm_run_id text NOT NULL,
  llm_confidence numeric NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mod_comp_module_code ON public.module_chunk_comprehension(module_code);
CREATE INDEX IF NOT EXISTS idx_mod_comp_chunk_id ON public.module_chunk_comprehension(chunk_id);

COMMENT ON TABLE public.module_chunk_comprehension IS 'Structured comprehension of chunks before vulnerability extraction. Source-anchored meaning labels.';

COMMIT;
