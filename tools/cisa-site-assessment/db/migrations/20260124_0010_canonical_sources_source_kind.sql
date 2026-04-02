-- Add source_kind to canonical_sources
-- Date: 2026-01-24
-- Purpose: Explicit classification for CORPUS vs MODULE_RESEARCH sources
-- IMPORTANT: Run against CORPUS database only

BEGIN;

-- Add column
ALTER TABLE public.canonical_sources
  ADD COLUMN IF NOT EXISTS source_kind text;

-- Backfill: mark module research sources deterministically (one-time)
UPDATE public.canonical_sources
SET source_kind = 'MODULE_RESEARCH'
WHERE
  (title ILIKE '%MODULE RESEARCH%'
   OR citation_text ILIKE '%MODULE RESEARCH%');

-- Default everything else to CORPUS
UPDATE public.canonical_sources
SET source_kind = 'CORPUS'
WHERE source_kind IS NULL OR btrim(source_kind) = '';

-- Enforce constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_canonical_sources_source_kind'
    AND conrelid = 'public.canonical_sources'::regclass
  ) THEN
    ALTER TABLE public.canonical_sources
      ADD CONSTRAINT chk_canonical_sources_source_kind
      CHECK (source_kind IN ('CORPUS','MODULE_RESEARCH'));
  END IF;
END$$;

-- Enforce NOT NULL
ALTER TABLE public.canonical_sources
  ALTER COLUMN source_kind SET NOT NULL;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_canonical_sources_source_kind
  ON public.canonical_sources (source_kind);

COMMENT ON COLUMN public.canonical_sources.source_kind IS
'Source classification: CORPUS = corpus mining eligible, MODULE_RESEARCH = module research documents (blocked from corpus mining by default).';

COMMIT;

-- Verification query (run separately):
-- SELECT source_kind, count(*) FROM public.canonical_sources GROUP BY source_kind;
