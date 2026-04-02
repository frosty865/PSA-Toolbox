-- RUNTIME: Clear publisher on module_documents when it is PDF/driver software metadata (e.g. PScript5.dll Version 5.2.2).
-- Run after 20260207_module_documents_publisher.sql. Safe to run multiple times.

UPDATE public.module_documents
SET publisher = NULL, updated_at = now()
WHERE publisher IS NOT NULL
  AND (
    LOWER(TRIM(publisher)) LIKE '%pscript5%'
    OR LOWER(TRIM(publisher)) ~ '\.dll\s+version'
    OR LOWER(TRIM(publisher)) LIKE 'ghostscript%'
    OR LOWER(TRIM(publisher)) LIKE 'adobe pdf%library%'
  );
