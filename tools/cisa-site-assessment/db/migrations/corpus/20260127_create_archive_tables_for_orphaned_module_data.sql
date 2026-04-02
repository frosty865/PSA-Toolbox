-- CORPUS: Create Archive Tables for Orphaned Module Data
-- Date: 2026-01-27
-- Purpose: Create archive tables to store orphaned corpus_documents and document_chunks
--          from incorrect module ingestion (module files should never have been in CORPUS)
--
-- TARGET DB: CORPUS

BEGIN;

-- Create archive schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS archive;

-- ============================================================================
-- 1. Archive corpus_documents table
-- ============================================================================

CREATE TABLE IF NOT EXISTS archive.archive_corpus_documents (
    LIKE public.corpus_documents INCLUDING ALL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archive_reason TEXT
);

-- Add primary key if not inherited
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'archive.archive_corpus_documents'::regclass
        AND contype = 'p'
    ) THEN
        ALTER TABLE archive.archive_corpus_documents
        ADD PRIMARY KEY (id);
    END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_archive_corpus_documents_source_registry_id
    ON archive.archive_corpus_documents(source_registry_id);
CREATE INDEX IF NOT EXISTS idx_archive_corpus_documents_archived_at
    ON archive.archive_corpus_documents(archived_at);

COMMENT ON TABLE archive.archive_corpus_documents IS
'Archive of corpus_documents that were incorrectly ingested from module uploads. Module uploads should NEVER be in CORPUS - they belong in RUNTIME.module_documents only.';

COMMENT ON COLUMN archive.archive_corpus_documents.archived_at IS
'Timestamp when this document was archived.';

COMMENT ON COLUMN archive.archive_corpus_documents.archive_reason IS
'Reason for archiving (e.g., MODULE_INGESTION_ORPHANED).';

-- ============================================================================
-- 2. Archive document_chunks table
-- ============================================================================

CREATE TABLE IF NOT EXISTS archive.archive_document_chunks (
    LIKE public.document_chunks INCLUDING ALL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archive_reason TEXT
);

-- Add primary key if not inherited
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'archive.archive_document_chunks'::regclass
        AND contype = 'p'
    ) THEN
        ALTER TABLE archive.archive_document_chunks
        ADD PRIMARY KEY (chunk_id);
    END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_archive_document_chunks_document_id
    ON archive.archive_document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_archive_document_chunks_archived_at
    ON archive.archive_document_chunks(archived_at);

COMMENT ON TABLE archive.archive_document_chunks IS
'Archive of document_chunks from incorrectly ingested module documents. Module uploads should NEVER be in CORPUS.';

COMMENT ON COLUMN archive.archive_document_chunks.archived_at IS
'Timestamp when this chunk was archived.';

COMMENT ON COLUMN archive.archive_document_chunks.archive_reason IS
'Reason for archiving (e.g., MODULE_INGESTION_ORPHANED).';

COMMIT;
