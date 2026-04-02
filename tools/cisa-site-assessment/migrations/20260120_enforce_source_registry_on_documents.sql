-- Enforce authoritative source binding at the document header level.
-- This does NOT touch document_chunks, except via FK assumptions.

DO $$
DECLARE
  doc_table text;
  has_table boolean;
BEGIN
  -- Determine document header table in priority order
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='corpus_documents'
  ) INTO has_table;
  IF has_table THEN
    doc_table := 'public.corpus_documents';
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='documents'
    ) INTO has_table;
    IF has_table THEN
      doc_table := 'public.documents';
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='public' AND table_name='document_registry'
      ) INTO has_table;
      IF has_table THEN
        doc_table := 'public.document_registry';
      ELSE
        RAISE EXCEPTION 'No document header table found. Expected public.corpus_documents or public.documents or public.document_registry.';
      END IF;
    END IF;
  END IF;

  -- Ensure source_registry exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='source_registry'
  ) THEN
    RAISE EXCEPTION 'public.source_registry table not found.';
  END IF;

  -- Add column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=split_part(doc_table,'.',2) AND column_name='source_registry_id'
  ) THEN
    EXECUTE format('ALTER TABLE %s ADD COLUMN source_registry_id uuid;', doc_table);
  END IF;

  -- Add index if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public'
      AND tablename=split_part(doc_table,'.',2)
      AND indexname=split_part(doc_table,'.',2) || '_source_registry_id_idx'
  ) THEN
    EXECUTE format('CREATE INDEX %I ON %s (source_registry_id);',
      split_part(doc_table,'.',2) || '_source_registry_id_idx',
      doc_table
    );
  END IF;

  -- Add FK if missing
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='public'
      AND t.relname=split_part(doc_table,'.',2)
      AND c.conname=split_part(doc_table,'.',2) || '_source_registry_id_fkey'
  ) THEN
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (source_registry_id) REFERENCES public.source_registry(id) ON DELETE RESTRICT;',
      doc_table,
      split_part(doc_table,'.',2) || '_source_registry_id_fkey'
    );
  END IF;

  -- Guardrail: do NOT set NOT NULL yet. That comes AFTER backfill.
  -- But we prevent NEW inserts without source_registry_id using a check constraint that only applies to new rows
  -- if you have a created_at column. If not, we skip.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=split_part(doc_table,'.',2) AND column_name='created_at'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname='public'
        AND t.relname=split_part(doc_table,'.',2)
        AND c.conname=split_part(doc_table,'.',2) || '_require_source_registry_id_on_new'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %s ADD CONSTRAINT %I CHECK (source_registry_id IS NOT NULL) NOT VALID;',
        doc_table,
        split_part(doc_table,'.',2) || '_require_source_registry_id_on_new'
      );
      -- NOT VALID means existing rows aren't blocked; new rows are checked.
      -- Validate after backfill.
    END IF;
  END IF;

  RAISE NOTICE 'Document header table selected: %', doc_table;
END $$;
