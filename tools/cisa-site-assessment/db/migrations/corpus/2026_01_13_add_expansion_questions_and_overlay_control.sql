-- CORPUS: Expansion Questions + Overlay Control + Match Outputs
-- Date: 2026-01-13
-- Purpose: Add expansion question support with explicit overlay control and dual-pass matching
--
-- HARD RULE: This migration is for CORPUS project ONLY
-- Do NOT run this on RUNTIME project

-- ============================================================================
-- 1. Expansion Questions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.expansion_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expansion_version TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('SECTOR', 'SUBSECTOR', 'TECHNOLOGY')),
  scope_code TEXT NOT NULL,
  question_code TEXT NOT NULL,
  question_text TEXT NOT NULL,
  response_enum JSONB NOT NULL DEFAULT '["YES","NO","N_A"]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_expansion_questions_version_code UNIQUE(expansion_version, question_code)
);

COMMENT ON TABLE public.expansion_questions IS
'Expansion questions (sector/subsector/technology overlays) separate from baseline. CORPUS project only.';

CREATE INDEX IF NOT EXISTS idx_expansion_questions_scope 
  ON public.expansion_questions(scope_type, scope_code, is_active);

CREATE INDEX IF NOT EXISTS idx_expansion_questions_active 
  ON public.expansion_questions(is_active) 
  WHERE is_active = true;

-- ============================================================================
-- 2. Overlay Selection Control Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.corpus_overlay_control (
  id SERIAL PRIMARY KEY,
  active_sector_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_subsector_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_technology_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_single_row CHECK (id = 1)
);

COMMENT ON TABLE public.corpus_overlay_control IS
'Controls which expansion overlays are active for matching. Single row table. CORPUS project only.';

-- Seed exactly one row if empty
INSERT INTO public.corpus_overlay_control (id, active_sector_codes, active_subsector_codes, active_technology_codes)
SELECT 1, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.corpus_overlay_control);

-- ============================================================================
-- 3. Match Run Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.corpus_match_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_set TEXT NOT NULL,
  universe TEXT NOT NULL CHECK (universe IN ('BASE', 'EXPANSION')),
  overlay_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  threshold NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.corpus_match_runs IS
'Records match runs (BASE or EXPANSION universe) with overlay snapshot. CORPUS project only.';

CREATE INDEX IF NOT EXISTS idx_corpus_match_runs_source_set 
  ON public.corpus_match_runs(source_set, universe);

CREATE INDEX IF NOT EXISTS idx_corpus_match_runs_created_at 
  ON public.corpus_match_runs(created_at DESC);

-- ============================================================================
-- 4. Candidate Question Links Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.corpus_candidate_question_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_run_id UUID NOT NULL REFERENCES public.corpus_match_runs(id) ON DELETE CASCADE,
  source_set TEXT NOT NULL,
  universe TEXT NOT NULL CHECK (universe IN ('BASE', 'EXPANSION')),
  candidate_id UUID NOT NULL,
  question_code TEXT NOT NULL,
  score NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.corpus_candidate_question_links IS
'Links candidates to questions (BASE or EXPANSION) with scores. CORPUS project only.';

CREATE INDEX IF NOT EXISTS idx_corpus_candidate_question_links_match_run 
  ON public.corpus_candidate_question_links(match_run_id);

CREATE INDEX IF NOT EXISTS idx_corpus_candidate_question_links_source_universe 
  ON public.corpus_candidate_question_links(source_set, universe);

CREATE INDEX IF NOT EXISTS idx_corpus_candidate_question_links_candidate 
  ON public.corpus_candidate_question_links(candidate_id);

CREATE INDEX IF NOT EXISTS idx_corpus_candidate_question_links_question 
  ON public.corpus_candidate_question_links(question_code);

