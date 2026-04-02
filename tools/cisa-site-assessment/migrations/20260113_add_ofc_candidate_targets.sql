-- OFC Candidate Targets Migration
-- Date: 2025-01-13
-- Purpose: Link OFC candidates to question targets (BASE + EXPANSION)
--
-- This enables:
-- - Universal matching (all questions)
-- - Context matching (sector/subsector-specific)
-- - Coverage analysis (which questions have candidate support)

-- ============================================================================
-- 1. Create ofc_candidate_queue if it doesn't exist
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ofc_candidate_queue (
  candidate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.canonical_sources(source_id) ON DELETE RESTRICT,
  snippet_text TEXT NOT NULL,
  page_locator TEXT NULL,
  excerpt TEXT NULL,
  sector TEXT NULL,
  subsector TEXT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','REVIEWED','PROMOTED','REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ NULL,
  reviewed_by TEXT NULL
);

COMMENT ON TABLE public.ofc_candidate_queue IS
'Queue of OFC candidate snippets extracted from documents. Candidates are matched to questions before promotion.';

CREATE INDEX IF NOT EXISTS idx_ofc_candidate_queue_source 
  ON public.ofc_candidate_queue(source_id);

CREATE INDEX IF NOT EXISTS idx_ofc_candidate_queue_status 
  ON public.ofc_candidate_queue(status);

CREATE INDEX IF NOT EXISTS idx_ofc_candidate_queue_sector_subsector 
  ON public.ofc_candidate_queue(sector, subsector) 
  WHERE sector IS NOT NULL;

-- ============================================================================
-- 2. Create ofc_candidate_targets (links candidates to questions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ofc_candidate_targets (
  candidate_id UUID NOT NULL REFERENCES public.ofc_candidate_queue(candidate_id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('BASE_PRIMARY','EXPANSION_QUESTION')),
  target_key TEXT NOT NULL,
  match_mode TEXT NOT NULL CHECK (match_mode IN ('UNIVERSAL','CONTEXT')),
  match_score NUMERIC(4,3) NOT NULL CHECK (match_score >= 0.000 AND match_score <= 1.000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (candidate_id, target_type, target_key, match_mode)
);

COMMENT ON TABLE public.ofc_candidate_targets IS
'Links OFC candidates to question targets. One candidate can map to multiple questions.';

COMMENT ON COLUMN public.ofc_candidate_targets.target_type IS
'BASE_PRIMARY: ALT_SAFE primary question key; EXPANSION_QUESTION: expansion question_id.';

COMMENT ON COLUMN public.ofc_candidate_targets.target_key IS
'For BASE_PRIMARY: primary_question_key from ALT_SAFE; For EXPANSION_QUESTION: question_id from expansion_questions.';

COMMENT ON COLUMN public.ofc_candidate_targets.match_mode IS
'UNIVERSAL: matched against all questions; CONTEXT: matched with sector/subsector preference.';

COMMENT ON COLUMN public.ofc_candidate_targets.match_score IS
'Match confidence score 0.000-1.000. Higher = better match.';

CREATE INDEX IF NOT EXISTS idx_oct_target 
  ON public.ofc_candidate_targets(target_type, target_key);

CREATE INDEX IF NOT EXISTS idx_oct_mode_score 
  ON public.ofc_candidate_targets(match_mode, match_score DESC);

CREATE INDEX IF NOT EXISTS idx_oct_candidate 
  ON public.ofc_candidate_targets(candidate_id);

-- ============================================================================
-- 3. Optional: Add quick-lookup columns to candidate queue
-- ============================================================================

DO $$
BEGIN
  -- Add best_universal_target (for quick display)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_candidate_queue' 
    AND column_name = 'best_universal_target'
  ) THEN
    ALTER TABLE public.ofc_candidate_queue 
      ADD COLUMN best_universal_target TEXT NULL;
  END IF;

  -- Add best_context_target (for quick display)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_candidate_queue' 
    AND column_name = 'best_context_target'
  ) THEN
    ALTER TABLE public.ofc_candidate_queue 
      ADD COLUMN best_context_target TEXT NULL;
  END IF;
END $$;

-- ============================================================================
-- 4. View: Candidate targets with question details
-- ============================================================================

CREATE OR REPLACE VIEW public.v_candidate_targets_with_details AS
SELECT 
  oct.candidate_id,
  oct.target_type,
  oct.target_key,
  oct.match_mode,
  oct.match_score,
  ocq.snippet_text,
  ocq.page_locator,
  ocq.sector,
  ocq.subsector,
  ocq.status as candidate_status,
  cs.title as source_title,
  cs.citation_text,
  -- For BASE_PRIMARY, we'd need to join to ALT_SAFE model (stored separately)
  -- For EXPANSION_QUESTION, join to expansion_questions
  eq.question_text as expansion_question_text,
  eq.subtype_code as expansion_subtype_code,
  sep.profile_id as expansion_profile_id,
  sep.sector as expansion_sector,
  sep.subsector as expansion_subsector
FROM public.ofc_candidate_targets oct
JOIN public.ofc_candidate_queue ocq ON oct.candidate_id = ocq.candidate_id
JOIN public.canonical_sources cs ON ocq.source_id = cs.source_id
LEFT JOIN public.expansion_questions eq ON 
  oct.target_type = 'EXPANSION_QUESTION' AND oct.target_key = eq.question_id::text
LEFT JOIN public.sector_expansion_profiles sep ON eq.profile_id = sep.profile_id;

COMMENT ON VIEW public.v_candidate_targets_with_details IS
'Candidate targets with full question and source details for review UI.';

-- ============================================================================
-- 5. View: Question coverage summary
-- ============================================================================

CREATE OR REPLACE VIEW public.v_question_coverage AS
SELECT 
  target_type,
  target_key,
  COUNT(DISTINCT candidate_id) FILTER (WHERE match_mode = 'UNIVERSAL') as universal_candidate_count,
  COUNT(DISTINCT candidate_id) FILTER (WHERE match_mode = 'CONTEXT') as context_candidate_count,
  MAX(match_score) FILTER (WHERE match_mode = 'UNIVERSAL') as best_universal_score,
  MAX(match_score) FILTER (WHERE match_mode = 'CONTEXT') as best_context_score,
  -- Count promoted OFCs from library
  (SELECT COUNT(*) FROM public.ofc_library ol 
   WHERE ol.link_type = CASE 
     WHEN oct.target_type = 'BASE_PRIMARY' THEN 'PRIMARY_QUESTION'
     WHEN oct.target_type = 'EXPANSION_QUESTION' THEN 'EXPANSION_QUESTION'
   END
   AND ol.link_key = oct.target_key
   AND ol.status = 'ACTIVE'
  ) as promoted_ofc_count
FROM public.ofc_candidate_targets oct
GROUP BY target_type, target_key;

COMMENT ON VIEW public.v_question_coverage IS
'Coverage summary: candidate counts and promoted OFC counts per question.';

