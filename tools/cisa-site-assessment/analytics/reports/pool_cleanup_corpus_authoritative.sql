-- ================================================================================
-- CORPUS Database Cleanup SQL (RUN ONLY ON CORPUS)
-- Generated: 2026-01-24T15:50:36.319Z
-- ================================================================================

-- 1. DROP TAXONOMY TABLES FROM CORPUS (RUNTIME IS CANONICAL)
DROP TABLE IF EXISTS public.discipline_subtypes CASCADE;
DROP TABLE IF EXISTS public.disciplines CASCADE;

-- 2. RENAME CORPUS expansion_questions (PREVENT NAME COLLISION)
-- Note: Only rename if table exists and corpus_expansion_questions doesn't exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expansion_questions')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'corpus_expansion_questions') THEN
    ALTER TABLE public.expansion_questions RENAME TO corpus_expansion_questions;
  END IF;
END $$;

-- 3. ENSURE CORPUS OWNS ofc_candidate_queue + targets (KEEP)
-- (NO ACTION REQUIRED — CONFIRMED CANONICAL)

-- 4. CREATE ofc_library_citations IN CORPUS IF MISSING
CREATE TABLE IF NOT EXISTS public.ofc_library_citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ofc_id uuid NOT NULL,
  source_registry_id uuid NOT NULL,
  locator_type text,
  locator jsonb,
  excerpt text,
  created_at timestamptz DEFAULT now()
);
