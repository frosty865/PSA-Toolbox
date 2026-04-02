-- ============================================================================
-- CORPUS Schema Application Script
-- ============================================================================
-- 
-- INSTRUCTIONS:
-- 1. Open Supabase SQL Editor for CORPUS project:
--    https://supabase.com/dashboard/project/yylslokiaovdythzrbgt/sql
--
-- 2. Run SAFETY CHECK first:
-- ============================================================================

-- SAFETY CHECK 1: Confirm database
SELECT current_database();
-- Expected: postgres (or project-specific name)

-- SAFETY CHECK 2: Verify NO runtime tables exist
SELECT table_name 
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('assessments', 'assessment_instances', 'assessment_responses')
ORDER BY table_name
LIMIT 10;
-- Expected: 0 rows (empty result)

-- If you see 'assessments' or 'assessment_instances', STOP - wrong project!

-- ============================================================================
-- 3. If safety checks pass, run the CORPUS schema migration:
-- ============================================================================

-- Run: migrations/20260113_create_corpus_schema.sql

-- ============================================================================
-- 4. POST-CHECK: Verify tables exist and are empty
-- ============================================================================

SELECT 'canonical_sources' AS table_name, count(*) AS row_count FROM canonical_sources
UNION ALL 
SELECT 'documents', count(*) FROM documents
UNION ALL 
SELECT 'document_chunks', count(*) FROM document_chunks
UNION ALL 
SELECT 'ingestion_runs', count(*) FROM ingestion_runs
UNION ALL 
SELECT 'ingestion_run_documents', count(*) FROM ingestion_run_documents
UNION ALL 
SELECT 'ofc_candidate_queue', count(*) FROM ofc_candidate_queue
UNION ALL 
SELECT 'ofc_candidate_targets', count(*) FROM ofc_candidate_targets;

-- Expected: All tables exist; all counts = 0 (empty tables)

