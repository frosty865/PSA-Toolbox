-- Add UNIQUE constraint on source_registry.doc_sha256
-- Date: 2026-01-26
-- Purpose: Enable ON CONFLICT (doc_sha256) in upsert operations
--
-- This constraint ensures that each document (by SHA256 hash) has only one
-- source_registry entry, enabling deterministic upserts based on hash.

-- ============================================================================
-- 1. Add UNIQUE constraint on doc_sha256
-- ============================================================================

-- First, check if there are any duplicate doc_sha256 values
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT doc_sha256, COUNT(*) as cnt
    FROM public.source_registry
    WHERE doc_sha256 IS NOT NULL
    GROUP BY doc_sha256
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Cannot add UNIQUE constraint: % duplicate doc_sha256 values found. Resolve duplicates first.', duplicate_count;
  END IF;
END $$;

-- Add UNIQUE constraint (allows NULL values - multiple NULLs are allowed in UNIQUE constraints)
CREATE UNIQUE INDEX IF NOT EXISTS idx_source_registry_doc_sha256_unique
  ON public.source_registry(doc_sha256)
  WHERE doc_sha256 IS NOT NULL;

COMMENT ON INDEX idx_source_registry_doc_sha256_unique IS
'Unique index on doc_sha256 to enable ON CONFLICT (doc_sha256) in upsert operations. Allows NULL values.';
