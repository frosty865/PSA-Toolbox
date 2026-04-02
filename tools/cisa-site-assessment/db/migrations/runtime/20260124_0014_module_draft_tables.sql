-- Migration: Module draft staging for Automated Module Draft Builder
-- Date: 2026-01-24
-- Purpose: Add module_drafts, module_draft_sources, module_draft_questions for
--          source-driven draft creation. No OFC or module_questions/module_ofcs
--          are created by automation; publish is an explicit action.
-- TARGET DB: RUNTIME

BEGIN;

-- 1) module_drafts
CREATE TABLE IF NOT EXISTS public.module_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code TEXT NULL,
  title TEXT NOT NULL,
  summary TEXT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_module_drafts_module_code
  ON public.module_drafts (module_code) WHERE module_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_module_drafts_status ON public.module_drafts (status);

COMMENT ON TABLE public.module_drafts IS
'Draft module shells from automated source-driven builder. Publish copies ACCEPTED questions to module_questions. No OFC automation.';

-- 2) module_draft_sources
CREATE TABLE IF NOT EXISTS public.module_draft_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES public.module_drafts(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  source_label TEXT NULL,
  source_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_module_draft_sources_draft ON public.module_draft_sources (draft_id);

COMMENT ON COLUMN public.module_draft_sources.source_id IS
'Source identifier: source_registry.id (uuid string) or source_key from CORPUS.';

-- 3) module_draft_questions
CREATE TABLE IF NOT EXISTS public.module_draft_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES public.module_drafts(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  discipline_id UUID NOT NULL REFERENCES public.disciplines(id) ON DELETE RESTRICT,
  discipline_subtype_id UUID NULL REFERENCES public.discipline_subtypes(id) ON DELETE SET NULL,
  confidence NUMERIC(5,4) NULL,
  rationale TEXT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'ACCEPTED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_module_draft_questions_draft ON public.module_draft_questions (draft_id);
CREATE INDEX IF NOT EXISTS idx_module_draft_questions_status ON public.module_draft_questions (draft_id, status);

COMMENT ON TABLE public.module_draft_questions IS
'Draft question stubs from builder. Only ACCEPTED are copied to module_questions on publish. No OFC creation.';

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_module_drafts_updated_at ON public.module_drafts;
CREATE TRIGGER trg_module_drafts_updated_at
  BEFORE UPDATE ON public.module_drafts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_module_draft_questions_updated_at ON public.module_draft_questions;
CREATE TRIGGER trg_module_draft_questions_updated_at
  BEFORE UPDATE ON public.module_draft_questions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

COMMIT;
