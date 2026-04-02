-- Question Meaning Migration
-- Date: 2026-01-18
-- Purpose: Create table for storing RAG-derived question meanings with citations
-- TARGET DB: Supabase Postgres (psa-back)

-- ============================================================================
-- 1. Create question_meaning table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.question_meaning (
  canon_id text PRIMARY KEY,
  discipline text NOT NULL,
  meaning_text text NOT NULL,
  citations jsonb NOT NULL,              -- array of {corpus_document_id, page_number, chunk_id}
  derived_at timestamptz NOT NULL default now(),
  model_name text NOT NULL,
  locked boolean NOT NULL default true,
  warnings jsonb NOT NULL default '[]'::jsonb
);

COMMENT ON TABLE public.question_meaning IS
'RAG-derived question meanings with citation traceability. Meanings are generated from corpus evidence using Ollama.';

COMMENT ON COLUMN public.question_meaning.canon_id IS
'Foreign key to baseline_spines_runtime.canon_id. Identifies the question.';

COMMENT ON COLUMN public.question_meaning.discipline IS
'Discipline code (e.g., ACS, CPTED, PER). Used for frame matching.';

COMMENT ON COLUMN public.question_meaning.meaning_text IS
'Plain-language explanation of what the question means. 8th grade reading level, max 3 sentences.';

COMMENT ON COLUMN public.question_meaning.citations IS
'JSONB array of citation objects: [{corpus_document_id, page_number, chunk_id}, ...].';

COMMENT ON COLUMN public.question_meaning.derived_at IS
'Timestamp when meaning was generated.';

COMMENT ON COLUMN public.question_meaning.model_name IS
'Ollama model name used for generation (e.g., llama2, mistral).';

COMMENT ON COLUMN public.question_meaning.locked IS
'If true, meaning is locked and should not be regenerated.';

COMMENT ON COLUMN public.question_meaning.warnings IS
'JSONB array of warnings from generation/validation process.';

-- ============================================================================
-- 2. Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_question_meaning_discipline 
  ON public.question_meaning(discipline);

CREATE INDEX IF NOT EXISTS idx_question_meaning_derived_at 
  ON public.question_meaning(derived_at DESC);

-- ============================================================================
-- 3. Foreign key constraint (if baseline_spines_runtime exists)
-- ============================================================================

-- Note: Foreign key constraint is optional to avoid migration failures
-- if baseline_spines_runtime doesn't exist in this database
