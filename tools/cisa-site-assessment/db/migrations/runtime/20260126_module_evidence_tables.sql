-- RUNTIME: Module Evidence Tables
-- Module uploads are stored ONLY in RUNTIME, never copied to CORPUS
-- This enforces hard segregation between module-scoped evidence and global CORPUS

BEGIN;

CREATE TABLE IF NOT EXISTS public.module_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code text NOT NULL,
  label text NOT NULL,
  source_type text NOT NULL DEFAULT 'MODULE_UPLOAD', -- MODULE_UPLOAD only
  local_path text NULL,
  url text NULL,
  sha256 text NULL,
  status text NOT NULL DEFAULT 'DOWNLOADED', -- DOWNLOADED | INGESTED | FAILED
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_documents_module_code ON public.module_documents(module_code);

CREATE TABLE IF NOT EXISTS public.module_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_document_id uuid NOT NULL REFERENCES public.module_documents(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  text text NOT NULL,
  locator jsonb NULL, -- {"type":"PDF_PAGE","page_start":1,"page_end":2} etc (module-local locators)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_chunks_doc ON public.module_chunks(module_document_id);

-- updated_at trigger (reuse if already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS trigger AS $f$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $f$ LANGUAGE plpgsql;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_module_documents_updated_at ON public.module_documents;
CREATE TRIGGER trg_module_documents_updated_at
BEFORE UPDATE ON public.module_documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.module_documents IS 'Module-scoped evidence documents. Never copied to CORPUS.';
COMMENT ON TABLE public.module_chunks IS 'Text chunks extracted from module_documents. Module-scoped only.';

COMMIT;
