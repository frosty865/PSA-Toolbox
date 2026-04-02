-- RUNTIME: Move tables whose names start with archive_ from public to archive schema.
-- Tables: archive_normalized_evidence_links, archive_normalized_vulnerabilities,
--         archive_source_documents, archive_source_statements

BEGIN;

CREATE SCHEMA IF NOT EXISTS archive;

DO $$
DECLARE
  t text;
  tables_to_move text[] := ARRAY[
    'archive_normalized_evidence_links',
    'archive_normalized_vulnerabilities',
    'archive_source_documents',
    'archive_source_statements'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_move
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t)
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'archive' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA archive', t);
      RAISE NOTICE 'Moved: public.% -> archive.%', t, t;
    END IF;
  END LOOP;
END $$;

COMMIT;
