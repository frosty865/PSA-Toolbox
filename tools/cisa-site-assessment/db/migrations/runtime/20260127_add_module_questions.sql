-- RUNTIME: Module Questions Table
-- Stores final module questions (<=12) generated from vulnerability candidates
-- Module-scoped, each question has 2-4 OFCs and evidence anchors

BEGIN;

CREATE TABLE IF NOT EXISTS public.module_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code text NOT NULL,

  -- optional for now
  discipline_subtype_id uuid NULL,

  vulnerability_title text NOT NULL,
  vulnerability_text text NOT NULL,
  impact_text text NOT NULL,

  question_text text NOT NULL,

  -- 2..4
  ofc_options jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- evidence anchors: [{source_registry_id, doc_id, chunk_id, locator}]
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- provenance
  llm_model text NOT NULL,
  llm_run_id text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_questions_module_code ON public.module_questions(module_code);

COMMENT ON TABLE public.module_questions IS 'Final module questions (<=12) generated from vulnerability candidates. Each has 2-4 OFCs and evidence anchors.';

COMMIT;
