-- Table Location Check (SQL version)
-- Run this in BOTH databases (RUNTIME and CORPUS) to see which tables exist
-- 
-- Usage:
-- 1. Run in RUNTIME database
-- 2. Run in CORPUS database
-- 3. Compare results

-- Check which tables exist in this database
SELECT 
  table_name,
  CASE 
    WHEN table_name = 'source_registry' THEN 'CORPUS (expected) or RUNTIME (if migrated)'
    WHEN table_name = 'corpus_documents' THEN 'CORPUS only'
    WHEN table_name = 'module_ofc_library' THEN 'RUNTIME only'
    WHEN table_name = 'module_ofc_citations' THEN 'RUNTIME only'
    ELSE 'Other'
  END as expected_location,
  'EXISTS' as status
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name IN ('source_registry', 'corpus_documents', 'module_ofc_library', 'module_ofc_citations')
ORDER BY table_name;

-- Show current database name
SELECT current_database() as current_database;
