-- ============================================================================
-- CREATE PSA_RUNTIME DATABASE
-- ============================================================================
-- This script creates the psa_runtime database on the RUNTIME backend.
-- 
-- PREREQUISITES:
-- - Must be run on RUNTIME backend (system_identifier: 7554257690872145980)
-- - Requires superuser privileges (CREATE DATABASE)
-- - If running on managed PostgreSQL (e.g., Supabase), database creation
--   may not be permitted. In that case, use the existing database name
--   and update RUNTIME_DATABASE_URL to point to it.
--
-- STEP 1: Verify backend fingerprint (run first):
--   Run: db/migrations/20260119_verify_runtime_backend.sql
--   OR manually check:
--   SELECT (SELECT system_identifier FROM pg_control_system())::text;
--   -- Should return: 7554257690872145980
--
-- STEP 2: Create database (run this script):
--   IMPORTANT: In Supabase SQL Editor, run ONLY the CREATE DATABASE statement below
--   (select just the CREATE DATABASE line, not the entire file)
--   This must run as a standalone statement, not inside a transaction
--
-- VERIFICATION:
--   After creation, connect to psa_runtime and verify:
--   SELECT current_database();  -- Should return: psa_runtime
--   SELECT (SELECT system_identifier FROM pg_control_system())::text;  -- Should return: 7554257690872145980
-- ============================================================================

-- Create database (if it doesn't exist)
-- IMPORTANT: CREATE DATABASE cannot be run inside a transaction block
-- If database already exists, this will fail - that's OK, just means it's already created
-- Run this as a standalone statement (Supabase SQL Editor: run this line only, not the whole file)
CREATE DATABASE psa_runtime
  WITH 
  OWNER = postgres
  ENCODING = 'UTF8'
  LC_COLLATE = 'en_US.UTF-8'
  LC_CTYPE = 'en_US.UTF-8'
  TEMPLATE = template0;

-- Note: \c is a psql meta-command and won't work in non-psql contexts (Supabase SQL Editor, etc.)
-- After running this script, manually connect to psa_runtime and verify:
-- 
-- In psql:
--   \c psa_runtime
--   SELECT current_database();  -- Should return: psa_runtime
-- 
-- In Supabase SQL Editor or other tools:
--   Connect to psa_runtime database, then run:
--   SELECT current_database();  -- Should return: psa_runtime

-- Note: After creating the database, you must:
-- 1. Update RUNTIME_DATABASE_URL to point to psa_runtime instead of postgres
-- 2. Run RUNTIME migrations on psa_runtime:
--    - db/migrations/20260116_add_source_key_to_citations.sql
--    - Other RUNTIME-specific migrations
