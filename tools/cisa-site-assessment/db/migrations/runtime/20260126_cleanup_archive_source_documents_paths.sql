-- Migration: Clean up broken location references in archive_source_documents
-- Date: 2026-01-26
-- Purpose: Remove broken file paths from archive_source_documents
--          All paths point to D:\psa-workspace\Tech_Sources\processed\... which no longer exists
--
-- TARGET DB: RUNTIME

BEGIN;

-- Set broken paths to NULL
-- This is safe because:
-- 1. archive_source_documents is an archive table (historical data only)
-- 2. Files have been moved/archived elsewhere
-- 3. Paths are no longer valid and cannot be used

UPDATE public.archive_source_documents
SET 
  source_path = NULL,
  pdf_path = NULL
WHERE 
  source_path LIKE 'D:\\psa-workspace%' ESCAPE '\'
  OR pdf_path LIKE 'D:\\psa-workspace%' ESCAPE '\'
  OR source_path LIKE 'D:/psa-workspace%'
  OR pdf_path LIKE 'D:/psa-workspace%'
  OR source_path ~ '^D:[/\\]psa-workspace'
  OR pdf_path ~ '^D:[/\\]psa-workspace';

-- Report how many rows were updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % rows in archive_source_documents (set broken paths to NULL)', updated_count;
END $$;

COMMENT ON TABLE public.archive_source_documents IS
'Archive table for historical source documents. File paths may be NULL if original location no longer exists.';

COMMIT;
