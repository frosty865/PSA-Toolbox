-- Deprecate runtime-owned tables in CORPUS database
-- Date: 2026-01-24
-- Purpose: Rename tables that were moved to RUNTIME to prevent split-brain
-- 
-- IMPORTANT: This migration MUST run against CORPUS database only
-- Run with: npx tsx tools/run_sql.ts db/migrations/corpus/20260124_0011_deprecate_runtime_owned_tables_in_corpus.sql
-- Or execute directly against CORPUS database

-- ============================================================================
-- Rename tables to deprecated versions
-- ============================================================================

-- Rename canonical_sources if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'canonical_sources'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'canonical_sources_deprecated'
  ) THEN
    ALTER TABLE public.canonical_sources 
      RENAME TO canonical_sources_deprecated;
    
    COMMENT ON TABLE public.canonical_sources_deprecated IS
    'DEPRECATED: This table was moved to RUNTIME database on 2026-01-24. Do not use. Use RUNTIME.canonical_sources instead.';
  END IF;
END $$;

-- Rename ofc_library_citations if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_library_citations'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_library_citations_deprecated'
  ) THEN
    ALTER TABLE public.ofc_library_citations 
      RENAME TO ofc_library_citations_deprecated;
    
    COMMENT ON TABLE public.ofc_library_citations_deprecated IS
    'DEPRECATED: This table was moved to RUNTIME database on 2026-01-24. Do not use. Use RUNTIME.ofc_library_citations instead.';
  END IF;
END $$;

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 
  'canonical_sources_deprecated' as table_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'canonical_sources_deprecated'
  ) THEN 'RENAMED' 
  WHEN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'canonical_sources'
  ) THEN 'STILL_EXISTS' 
  ELSE 'NOT_FOUND' END as status
UNION ALL
SELECT 
  'ofc_library_citations_deprecated' as table_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_library_citations_deprecated'
  ) THEN 'RENAMED' 
  WHEN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_library_citations'
  ) THEN 'STILL_EXISTS' 
  ELSE 'NOT_FOUND' END as status;
