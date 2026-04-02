-- CORPUS: Set publisher = NULL for all module source documents.
-- Module sources are scope/category (source_key LIKE 'module:%'); publisher is not applicable.
-- UI shows scope; Publisher column stays blank.

UPDATE public.source_registry
SET publisher = NULL, updated_at = now()
WHERE source_key LIKE 'module:%'
  AND publisher IS NOT NULL;
