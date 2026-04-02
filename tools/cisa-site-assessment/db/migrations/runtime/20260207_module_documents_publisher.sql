-- RUNTIME: Add publisher to module_documents (scraped from PDF metadata / first page).
-- Backfill via: npx tsx tools/corpus/backfill_module_documents_publisher.ts

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'module_documents' AND column_name = 'publisher'
  ) THEN
    ALTER TABLE public.module_documents ADD COLUMN publisher TEXT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.module_documents.publisher IS 'Inferred from PDF (e.g. CISA, FEMA, ISC). Set on ingest or via backfill_module_documents_publisher.';
