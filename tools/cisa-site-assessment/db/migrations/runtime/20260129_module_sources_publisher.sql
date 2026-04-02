-- RUNTIME: Add publisher to module_sources (scraped from PDF metadata / first page, e.g. CISA, FEMA, ISC).
-- Run on RUNTIME database only.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'module_sources' AND column_name = 'publisher'
  ) THEN
    ALTER TABLE public.module_sources ADD COLUMN publisher TEXT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.module_sources.publisher IS 'Inferred from PDF (e.g. CISA, FEMA, ISC). Set on upload via extract_pdf_metadata.';
