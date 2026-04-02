-- ================================================================================
-- RUNTIME Database Cleanup SQL (RUN ONLY ON RUNTIME)
-- Generated: 2026-01-24T15:50:36.320Z
-- ================================================================================

-- 1. DROP CANDIDATE TABLES FROM RUNTIME (CORPUS IS CANONICAL)
DROP TABLE IF EXISTS public.ofc_candidate_targets CASCADE;
DROP TABLE IF EXISTS public.ofc_candidate_queue CASCADE;

-- 2. DROP ofc_library_citations FROM RUNTIME (BELONGS TO CORPUS)
DROP TABLE IF EXISTS public.ofc_library_citations CASCADE;

-- 3. ENSURE TAXONOMY EXISTS IN RUNTIME (NO-OP IF ALREADY PRESENT)
-- disciplines + discipline_subtypes already verified as canonical

-- 4. ENSURE assessment_responses EXISTS (BLOCKER FOR OFC ATTACHMENT)
CREATE TABLE IF NOT EXISTS public.assessment_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL,
  question_canon_id text NOT NULL,
  answer text NOT NULL CHECK (answer IN ('YES','NO','N_A')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
