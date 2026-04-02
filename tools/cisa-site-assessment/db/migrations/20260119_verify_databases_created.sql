-- ============================================================================
-- VERIFY DATABASES CREATED
-- ============================================================================
-- Run these queries to verify psa_corpus and psa_runtime databases exist
-- ============================================================================

-- Check if psa_corpus exists (run on CORPUS backend)
SELECT 
  datname as database_name,
  pg_encoding_to_char(encoding) as encoding,
  datcollate as collation,
  datctype as ctype
FROM pg_database 
WHERE datname = 'psa_corpus';

-- Check if psa_runtime exists (run on RUNTIME backend)
SELECT 
  datname as database_name,
  pg_encoding_to_char(encoding) as encoding,
  datcollate as collation,
  datctype as ctype
FROM pg_database 
WHERE datname = 'psa_runtime';

-- List all databases (to see both)
SELECT datname 
FROM pg_database 
WHERE datistemplate = false 
ORDER BY datname;
