-- Module Research Layer Tables
-- 
-- ⚠️ DEPRECATED: This migration has been SPLIT into two separate migrations:
-- 
-- 1. migrations/20260122_module_research_tables_runtime.sql (for RUNTIME database)
--    - Creates: module_sources table
--    - Run on: RUNTIME database
-- 
-- 2. migrations/20260122_module_research_tables_corpus.sql (for CORPUS database)
--    - Creates: module_source_documents and module_chunk_links tables
--    - Run on: CORPUS database
--
-- The split allows proper foreign key constraints:
-- - module_sources in RUNTIME (references assessment_modules) ✓ FK enforced
-- - module_source_documents in CORPUS (references corpus_documents) ✓ FK enforced
-- - module_chunk_links in CORPUS (references document_chunks) ✓ FK enforced
--
-- DO NOT RUN THIS FILE - it will fail with an error.
-- Use the split migrations instead.

DO $$
BEGIN
  RAISE EXCEPTION 'This migration has been split. Use migrations/20260122_module_research_tables_runtime.sql (RUNTIME) and migrations/20260122_module_research_tables_corpus.sql (CORPUS) instead.';
END $$;
