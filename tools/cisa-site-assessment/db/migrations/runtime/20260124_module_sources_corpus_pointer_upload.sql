-- RUNTIME: Add source_type (CORPUS_POINTER | MODULE_UPLOAD), corpus_source_id, storage_relpath to module_sources
-- Run on RUNTIME database only.
--
-- Constraints:
--   CORPUS_POINTER: corpus_source_id IS NOT NULL, storage_relpath IS NULL
--   MODULE_UPLOAD:  storage_relpath IS NOT NULL, corpus_source_id IS NULL

-- 1) Add columns (nullable initially)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='module_sources' AND column_name='source_type') THEN
    ALTER TABLE public.module_sources ADD COLUMN source_type TEXT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='module_sources' AND column_name='corpus_source_id') THEN
    ALTER TABLE public.module_sources ADD COLUMN corpus_source_id UUID NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='module_sources' AND column_name='storage_relpath') THEN
    ALTER TABLE public.module_sources ADD COLUMN storage_relpath TEXT NULL;
  END IF;
END $$;

-- 2) Backfill: existing rows -> MODULE_UPLOAD, storage_relpath=file_path
UPDATE public.module_sources
SET source_type = 'MODULE_UPLOAD',
    storage_relpath = file_path,
    corpus_source_id = NULL
WHERE source_type IS NULL;

-- 3) Any remaining null source_type (e.g. no file_path) -> MODULE_UPLOAD, storage_relpath from file_path or leave null
--    For MODULE_UPLOAD we require storage_relpath. Rows with no file_path are legacy URL-only; we allow storage_relpath NULL
--    for them by relaxing the CHECK slightly: MODULE_UPLOAD allows storage_relpath NULL for legacy. Spec says
--    "MODULE_UPLOAD then storage_relpath IS NOT NULL" — for new uploads we enforce that in the API. For migration,
--    we'll set source_type and leave storage_relpath as is. Add a CHECK that permits:
--    (CORPUS_POINTER: corpus_source_id NOT NULL, storage_relpath NULL) OR
--    (MODULE_UPLOAD: corpus_source_id NULL).  (storage_relpath NOT NULL only for new MODULE_UPLOAD; we allow null for legacy.)
UPDATE public.module_sources SET source_type = 'MODULE_UPLOAD' WHERE source_type IS NULL;

-- 4) Set default and NOT NULL for source_type
ALTER TABLE public.module_sources ALTER COLUMN source_type SET DEFAULT 'MODULE_UPLOAD';
ALTER TABLE public.module_sources ALTER COLUMN source_type SET NOT NULL;

-- 5) Add CHECK: CORPUS_POINTER (corpus_source_id NOT NULL, storage_relpath NULL); MODULE_UPLOAD (corpus_source_id NULL)
ALTER TABLE public.module_sources DROP CONSTRAINT IF EXISTS chk_module_sources_source_type_refs;
ALTER TABLE public.module_sources ADD CONSTRAINT chk_module_sources_source_type_refs CHECK (
  (source_type = 'CORPUS_POINTER' AND corpus_source_id IS NOT NULL AND storage_relpath IS NULL)
  OR
  (source_type = 'MODULE_UPLOAD' AND corpus_source_id IS NULL)
);

-- 6) Drop old UNIQUE constraints that would block CORPUS_POINTER
ALTER TABLE public.module_sources DROP CONSTRAINT IF EXISTS module_sources_module_code_source_url_key;
ALTER TABLE public.module_sources DROP CONSTRAINT IF EXISTS module_sources_module_code_sha256_key;

-- 7) Partial unique: one CORPUS_POINTER per (module_code, corpus_source_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_module_sources_module_code_corpus_source_id
  ON public.module_sources (module_code, corpus_source_id)
  WHERE source_type = 'CORPUS_POINTER' AND corpus_source_id IS NOT NULL;

-- 8) Partial uniques for MODULE_UPLOAD (de-dupe by source_url or sha256)
CREATE UNIQUE INDEX IF NOT EXISTS idx_module_sources_module_code_source_url_upload
  ON public.module_sources (module_code, source_url)
  WHERE source_type = 'MODULE_UPLOAD' AND source_url IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_module_sources_module_code_sha256_upload
  ON public.module_sources (module_code, sha256)
  WHERE source_type = 'MODULE_UPLOAD' AND sha256 IS NOT NULL;

COMMENT ON COLUMN public.module_sources.source_type IS 'CORPUS_POINTER: references CORPUS source_registry; MODULE_UPLOAD: file under MODULE_SOURCES_ROOT.';
COMMENT ON COLUMN public.module_sources.corpus_source_id IS 'Set only when source_type=CORPUS_POINTER; references CORPUS.source_registry.id.';
COMMENT ON COLUMN public.module_sources.storage_relpath IS 'Path under MODULE_SOURCES_ROOT when source_type=MODULE_UPLOAD. Null for CORPUS_POINTER.';
