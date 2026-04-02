-- ============================================================================
-- CREATE PSA_CORPUS DATABASE
-- ============================================================================
-- This script creates the psa_corpus database on the CORPUS backend.
-- 
-- PREREQUISITES:
-- - Must be run on CORPUS backend (system_identifier: 7572288122664293568)
-- - Requires superuser privileges (CREATE DATABASE)
-- - If running on managed PostgreSQL (e.g., Supabase), database creation
--   may not be permitted. In that case, use the existing database name
--   and update CORPUS_DATABASE_URL to point to it.
--
-- STEP 1: Verify backend fingerprint (run first):
--   Run: db/migrations/20260119_verify_corpus_backend.sql
--   OR manually check:
--   SELECT (SELECT system_identifier FROM pg_control_system())::text;
--   -- Should return: 7572288122664293568
--
-- STEP 2: Create database (run this script):
--   IMPORTANT: In Supabase SQL Editor, run ONLY the CREATE DATABASE statement below
--   (select just the CREATE DATABASE line, not the entire file)
--   This must run as a standalone statement, not inside a transaction
--
-- VERIFICATION:
--   After creation, connect to psa_corpus and verify:
--   SELECT current_database();  -- Should return: psa_corpus
--   SELECT (SELECT system_identifier FROM pg_control_system())::text;  -- Should return: 7572288122664293568
-- ============================================================================

-- Create database (if it doesn't exist)
-- IMPORTANT: CREATE DATABASE cannot be run inside a transaction block
-- If database already exists, this will fail - that's OK, just means it's already created
-- Run this as a standalone statement (Supabase SQL Editor: run this line only, not the whole file)
CREATE DATABASE psa_corpus
  WITH 
  OWNER = postgres
  ENCODING = 'UTF8'
  LC_COLLATE = 'en_US.UTF-8'
  LC_CTYPE = 'en_US.UTF-8'
  TEMPLATE = template0;

-- Note: \c is a psql meta-command and won't work in non-psql contexts (Supabase SQL Editor, etc.)
-- After running this script, manually connect to psa_corpus and verify:
-- 
-- In psql:
--   \c psa_corpus
--   SELECT current_database();  -- Should return: psa_corpus
-- 
-- In Supabase SQL Editor or other tools:
--   Connect to psa_corpus database, then run:
--   SELECT current_database();  -- Should return: psa_corpus

-- Note: After creating the database, you must:
-- 1. Update CORPUS_DATABASE_URL to point to psa_corpus instead of postgres
-- 2. Run CORPUS migrations on psa_corpus:
--    - db/migrations/20260116_create_source_registry.sql
--    - Other CORPUS-specific migrations
