-- CORPUS Source Set Control Migration
-- Date: 2026-01-13
-- Purpose: Add explicit source_set control to prevent accidental cross-source matching
--
-- HARD RULE: This migration is for CORPUS project ONLY
-- Do NOT run this on RUNTIME project

-- ============================================================================
-- 1. Add source_set columns to existing tables
-- ============================================================================

-- Documents table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'documents' 
        AND column_name = 'source_set'
    ) THEN
        ALTER TABLE public.documents 
        ADD COLUMN source_set TEXT NOT NULL DEFAULT 'UNSPECIFIED';
    END IF;
END $$;

-- Document chunks table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'document_chunks' 
        AND column_name = 'source_set'
    ) THEN
        ALTER TABLE public.document_chunks 
        ADD COLUMN source_set TEXT NOT NULL DEFAULT 'UNSPECIFIED';
    END IF;
END $$;

-- OFC candidate queue table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'ofc_candidate_queue' 
        AND column_name = 'source_set'
    ) THEN
        ALTER TABLE public.ofc_candidate_queue 
        ADD COLUMN source_set TEXT NOT NULL DEFAULT 'UNSPECIFIED';
    END IF;
END $$;

-- ============================================================================
-- 2. Create source set control table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.corpus_source_set_control (
    id SERIAL PRIMARY KEY,
    active_source_set TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_single_row CHECK (id = 1)
);

COMMENT ON TABLE public.corpus_source_set_control IS
'Control table for active source set. Exactly one row must exist. CORPUS project only.';

-- Insert default row if table is empty
INSERT INTO public.corpus_source_set_control (active_source_set)
SELECT 'VOFC_LIBRARY'
WHERE NOT EXISTS (SELECT 1 FROM public.corpus_source_set_control);

-- ============================================================================
-- 3. Add indexes for source_set filtering
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_documents_source_set 
    ON public.documents(source_set);

CREATE INDEX IF NOT EXISTS idx_document_chunks_source_set 
    ON public.document_chunks(source_set, document_id);

CREATE INDEX IF NOT EXISTS idx_ofc_candidate_queue_source_set 
    ON public.ofc_candidate_queue(source_set);

-- ============================================================================
-- 4. Backfill existing rows (if identifiable)
-- ============================================================================

-- Mark pilot PDFs as PILOT_DOCS if identifiable by title
UPDATE public.documents
SET source_set = 'PILOT_DOCS'
WHERE source_set = 'UNSPECIFIED'
    AND (
        title ILIKE '%Protecting Patrons%'
        OR title ILIKE '%SAFE VOFC Library%'
    );

-- Update chunks to match their document's source_set
UPDATE public.document_chunks dc
SET source_set = d.source_set
FROM public.documents d
WHERE dc.document_id = d.document_id
    AND dc.source_set = 'UNSPECIFIED';

-- Update candidates to match their source's source_set
-- (candidates link to canonical_sources, not documents directly)
-- For now, leave candidates as UNSPECIFIED if we can't trace them
-- They will be filtered out by active source_set enforcement

-- ============================================================================
-- 5. Add comments
-- ============================================================================

COMMENT ON COLUMN public.documents.source_set IS
'Source set identifier: VOFC_LIBRARY, PILOT_DOCS, or UNSPECIFIED. Used for strict filtering.';

COMMENT ON COLUMN public.document_chunks.source_set IS
'Source set identifier: VOFC_LIBRARY, PILOT_DOCS, or UNSPECIFIED. Must match parent document.';

COMMENT ON COLUMN public.ofc_candidate_queue.source_set IS
'Source set identifier: VOFC_LIBRARY, PILOT_DOCS, or UNSPECIFIED. Must match source document.';

