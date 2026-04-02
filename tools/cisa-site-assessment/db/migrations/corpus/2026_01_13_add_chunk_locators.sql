-- CORPUS: Add Locator Fields to Document Chunks
-- Date: 2026-01-13
-- Purpose: Add locator_type and locator to document_chunks for traceability
--
-- HARD RULE: This migration is for CORPUS project ONLY
-- Do NOT run this on RUNTIME project

-- ============================================================================
-- 1. Add locator_type column
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'document_chunks' 
        AND column_name = 'locator_type'
    ) THEN
        ALTER TABLE public.document_chunks 
        ADD COLUMN locator_type TEXT;
    END IF;
END $$;

-- ============================================================================
-- 2. Add locator column
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'document_chunks' 
        AND column_name = 'locator'
    ) THEN
        ALTER TABLE public.document_chunks 
        ADD COLUMN locator TEXT;
    END IF;
END $$;

-- ============================================================================
-- 3. Backfill locator_type and locator for VOFC_LIBRARY chunks
-- ============================================================================

-- For VOFC_LIBRARY chunks, infer from document title and chunk_index
UPDATE public.document_chunks dc
SET 
    locator_type = 'XLSX',
    locator = 'sheet=' || REPLACE(d.title, 'VOFC Library — ', '') || ';row=' || dc.chunk_index::TEXT
FROM public.documents d
WHERE dc.document_id = d.document_id
    AND dc.source_set = 'VOFC_LIBRARY'
    AND (dc.locator_type IS NULL OR dc.locator IS NULL);

-- For PDF chunks, infer from page_number
UPDATE public.document_chunks dc
SET 
    locator_type = 'PDF',
    locator = 'Page ' || dc.page_number::TEXT
WHERE dc.source_set != 'VOFC_LIBRARY'
    AND dc.page_number IS NOT NULL
    AND (dc.locator_type IS NULL OR dc.locator IS NULL);

-- ============================================================================
-- 4. Add indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_document_chunks_locator_type 
    ON public.document_chunks(source_set, locator_type);

CREATE INDEX IF NOT EXISTS idx_document_chunks_locator 
    ON public.document_chunks(document_id, locator) 
    WHERE locator IS NOT NULL;

-- ============================================================================
-- 5. Comments
-- ============================================================================

COMMENT ON COLUMN public.document_chunks.locator_type IS
'Type of locator: XLSX, PDF, UNKNOWN. CORPUS project only.';

COMMENT ON COLUMN public.document_chunks.locator IS
'Location identifier: for XLSX "sheet=...;row=...", for PDF "Page N". CORPUS project only.';

