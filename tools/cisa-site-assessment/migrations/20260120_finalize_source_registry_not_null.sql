-- Finalize source_registry_id NOT NULL constraint
-- Run this AFTER backfilling all existing NULL values

DO $$
DECLARE
  doc_table text;
  tbl text;
  null_count integer;
BEGIN
  -- Determine document header table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='corpus_documents') THEN
    doc_table := 'public.corpus_documents';
    tbl := 'corpus_documents';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='documents') THEN
    doc_table := 'public.documents';
    tbl := 'documents';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='document_registry') THEN
    doc_table := 'public.document_registry';
    tbl := 'document_registry';
  ELSE
    RAISE EXCEPTION 'No document header table found. Expected public.corpus_documents or public.documents or public.document_registry.';
  END IF;

  -- Check if source_registry_id column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=tbl AND column_name='source_registry_id'
  ) THEN
    RAISE EXCEPTION 'Column source_registry_id not found in %. Run 20260120_enforce_source_registry_on_documents.sql first.', tbl;
  END IF;

  -- Count remaining NULL values
  EXECUTE format('SELECT COUNT(*) FROM %s WHERE source_registry_id IS NULL', doc_table) INTO null_count;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'Cannot set NOT NULL: % rows still have NULL source_registry_id in %. Backfill remaining rows first.', null_count, tbl;
  END IF;

  -- Validate NOT VALID constraint if present
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='public' 
      AND t.relname=tbl 
      AND c.conname=tbl || '_require_source_registry_id_on_new'
  ) THEN
    EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', doc_table, tbl || '_require_source_registry_id_on_new');
    RAISE NOTICE 'Validated constraint %_require_source_registry_id_on_new', tbl;
  END IF;

  -- Enforce NOT NULL
  EXECUTE format('ALTER TABLE %s ALTER COLUMN source_registry_id SET NOT NULL', doc_table);

  RAISE NOTICE 'Finalized NOT NULL on %.source_registry_id', doc_table;
END $$;
