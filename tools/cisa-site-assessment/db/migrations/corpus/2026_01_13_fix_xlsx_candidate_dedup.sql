-- CORPUS: Fix XLSX Candidate Deduplication
-- Date: 2026-01-13
-- Purpose: Add locator-aware uniqueness to prevent deduplication across different XLSX sheet/row locations
--
-- HARD RULE: This migration is for CORPUS project ONLY
-- Do NOT run this on RUNTIME project

-- ============================================================================
-- 1. Add missing columns to ofc_candidate_queue
-- ============================================================================

-- document_id (link to documents table)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'ofc_candidate_queue' 
        AND column_name = 'document_id'
    ) THEN
        ALTER TABLE public.ofc_candidate_queue 
        ADD COLUMN document_id UUID REFERENCES public.documents(document_id) ON DELETE CASCADE;
        
        -- Backfill document_id from source_id via documents table
        UPDATE public.ofc_candidate_queue ocq
        SET document_id = d.document_id
        FROM public.documents d
        WHERE ocq.source_id = d.source_id
            AND ocq.document_id IS NULL;
    END IF;
END $$;

-- locator_type (XLSX, PDF, etc.)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'ofc_candidate_queue' 
        AND column_name = 'locator_type'
    ) THEN
        ALTER TABLE public.ofc_candidate_queue 
        ADD COLUMN locator_type TEXT;
        
        -- Infer locator_type from existing page_locator patterns
        UPDATE public.ofc_candidate_queue
        SET locator_type = CASE
            WHEN page_locator LIKE 'Row %' OR page_locator LIKE 'sheet=%' THEN 'XLSX'
            WHEN page_locator LIKE 'Page %' THEN 'PDF'
            ELSE 'UNKNOWN'
        END
        WHERE locator_type IS NULL;
    END IF;
END $$;

-- field_name (OFC, Vulnerability, etc.)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'ofc_candidate_queue' 
        AND column_name = 'field_name'
    ) THEN
        ALTER TABLE public.ofc_candidate_queue 
        ADD COLUMN field_name TEXT DEFAULT 'OFC';
    END IF;
END $$;

-- candidate_hash (normalized hash for performance lookups)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'ofc_candidate_queue' 
        AND column_name = 'candidate_hash'
    ) THEN
        ALTER TABLE public.ofc_candidate_queue 
        ADD COLUMN candidate_hash TEXT;
    END IF;
END $$;

-- Rename page_locator to locator for consistency
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'ofc_candidate_queue' 
        AND column_name = 'page_locator'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'ofc_candidate_queue' 
        AND column_name = 'locator'
    ) THEN
        ALTER TABLE public.ofc_candidate_queue 
        RENAME COLUMN page_locator TO locator;
    END IF;
END $$;

-- ============================================================================
-- 2. Drop any existing unique constraints that deduplicate purely on hash/text
-- ============================================================================

-- Check and drop if exists (PostgreSQL doesn't support IF EXISTS for constraints directly)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find unique constraint on (source_set, candidate_hash) if it exists
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.ofc_candidate_queue'::regclass
        AND contype = 'u'
        AND array_length(conkey, 1) = 2
        AND EXISTS (
            SELECT 1 FROM pg_attribute 
            WHERE attrelid = conrelid 
            AND attname IN ('source_set', 'candidate_hash')
            AND attnum = ANY(conkey)
        )
    LIMIT 1;
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.ofc_candidate_queue DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END IF;
END $$;

-- ============================================================================
-- 3. Clean up existing duplicates before adding unique constraint
-- ============================================================================

-- Delete duplicates, keeping the one with the earliest created_at
DO $$
BEGIN
    DELETE FROM public.ofc_candidate_queue ocq1
    WHERE EXISTS (
        SELECT 1 FROM public.ofc_candidate_queue ocq2
        WHERE ocq2.source_set = ocq1.source_set
            AND ocq2.document_id = ocq1.document_id
            AND COALESCE(ocq2.locator_type, 'NULL') = COALESCE(ocq1.locator_type, 'NULL')
            AND COALESCE(ocq2.locator, 'NULL') = COALESCE(ocq1.locator, 'NULL')
            AND COALESCE(ocq2.field_name, 'OFC') = COALESCE(ocq1.field_name, 'OFC')
            AND ocq2.candidate_id < ocq1.candidate_id  -- Keep the first one
    );
END $$;

-- ============================================================================
-- 4. Add locator-aware unique constraint
-- ============================================================================

-- Unique constraint: (source_set, document_id, locator_type, locator, field_name)
-- This allows the same OFC text to appear in multiple rows without collapsing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.ofc_candidate_queue'::regclass
        AND conname = 'uq_ofc_candidate_queue_locator'
    ) THEN
        ALTER TABLE public.ofc_candidate_queue
        ADD CONSTRAINT uq_ofc_candidate_queue_locator
        UNIQUE(source_set, document_id, locator_type, locator, field_name);
    END IF;
END $$;

-- ============================================================================
-- 5. Add performance indexes
-- ============================================================================

-- Non-unique index for candidate_hash lookups (performance)
CREATE INDEX IF NOT EXISTS idx_ofc_candidate_queue_hash 
    ON public.ofc_candidate_queue(source_set, candidate_hash);

-- Index on document_id for joins
CREATE INDEX IF NOT EXISTS idx_ofc_candidate_queue_document_id 
    ON public.ofc_candidate_queue(document_id) 
    WHERE document_id IS NOT NULL;

-- Index on locator_type for filtering
CREATE INDEX IF NOT EXISTS idx_ofc_candidate_queue_locator_type 
    ON public.ofc_candidate_queue(source_set, locator_type);

-- ============================================================================
-- 6. Comments
-- ============================================================================

COMMENT ON COLUMN public.ofc_candidate_queue.document_id IS
'Direct link to documents table for traceability. CORPUS project only.';

COMMENT ON COLUMN public.ofc_candidate_queue.locator_type IS
'Type of locator: XLSX, PDF, UNKNOWN. CORPUS project only.';

COMMENT ON COLUMN public.ofc_candidate_queue.locator IS
'Location identifier: for XLSX "sheet=...;row=...", for PDF "Page N". CORPUS project only.';

COMMENT ON COLUMN public.ofc_candidate_queue.field_name IS
'Field name from source: OFC, Vulnerability, etc. CORPUS project only.';

COMMENT ON COLUMN public.ofc_candidate_queue.candidate_hash IS
'Hash of normalized candidate text for performance lookups. Non-unique. CORPUS project only.';

COMMENT ON CONSTRAINT uq_ofc_candidate_queue_locator ON public.ofc_candidate_queue IS
'Ensures candidates are unique by location, not by text content. Allows same OFC text in different rows.';

