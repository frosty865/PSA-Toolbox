-- CORPUS: Drop Library Builder / library-crawler tables (feature removed)
-- Date: 2026-02-03
-- Purpose: Remove library_jobs, library_candidates, library_logs (Library Builder feature removed). Safe if tables never existed.

DROP TABLE IF EXISTS public.library_logs;
DROP TABLE IF EXISTS public.library_candidates;
DROP TABLE IF EXISTS public.library_jobs;
