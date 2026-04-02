-- Clean canonical source citation text
-- Date: 2026-01-24
-- Purpose: Remove misleading ", MODULE" suffix from citation text
-- IMPORTANT: Run against CORPUS database only

BEGIN;

-- Remove ", MODULE" suffix from citation_text where it appears
-- This is safe because citation_text is descriptive metadata, not used for filtering
UPDATE public.canonical_sources
SET citation_text = regexp_replace(citation_text, '\s*,\s*MODULE\s*$', '', 'i')
WHERE citation_text ILIKE '%MODULE RESEARCH%'
  AND citation_text ~* ',\s*MODULE\s*$';

-- Verify the changes
DO $$
DECLARE
  updated_count INTEGER;
  remaining_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  SELECT COUNT(*) INTO remaining_count
  FROM public.canonical_sources
  WHERE citation_text ILIKE '%MODULE RESEARCH%'
    AND citation_text ~* ',\s*MODULE\s*$';
  
  RAISE NOTICE 'Updated % citation texts', updated_count;
  RAISE NOTICE 'Remaining citations with ", MODULE" suffix: %', remaining_count;
END $$;

COMMIT;

-- Verification query (run separately to check results):
-- SELECT citation_text FROM public.canonical_sources
-- WHERE citation_text ILIKE '%MODULE RESEARCH%'
-- ORDER BY citation_text;
