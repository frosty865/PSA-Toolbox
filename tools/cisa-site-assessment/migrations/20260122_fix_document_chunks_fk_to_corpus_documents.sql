-- Fix document_chunks Foreign Key to Reference corpus_documents
-- 
-- Problem: document_chunks has FK referencing documents.document_id
-- Solution: Update FK to reference corpus_documents(id) which is the canonical table
--
-- TARGET DB: Supabase Postgres (psa-back / CORPUS)

BEGIN;

-- 0) Clean up orphaned chunks (chunks referencing documents that don't exist in corpus_documents)
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  -- Delete chunks that reference documents not in corpus_documents
  DELETE FROM public.document_chunks dc
  WHERE NOT EXISTS (
    SELECT 1 FROM public.corpus_documents cd
    WHERE cd.id = dc.document_id
  );
  
  GET DIAGNOSTICS orphaned_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % orphaned chunks', orphaned_count;
END $$;

-- 1) Identify & drop the existing FK that points to public.documents
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.document_chunks'::regclass
      AND contype = 'f'
  LOOP
    -- Drop all FKs on document_chunks; we will re-add the correct one below
    EXECUTE format('ALTER TABLE public.document_chunks DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;
END $$;

-- 2) Ensure document_chunks has a document_id column compatible with corpus_documents.id
-- (If the column is named differently, rename it to document_id)
-- Adjust this block if your column name differs.
-- If document_id already exists, this is a no-op.
-- If it doesn't exist but corpus_document_id does, rename.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='document_chunks' AND column_name='document_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='document_chunks' AND column_name='corpus_document_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.document_chunks RENAME COLUMN corpus_document_id TO document_id';
      RAISE NOTICE 'Renamed corpus_document_id to document_id';
    ELSE
      RAISE EXCEPTION 'document_chunks has no document_id or corpus_document_id column; update migration to match schema.';
    END IF;
  END IF;
END $$;

-- 3) Verify corpus_documents table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='corpus_documents'
  ) THEN
    RAISE EXCEPTION 'corpus_documents table does not exist. Run corpus schema migrations first.';
  END IF;
END $$;

-- 4) Add correct FK to corpus_documents
ALTER TABLE public.document_chunks
  ADD CONSTRAINT document_chunks_document_id_fkey
  FOREIGN KEY (document_id)
  REFERENCES public.corpus_documents(id)
  ON DELETE CASCADE;

-- 5) Ensure index exists for performance
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id
  ON public.document_chunks(document_id);

COMMENT ON CONSTRAINT document_chunks_document_id_fkey ON public.document_chunks IS
'Foreign key to corpus_documents(id) - canonical document table for CORPUS ingestion';

COMMIT;
