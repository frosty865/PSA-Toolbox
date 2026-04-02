-- Fix Numeric Inferred Titles
-- TARGET DB: Supabase Postgres (psa-back)
-- Schema: public
-- Purpose: One-time fix for numeric-only inferred_title values
--
-- Rules:
-- A) If file_stem exists AND is NOT numeric-only:
--    - set inferred_title = cleaned(file_stem)
--    - set title_confidence = GREATEST(title_confidence, 50)
--    - append warning "inferred_title_replaced_from_file_stem"
--
-- B) Else:
--    - set inferred_title = NULL
--    - set title_confidence = LEAST(title_confidence, 10)
--    - append warning "numeric_inferred_title_rejected"

-- ============================================================================
-- Fix numeric inferred_title offenders
-- ============================================================================

-- Fix offenders with non-numeric file_stem first
UPDATE public.corpus_documents cd
SET
  inferred_title = initcap(replace(replace(cd.file_stem, '_', ' '), '-', ' ')),
  title_confidence = GREATEST(cd.title_confidence, 50),
  ingestion_warnings = (
    CASE
      WHEN jsonb_typeof(cd.ingestion_warnings) = 'array'
      THEN (cd.ingestion_warnings || '["inferred_title_replaced_from_file_stem"]'::jsonb)
      ELSE '["inferred_title_replaced_from_file_stem"]'::jsonb
    END
  )
WHERE cd.inferred_title ~ '^[0-9]+$'
  AND cd.file_stem IS NOT NULL
  AND cd.file_stem != ''
  AND cd.file_stem !~ '^[0-9]+$';

-- Fix remaining offenders (numeric file_stem or NULL file_stem) - null out inferred_title
UPDATE public.corpus_documents cd
SET
  inferred_title = NULL,
  title_confidence = LEAST(cd.title_confidence, 10),
  ingestion_warnings = (
    CASE
      WHEN jsonb_typeof(cd.ingestion_warnings) = 'array'
      THEN (cd.ingestion_warnings || '["numeric_inferred_title_rejected"]'::jsonb)
      ELSE '["numeric_inferred_title_rejected"]'::jsonb
    END
  )
WHERE cd.inferred_title ~ '^[0-9]+$';

-- ============================================================================
-- Verify fix
-- ============================================================================

SELECT count(*) as remaining_numeric_titles
FROM public.corpus_documents
WHERE inferred_title ~ '^[0-9]+$';

-- Expected: 0
