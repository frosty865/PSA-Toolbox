-- CORPUS: Revoke Write Permissions from Runtime App Role
-- This enforces physical segregation: runtime app can only SELECT from CORPUS
-- 
-- IMPORTANT: This migration uses IF EXISTS to handle cases where the role doesn't exist yet.
-- Adjust role names to match your environment. Common role names:
-- - postgres (default Supabase role - has full access, not recommended for app)
-- - authenticated (Supabase authenticated users)
-- - service_role (Supabase service role - has full access)
-- - psa_runtime_app (custom role - create this if needed)
--
-- To create a dedicated runtime app role:
--   CREATE ROLE psa_runtime_app WITH LOGIN PASSWORD 'your_password';
--   GRANT CONNECT ON DATABASE your_corpus_db TO psa_runtime_app;

BEGIN;

-- Check if role exists before revoking (graceful handling)
DO $$
DECLARE
  role_name TEXT := 'psa_runtime_app'; -- Adjust to your actual role name
  role_exists BOOLEAN;
BEGIN
  -- Check if role exists
  SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = role_name) INTO role_exists;
  
  IF role_exists THEN
    -- Revoke INSERT, UPDATE, DELETE on all tables
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM %I', role_name);
    
    -- Grant SELECT only (read-only access)
    EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA public TO %I', role_name);
    
    RAISE NOTICE 'Revoked write permissions from role: %', role_name;
  ELSE
    RAISE NOTICE 'Role "%" does not exist. Skipping permission changes. Create the role first if needed.', role_name;
    RAISE NOTICE 'Current user: %', current_user;
    RAISE NOTICE 'To enforce read-only access, create role and re-run this migration.';
  END IF;
END $$;

-- Note: If you have separate roles for corpus ingestion:
-- - Only psa_corpus_ingest (or admin/postgres) can write CORPUS
-- - Runtime app role should be read-only

COMMENT ON SCHEMA public IS 'CORPUS database: global evidence store. Runtime app should have read-only access.';

COMMIT;
