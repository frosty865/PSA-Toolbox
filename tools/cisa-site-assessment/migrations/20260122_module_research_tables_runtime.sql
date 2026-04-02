-- Module Research Layer Tables - RUNTIME
-- 
-- Purpose: Track module-scoped research sources (URLs/files)
-- This table stays in RUNTIME because it references assessment_modules
--
-- TARGET DB: RUNTIME

BEGIN;

-- Verify assessment_modules table exists (required dependency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'assessment_modules'
  ) THEN
    RAISE EXCEPTION 'assessment_modules table does not exist. Run db/migrations/20260121_create_assessment_modules.sql first.';
  END IF;
END $$;

-- Track module research sources (URLs/files)
CREATE TABLE IF NOT EXISTS public.module_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code TEXT NOT NULL REFERENCES public.assessment_modules(module_code) ON DELETE CASCADE,

  source_url TEXT NULL,
  source_label TEXT NULL,

  -- local download details
  content_type TEXT NULL,
  file_path TEXT NULL,
  sha256 TEXT NULL,

  -- acquisition state
  fetch_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (fetch_status IN ('PENDING','DOWNLOADED','FAILED')),
  fetch_error TEXT NULL,
  fetched_at TIMESTAMPTZ NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- de-dupe within a module by URL or sha when known
  UNIQUE(module_code, source_url),
  UNIQUE(module_code, sha256)
);

CREATE INDEX IF NOT EXISTS idx_module_sources_module_code 
  ON public.module_sources(module_code);
CREATE INDEX IF NOT EXISTS idx_module_sources_sha256 
  ON public.module_sources(sha256);
CREATE INDEX IF NOT EXISTS idx_module_sources_fetch_status 
  ON public.module_sources(fetch_status);

COMMENT ON TABLE public.module_sources IS
'Module-scoped research sources (URLs/files) tracked for module research. Links to assessment_modules via module_code.';

COMMENT ON COLUMN public.module_sources.fetch_status IS
'Acquisition state: PENDING (not yet downloaded), DOWNLOADED (successfully downloaded), FAILED (download failed)';

COMMIT;
