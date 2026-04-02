-- Source Registry Migration
-- Date: 2026-01-16
-- Purpose: Create tiered source registry for citation authority tracking
--
-- Rules:
-- - Sources are registered with tier (1=CISA/DHS/National Laboratories, 2=FEMA/ISC/etc, 3=ASIS/NFPA)
-- - Citations reference source_key (not UUID) for human-readable tracking
-- - Every OFC citation must reference a registered source_key

-- ============================================================================
-- 1. Source Registry Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.source_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL UNIQUE,
  publisher TEXT NOT NULL,
  tier INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
  title TEXT NOT NULL,
  publication_date DATE NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'web', 'doc')),
  canonical_url TEXT NULL,
  local_path TEXT NULL,
  doc_sha256 TEXT NULL,
  retrieved_at TIMESTAMPTZ NULL,
  scope_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.source_registry IS
'Registry of authoritative sources for OFC citations. Sources are tiered by authority (1=CISA/DHS/National Laboratories, 2=FEMA/ISC/etc, 3=ASIS/NFPA).';

COMMENT ON COLUMN public.source_registry.source_key IS
'Unique human-readable key (e.g., "CISA_SECURITY_CONVERGENCE_2024"). Used in citations instead of UUID.';

COMMENT ON COLUMN public.source_registry.tier IS
'Authority tier: 1=CISA/DHS/National Laboratories (primary), 2=FEMA/ISC/GSA/DoD UFC/NIST (secondary), 3=ASIS/NFPA (tertiary).';

COMMENT ON COLUMN public.source_registry.scope_tags IS
'Array of scope tags: ["physical_security","planning","operations","convergence"]. Used to flag scope drift.';

COMMENT ON COLUMN public.source_registry.doc_sha256 IS
'SHA256 hash of document content for integrity verification.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_source_registry_source_key 
  ON public.source_registry(source_key);

CREATE INDEX IF NOT EXISTS idx_source_registry_publisher_tier 
  ON public.source_registry(publisher, tier);

CREATE INDEX IF NOT EXISTS idx_source_registry_doc_sha256 
  ON public.source_registry(doc_sha256) 
  WHERE doc_sha256 IS NOT NULL;

-- Updated_at trigger
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_source_registry_updated_at ON public.source_registry;
    CREATE TRIGGER update_source_registry_updated_at
      BEFORE UPDATE ON public.source_registry
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- 2. Add source_key to canonical_sources (for migration path)
-- ============================================================================

-- Add source_key to canonical_sources only if that table exists (legacy corpus had it; it was later moved to RUNTIME).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'canonical_sources') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'canonical_sources' AND column_name = 'source_key'
    ) THEN
      ALTER TABLE public.canonical_sources
        ADD COLUMN source_key TEXT NULL REFERENCES public.source_registry(source_key);
      CREATE INDEX IF NOT EXISTS idx_canonical_sources_source_key
        ON public.canonical_sources(source_key);
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 3. Note: ofc_library_citations updates are in a separate RUNTIME migration
-- ============================================================================
-- 
-- The ofc_library_citations table is in RUNTIME database, so its schema updates
-- are handled in: db/migrations/20260116_add_source_key_to_citations.sql (RUNTIME)
--
-- This migration only creates source_registry in CORPUS and updates canonical_sources.
-- Run the RUNTIME migration separately after this one completes.
