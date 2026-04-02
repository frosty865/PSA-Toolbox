-- CORPUS: Add ingestion_stream and storage_relpath to source_registry
-- Run on CORPUS database only.
--
-- ingestion_stream: ALWAYS 'CORPUS' for evidence; strict separation.
-- storage_relpath: path under CORPUS_SOURCES_ROOT (e.g. raw/xxx.pdf).

-- ingestion_stream
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'source_registry' AND column_name = 'ingestion_stream'
  ) THEN
    ALTER TABLE public.source_registry
      ADD COLUMN ingestion_stream TEXT NOT NULL DEFAULT 'CORPUS';
    COMMENT ON COLUMN public.source_registry.ingestion_stream IS
      'Ingestion stream: CORPUS only. All evidence rows must be CORPUS.';
  END IF;
END $$;

-- Backfill existing rows
UPDATE public.source_registry
SET ingestion_stream = 'CORPUS'
WHERE ingestion_stream IS NULL OR ingestion_stream <> 'CORPUS';

-- storage_relpath (under CORPUS_SOURCES_ROOT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'source_registry' AND column_name = 'storage_relpath'
  ) THEN
    ALTER TABLE public.source_registry
      ADD COLUMN storage_relpath TEXT NULL;
    COMMENT ON COLUMN public.source_registry.storage_relpath IS
      'Path relative to CORPUS_SOURCES_ROOT (e.g. raw/subdir/file.pdf). Null for URL-only sources.';
  END IF;
END $$;

-- Optional: migrate local_path -> storage_relpath where local_path looks relative
-- (Skip if local_path is absolute or project-specific; app can backfill manually.)
-- UPDATE public.source_registry SET storage_relpath = local_path
-- WHERE storage_relpath IS NULL AND local_path IS NOT NULL AND local_path NOT LIKE '/%' AND local_path NOT LIKE '%:%';
