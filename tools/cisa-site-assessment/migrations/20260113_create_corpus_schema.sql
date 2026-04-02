-- CORPUS Schema Migration
-- Date: 2025-01-13
-- Purpose: Create CORPUS database schema (yylslokiaovdythzrbgt)
--
-- HARD RULE: This schema is for CORPUS project ONLY
-- Do NOT run this on RUNTIME project (wivohgbuuwxoyfyzntsd)
--
-- SAFETY CHECK: Run these first to confirm you're in CORPUS project:
--   SELECT current_database();
--   SELECT table_name FROM information_schema.tables
--     WHERE table_schema='public' AND table_name IN ('assessments', 'assessment_instances')
--     LIMIT 1;
-- If you see 'assessments' or 'assessment_instances', STOP (wrong project).

-- ============================================================================
-- 1. Canonical Sources (bibliographic references)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.canonical_sources (
  source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NULL,
  publisher TEXT NULL,
  published_date DATE NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('PDF','WEB','GUIDE','STANDARD','MEMO','OTHER')),
  uri TEXT NULL,
  citation_text TEXT NOT NULL,
  content_hash TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.canonical_sources IS
'Bibliographic references for evidence-backed OFCs. CORPUS project only.';

CREATE INDEX IF NOT EXISTS idx_canonical_sources_type 
  ON public.canonical_sources(source_type);

CREATE INDEX IF NOT EXISTS idx_canonical_sources_title 
  ON public.canonical_sources(title);

-- ============================================================================
-- 2. Documents (ingested documents)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.documents (
  document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.canonical_sources(source_id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  file_path TEXT NULL,
  file_hash TEXT NULL,
  page_count INT NULL,
  sector TEXT NULL,
  subsector TEXT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.documents IS
'Ingested documents from sources. CORPUS project only.';

CREATE INDEX IF NOT EXISTS idx_documents_source 
  ON public.documents(source_id);

CREATE INDEX IF NOT EXISTS idx_documents_sector_subsector 
  ON public.documents(sector, subsector) 
  WHERE sector IS NOT NULL;

-- ============================================================================
-- 3. Document Chunks (text chunks for processing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.document_chunks (
  chunk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(document_id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  page_number INT NULL,
  chunk_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id, chunk_index)
);

COMMENT ON TABLE public.document_chunks IS
'Text chunks extracted from documents for processing. CORPUS project only.';

CREATE INDEX IF NOT EXISTS idx_document_chunks_document 
  ON public.document_chunks(document_id);

CREATE INDEX IF NOT EXISTS idx_document_chunks_page 
  ON public.document_chunks(page_number) 
  WHERE page_number IS NOT NULL;

-- ============================================================================
-- 4. Ingestion Runs (track ingestion batches)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ingestion_runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED')),
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ingestion_runs IS
'Ingestion run tracking. CORPUS project only.';

CREATE INDEX IF NOT EXISTS idx_ingestion_runs_status 
  ON public.ingestion_runs(status);

-- ============================================================================
-- 5. Ingestion Run Documents (link runs to documents)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ingestion_run_documents (
  run_id UUID NOT NULL REFERENCES public.ingestion_runs(run_id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(document_id) ON DELETE CASCADE,
  PRIMARY KEY (run_id, document_id)
);

COMMENT ON TABLE public.ingestion_run_documents IS
'Links ingestion runs to documents. CORPUS project only.';

-- ============================================================================
-- 6. OFC Candidate Queue (extracted candidate snippets)
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
  reviewed_by TEXT NULL,
  best_universal_target TEXT NULL,
  best_context_target TEXT NULL
);

COMMENT ON TABLE public.ofc_candidate_queue IS
'Queue of OFC candidate snippets extracted from documents. CORPUS project only.';

CREATE INDEX IF NOT EXISTS idx_ofc_candidate_queue_source 
  ON public.ofc_candidate_queue(source_id);

CREATE INDEX IF NOT EXISTS idx_ofc_candidate_queue_status 
  ON public.ofc_candidate_queue(status);

CREATE INDEX IF NOT EXISTS idx_ofc_candidate_queue_sector_subsector 
  ON public.ofc_candidate_queue(sector, subsector) 
  WHERE sector IS NOT NULL;

-- ============================================================================
-- 7. OFC Candidate Targets (links candidates to questions)
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
'Links OFC candidates to question targets. CORPUS project only.';

CREATE INDEX IF NOT EXISTS idx_oct_target 
  ON public.ofc_candidate_targets(target_type, target_key);

CREATE INDEX IF NOT EXISTS idx_oct_mode_score 
  ON public.ofc_candidate_targets(match_mode, match_score DESC);

CREATE INDEX IF NOT EXISTS idx_oct_candidate 
  ON public.ofc_candidate_targets(candidate_id);

-- ============================================================================
-- 8. Views (for review and coverage analysis)
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
  cs.source_type
FROM public.ofc_candidate_targets oct
JOIN public.ofc_candidate_queue ocq ON oct.candidate_id = ocq.candidate_id
JOIN public.canonical_sources cs ON ocq.source_id = cs.source_id;

COMMENT ON VIEW public.v_candidate_targets_with_details IS
'Candidate targets with full source details for review UI. CORPUS project only.';

CREATE OR REPLACE VIEW public.v_question_coverage AS
SELECT 
  target_type,
  target_key,
  COUNT(DISTINCT candidate_id) FILTER (WHERE match_mode = 'UNIVERSAL') as universal_candidate_count,
  COUNT(DISTINCT candidate_id) FILTER (WHERE match_mode = 'CONTEXT') as context_candidate_count,
  MAX(match_score) FILTER (WHERE match_mode = 'UNIVERSAL') as best_universal_score,
  MAX(match_score) FILTER (WHERE match_mode = 'CONTEXT') as best_context_score,
  0 as promoted_ofc_count  -- OFCs are in RUNTIME, not CORPUS
FROM public.ofc_candidate_targets
GROUP BY target_type, target_key;

COMMENT ON VIEW public.v_question_coverage IS
'Coverage summary: candidate counts per question. CORPUS project only.';

-- ============================================================================
-- POST-CHECK: Verify tables exist
-- ============================================================================

-- Run this after migration to verify:
-- SELECT 'canonical_sources' AS t, count(*) FROM canonical_sources
-- UNION ALL SELECT 'documents', count(*) FROM documents
-- UNION ALL SELECT 'document_chunks', count(*) FROM document_chunks
-- UNION ALL SELECT 'ofc_candidate_queue', count(*) FROM ofc_candidate_queue
-- UNION ALL SELECT 'ofc_candidate_targets', count(*) FROM ofc_candidate_targets;
-- Expected: all tables exist; counts = 0 (empty tables).

