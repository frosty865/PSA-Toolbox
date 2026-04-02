-- CORPUS: Allow NULL publisher and clear placeholder values (—, unknown, etc.).
-- Unknown publisher should be stored as NULL; UI shows blank.

-- 1. Allow NULL (was NOT NULL)
ALTER TABLE public.source_registry
  ALTER COLUMN publisher DROP NOT NULL;

-- 2. Set publisher = NULL where it's empty, em dash, or unacceptable placeholder
UPDATE public.source_registry
SET publisher = NULL, updated_at = now()
WHERE publisher IS NOT NULL
  AND (
    trim(publisher) = ''
    OR publisher = '—'
    OR publisher = E'\u2014'
    OR lower(trim(publisher)) IN (
      'unknown',
      'local file',
      'module source',
      'unspecified',
      '(no publisher)',
      'no publisher'
    )
  );
