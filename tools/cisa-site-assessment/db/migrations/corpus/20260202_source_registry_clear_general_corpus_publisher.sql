-- CORPUS: Clear "General Corpus" placeholder from source_registry.publisher.
-- General Corpus is an ingestion stream label, not a publisher; store NULL and backfill from PDF.

UPDATE public.source_registry
SET publisher = NULL, updated_at = now()
WHERE publisher IS NOT NULL
  AND LOWER(TRIM(publisher)) = 'general corpus';
