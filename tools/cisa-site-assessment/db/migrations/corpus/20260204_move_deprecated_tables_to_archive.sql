-- CORPUS: Move deprecated tables to archive schema (idempotent).
-- Tables: canonical_sources_deprecated, ofc_library_citations_deprecated, documents.
-- Data is preserved. A read-only view public.documents is created for backward compatibility.
--
-- Run: psql "$CORPUS_DATABASE_URL" -f db/migrations/corpus/20260204_move_deprecated_tables_to_archive.sql
-- Or: npx tsx tools/run_sql_corpus.ts db/migrations/corpus/20260204_move_deprecated_tables_to_archive.sql

BEGIN;

CREATE SCHEMA IF NOT EXISTS archive;

-- Move each deprecated table to archive if it exists in public and not already in archive.
DO $$
DECLARE
  t text;
  tables_to_archive text[] := ARRAY[
    'canonical_sources_deprecated',
    'ofc_library_citations_deprecated',
    'documents'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_archive
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t)
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'archive' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA archive', t);
      RAISE NOTICE 'Archived: public.% -> archive.%', t, t;
    END IF;
  END LOOP;
END $$;

-- Backward compatibility: view so existing code (e.g. public.documents) still works read-only.
DROP VIEW IF EXISTS public.documents CASCADE;
CREATE VIEW public.documents AS
  SELECT * FROM archive.documents;
COMMENT ON VIEW public.documents IS 'Legacy read-only view over archive.documents; do not use for new work. Prefer corpus_documents.';

COMMIT;
