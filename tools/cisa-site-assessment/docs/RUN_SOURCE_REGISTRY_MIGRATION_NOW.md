# Run Source Registry Migration - Quick Guide

## Current Status

Direct Postgres connections to CORPUS database are timing out. Use **Supabase SQL Editor** instead.

**Note**: `source_registry` is in CORPUS database (not RUNTIME) because sources are "data" not "runtime".

## Steps to Run Migration

**IMPORTANT**: This migration has two parts:
1. **CORPUS migration**: Creates `source_registry` table (run in CORPUS database)
2. **RUNTIME migration**: Updates `ofc_library_citations` (run in RUNTIME database)

### Part 1: CORPUS Migration (source_registry)

#### 1. Open Supabase SQL Editor for CORPUS

1. Go to: https://supabase.com/dashboard/project/yylslokiaovdythzrbgt/sql/new
2. This opens the SQL Editor for your CORPUS project

#### 2. Copy Migration SQL

The CORPUS migration file is located at:
```
db/migrations/20260116_create_source_registry.sql
```

**OR** copy the SQL below:

```sql
-- Source Registry Migration
-- Date: 2026-01-16
-- Purpose: Create tiered source registry for citation authority tracking

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
'Registry of authoritative sources for OFC citations. Sources are tiered by authority (1=CISA/DHS, 2=FEMA/ISC/etc, 3=ASIS/NFPA).';

COMMENT ON COLUMN public.source_registry.source_key IS
'Unique human-readable key (e.g., "CISA_SECURITY_CONVERGENCE_2024"). Used in citations instead of UUID.';

COMMENT ON COLUMN public.source_registry.tier IS
'Authority tier: 1=CISA/DHS (primary), 2=FEMA/ISC/GSA/DoD UFC/NIST (secondary), 3=ASIS/NFPA (tertiary).';

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

DO $$
BEGIN
  -- Add source_key column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'canonical_sources' 
    AND column_name = 'source_key'
  ) THEN
    ALTER TABLE public.canonical_sources 
      ADD COLUMN source_key TEXT NULL REFERENCES public.source_registry(source_key);
    
    CREATE INDEX IF NOT EXISTS idx_canonical_sources_source_key 
      ON public.canonical_sources(source_key);
  END IF;
END $$;

-- ============================================================================
-- 3. Update ofc_library_citations to support source_key
-- ============================================================================

DO $$
BEGIN
  -- Add source_key column to citations table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_library_citations' 
    AND column_name = 'source_key'
  ) THEN
    ALTER TABLE public.ofc_library_citations 
      ADD COLUMN source_key TEXT NULL REFERENCES public.source_registry(source_key);
    
    CREATE INDEX IF NOT EXISTS idx_ofc_library_citations_source_key 
      ON public.ofc_library_citations(source_key);
  END IF;

  -- Add locator_type column (replaces page_locator with structured locator)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_library_citations' 
    AND column_name = 'locator_type'
  ) THEN
    ALTER TABLE public.ofc_library_citations 
      ADD COLUMN locator_type TEXT NULL CHECK (locator_type IN ('page', 'section', 'paragraph', 'url_fragment'));
  END IF;

  -- Rename page_locator to locator (if exists and locator doesn't)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_library_citations' 
    AND column_name = 'page_locator'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_library_citations' 
    AND column_name = 'locator'
  ) THEN
    ALTER TABLE public.ofc_library_citations 
      RENAME COLUMN page_locator TO locator;
  END IF;

  -- Add locator column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_library_citations' 
    AND column_name = 'locator'
  ) THEN
    ALTER TABLE public.ofc_library_citations 
      ADD COLUMN locator TEXT NULL;
  END IF;

  -- Add retrieved_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ofc_library_citations' 
    AND column_name = 'retrieved_at'
  ) THEN
    ALTER TABLE public.ofc_library_citations 
      ADD COLUMN retrieved_at TIMESTAMPTZ NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.ofc_library_citations.source_key IS
'References source_registry.source_key. Required for new citations.';

COMMENT ON COLUMN public.ofc_library_citations.locator_type IS
'Type of locator: "page", "section", "paragraph", or "url_fragment".';

COMMENT ON COLUMN public.ofc_library_citations.locator IS
'Locator value (e.g., "p.12", "Section 3.2", "para-4", "#heading-id").';

-- ============================================================================
-- 4. Add constraint: citations must have source_key OR source_id (for migration)
-- ============================================================================

DO $$
BEGIN
  -- Add check constraint: at least one of source_key or source_id must be present
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_citation_has_source'
  ) THEN
    ALTER TABLE public.ofc_library_citations 
      ADD CONSTRAINT chk_citation_has_source 
      CHECK (source_key IS NOT NULL OR source_id IS NOT NULL);
  END IF;
END $$;
```

#### 3. Paste and Run CORPUS Migration

1. Paste the entire SQL from `20260116_create_source_registry.sql` into the CORPUS SQL Editor
2. Click **Run** (or press Ctrl+Enter)
3. Wait for execution to complete

#### 4. Verify CORPUS Migration

Run this verification query in CORPUS SQL Editor:

```sql
-- Check source_registry table exists
SELECT COUNT(*) FROM public.source_registry;

-- Check canonical_sources has source_key column
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'canonical_sources' 
  AND column_name = 'source_key';
```

Expected results:
- `source_registry` table should exist (count may be 0 if no sources added yet)
- `canonical_sources.source_key` column should exist

### Part 2: RUNTIME Migration (ofc_library_citations)

#### 1. Open Supabase SQL Editor for RUNTIME

1. Go to: https://supabase.com/dashboard/project/wivohgbuuwxoyfyzntsd/sql/new
2. This opens the SQL Editor for your RUNTIME project

#### 2. Copy RUNTIME Migration SQL

The RUNTIME migration file is located at:
```
db/migrations/20260116_add_source_key_to_citations.sql
```

#### 3. Paste and Run RUNTIME Migration

1. Paste the entire SQL from `20260116_add_source_key_to_citations.sql` into the RUNTIME SQL Editor
2. Click **Run** (or press Ctrl+Enter)
3. Wait for execution to complete

#### 4. Verify RUNTIME Migration

Run this verification query in RUNTIME SQL Editor:

```sql
-- Check citation columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'ofc_library_citations' 
  AND column_name IN ('source_key', 'locator_type', 'locator', 'retrieved_at');
```

Expected results:
- All 4 citation columns should exist (`source_key`, `locator_type`, `locator`, `retrieved_at`)

## Why SQL Editor?

Direct Postgres connections are timing out (likely network/firewall or direct access not enabled). Supabase SQL Editor works through the web interface and doesn't require direct database access.

## After Migration

Once the migration is complete, you can:
1. Access the Source Registry admin UI at: `http://localhost:3000/admin/source-registry`
2. Register authoritative sources
3. Create OFCs with citations referencing `source_key`
