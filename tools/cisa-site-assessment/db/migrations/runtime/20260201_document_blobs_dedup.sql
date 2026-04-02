-- RUNTIME: Document blobs for single storage location per document (SHA256).
-- One row per physical file; module_documents reference it so multiple modules
-- can share one file. Fixes duplicates where the same document was stored
-- per-module (e.g. MODULE_AS_EAP and MODULE_Active Assailant_EAP).

BEGIN;

-- 1) Canonical storage: one row per file (by SHA256)
CREATE TABLE IF NOT EXISTS public.document_blobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sha256 text NOT NULL,
  storage_relpath text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sha256),
  UNIQUE(storage_relpath)
);

CREATE INDEX IF NOT EXISTS idx_document_blobs_sha256 ON public.document_blobs(sha256);
COMMENT ON TABLE public.document_blobs IS 'One physical file per SHA256; shared by module_documents across modules.';

-- 2) Link module_documents to blob (nullable for backward compat)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'module_documents' AND column_name = 'document_blob_id') THEN
    ALTER TABLE public.module_documents ADD COLUMN document_blob_id uuid NULL REFERENCES public.document_blobs(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_module_documents_document_blob_id ON public.module_documents(document_blob_id);

-- 3) Backfill: for each distinct sha256, one blob with relpath derived from local_path or synthetic
INSERT INTO public.document_blobs (sha256, storage_relpath)
SELECT DISTINCT ON (md.sha256)
  md.sha256,
  COALESCE(
    NULLIF(trim(regexp_replace(replace(md.local_path, E'\\', '/'), '^.*/raw/', 'raw/', 'i')), ''),
    'raw/_blobs/' || left(md.sha256, 2) || '/' || md.sha256 || '.pdf'
  )
FROM public.module_documents md
WHERE md.sha256 IS NOT NULL AND md.sha256 <> ''
  AND md.local_path IS NOT NULL AND md.local_path <> ''
ON CONFLICT (sha256) DO NOTHING;

-- Rows with no local_path: insert blob with synthetic path only (no file on disk until re-ingested)
INSERT INTO public.document_blobs (sha256, storage_relpath)
SELECT DISTINCT md.sha256, 'raw/_blobs/' || left(md.sha256, 2) || '/' || md.sha256 || '.pdf'
FROM public.module_documents md
WHERE md.sha256 IS NOT NULL AND md.sha256 <> ''
  AND (md.local_path IS NULL OR md.local_path = '')
ON CONFLICT (sha256) DO NOTHING;

-- Normalize: any blob with absolute-looking path -> synthetic
UPDATE public.document_blobs
SET storage_relpath = 'raw/_blobs/' || left(sha256, 2) || '/' || sha256 || '.pdf'
WHERE storage_relpath LIKE '/%' OR storage_relpath ~ '[A-Za-z]:[\\/]';

-- 4) Point module_documents to blob by sha256
UPDATE public.module_documents md
SET document_blob_id = db.id
FROM public.document_blobs db
WHERE db.sha256 = md.sha256 AND md.document_blob_id IS NULL;

COMMIT;
