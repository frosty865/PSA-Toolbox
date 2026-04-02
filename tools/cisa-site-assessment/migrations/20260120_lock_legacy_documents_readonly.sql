-- Lock legacy public.documents table to read-only for anon/authenticated.
-- Keeps service_role/admin capability intact (service_role not mentioned in policies = full access).
-- No schema changes besides policy/privilege.
--
-- IMPORTANT: This migration does NOT revoke privileges from service_role, postgres, or other admin roles.
-- Only anon and authenticated roles are blocked from writes.
-- service_role retains full INSERT/UPDATE/DELETE capability for maintenance/backfills.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='documents'
  ) THEN
    RAISE EXCEPTION 'public.documents does not exist; cannot apply legacy lock.';
  END IF;
END $$;

-- 1) Revoke write privileges (works even without RLS)
REVOKE INSERT, UPDATE, DELETE ON TABLE public.documents FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.documents FROM authenticated;

-- Keep SELECT allowed (typical; if your project manages grants elsewhere, adjust there)
GRANT SELECT ON TABLE public.documents TO anon;
GRANT SELECT ON TABLE public.documents TO authenticated;

-- 2) Enable RLS and deny writes explicitly (defense in depth)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist (idempotent)
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT polname
    FROM pg_policies
    WHERE schemaname='public' AND tablename='documents'
  LOOP
    -- leave select policies alone if you have them; remove write policies only
    IF p.polname ILIKE '%insert%' OR p.polname ILIKE '%update%' OR p.polname ILIKE '%delete%' OR p.polname ILIKE '%write%' THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.documents;', p.polname);
    END IF;
  END LOOP;
END $$;

-- Create explicit "deny all writes" policies for anon/authenticated
-- (RLS doesn't have "deny", so we create policies that never match.)
DROP POLICY IF EXISTS documents_deny_insert ON public.documents;
DROP POLICY IF EXISTS documents_deny_update ON public.documents;
DROP POLICY IF EXISTS documents_deny_delete ON public.documents;

CREATE POLICY documents_deny_insert ON public.documents
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY documents_deny_update ON public.documents
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY documents_deny_delete ON public.documents
  FOR DELETE
  TO anon, authenticated
  USING (false);

-- Note: SELECT policy is not created here; we assume your existing read policies/grants cover it.
-- If you rely purely on RLS for reads and reads break, add a SELECT policy separately and explicitly.
