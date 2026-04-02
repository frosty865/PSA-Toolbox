-- Migration: Modules as Additive Content Bundles (Core Schema)
-- Date: 2026-01-21
-- Purpose: Create module-owned tables with required discipline ownership fields
--
-- HARD RULE: This migration is for RUNTIME project ONLY
-- Do NOT run this on CORPUS project
--
-- Modules are additive content bundles:
-- - Module Questions: NOT baseline questions, stored in module-owned tables
-- - Module OFCs: NOT baseline OFCs, stored only from module import payload
-- Baseline remains universal and unchanged.

BEGIN;

-- ============================================================================
-- 1. Ensure assessment_modules table exists (uses module_code as PK)
-- ============================================================================

-- Note: assessment_modules uses module_code as PRIMARY KEY
-- All foreign keys reference module_code, not an id column

-- ============================================================================
-- 2. Create/Update module_questions table with required fields
-- ============================================================================

-- Drop existing table if it exists (will recreate with new schema)
DROP TABLE IF EXISTS public.module_questions CASCADE;

CREATE TABLE IF NOT EXISTS public.module_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code TEXT NOT NULL REFERENCES public.assessment_modules(module_code) ON DELETE CASCADE,
  module_question_id TEXT NOT NULL,  -- e.g., MODULEQ_EV_CHARGING_001
  question_text TEXT NOT NULL,
  response_enum TEXT[] NOT NULL DEFAULT ARRAY['YES','NO','N_A'],
  question_intent TEXT NOT NULL DEFAULT 'PHYSICAL_CONTROL'
    CHECK (question_intent IN (
      'PHYSICAL_CONTROL',
      'GOVERNANCE_INTERFACE',
      'CONTINUITY_OPERATIONS',
      'DETECTION_ALERTING_PHYSICAL'
    )),
  discipline_id UUID NOT NULL REFERENCES public.disciplines(id) ON DELETE RESTRICT,
  discipline_subtype_id UUID NOT NULL REFERENCES public.discipline_subtypes(id) ON DELETE RESTRICT,
  asset_or_location TEXT NOT NULL,
  event_trigger TEXT NOT NULL CHECK (event_trigger IN ('FIRE','TAMPERING','IMPACT','OUTAGE','OTHER')),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (module_code, module_question_id)
);

CREATE INDEX IF NOT EXISTS idx_module_questions_module_code 
  ON public.module_questions(module_code);

CREATE INDEX IF NOT EXISTS idx_module_questions_discipline 
  ON public.module_questions(discipline_id);

CREATE INDEX IF NOT EXISTS idx_module_questions_subtype 
  ON public.module_questions(discipline_subtype_id);

CREATE INDEX IF NOT EXISTS idx_module_questions_intent 
  ON public.module_questions(question_intent);

CREATE INDEX IF NOT EXISTS idx_module_questions_question_id 
  ON public.module_questions(module_question_id);

COMMENT ON TABLE public.module_questions IS
'Stores module-specific questions (MODULEQ_ prefix). These are NOT baseline questions and are answered only when module is attached to an assessment. Each question must be anchored to a discipline and subtype, and specify asset/location and event trigger.';

COMMENT ON COLUMN public.module_questions.module_question_id IS
'Unique identifier for the module question (e.g., MODULEQ_EV_CHARGING_001). Must start with MODULEQ_ prefix.';

COMMENT ON COLUMN public.module_questions.question_text IS
'Full text of the module-specific question. Must be technology/situation dependent and non-generic.';

COMMENT ON COLUMN public.module_questions.discipline_id IS
'References the discipline that owns this question. Required for proper categorization.';

COMMENT ON COLUMN public.module_questions.discipline_subtype_id IS
'References the discipline subtype that anchors this question. Required for proper categorization.';

COMMENT ON COLUMN public.module_questions.asset_or_location IS
'Concrete asset or location this question addresses (e.g., "EV parking area", "charging bay", "control panels"). Must appear in question_text.';

COMMENT ON COLUMN public.module_questions.event_trigger IS
'Event trigger category: FIRE, TAMPERING, IMPACT, OUTAGE, or OTHER.';

COMMENT ON COLUMN public.module_questions.order_index IS
'Deterministic ordering of questions within the module. Lower numbers appear first.';

-- ============================================================================
-- 3. Create module_import_batches table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.module_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code TEXT NOT NULL REFERENCES public.assessment_modules(module_code) ON DELETE CASCADE,
  import_source TEXT NOT NULL,
  import_sha256 TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_payload JSONB NOT NULL,
  UNIQUE (module_code, import_sha256)
);

CREATE INDEX IF NOT EXISTS idx_module_import_batches_module 
  ON public.module_import_batches(module_code);

CREATE INDEX IF NOT EXISTS idx_module_import_batches_sha256 
  ON public.module_import_batches(import_sha256);

COMMENT ON TABLE public.module_import_batches IS
'Tracks module import batches. Each import creates a batch record with SHA256 hash for deduplication.';

COMMENT ON COLUMN public.module_import_batches.import_source IS
'Source identifier for the import (e.g., "module_ev_charging_import.json").';

COMMENT ON COLUMN public.module_import_batches.import_sha256 IS
'SHA256 hash of the import payload for deduplication.';

COMMENT ON COLUMN public.module_import_batches.stats IS
'Import statistics (questions_count, ofcs_count, etc.).';

COMMENT ON COLUMN public.module_import_batches.raw_payload IS
'Full JSON payload of the import for audit/replay.';

-- ============================================================================
-- 4. Create/Update module_ofcs table
-- ============================================================================

-- Migrate data from old table if it exists
DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'module_curated_ofcs'
  ) INTO v_exists;
  
  IF v_exists THEN
    -- Create new table structure
    CREATE TABLE IF NOT EXISTS public.module_ofcs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module_code TEXT NOT NULL REFERENCES public.assessment_modules(module_code) ON DELETE CASCADE,
      batch_id UUID REFERENCES public.module_import_batches(id) ON DELETE SET NULL,
      ofc_id TEXT NOT NULL,
      ofc_num INT NULL,
      ofc_text TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (module_code, ofc_id)
    );
    
    -- Migrate data (if any exists)
    INSERT INTO public.module_ofcs (module_code, ofc_id, ofc_num, ofc_text, order_index, created_at)
    SELECT module_code, ofc_id, ofc_num, ofc_text, 
           COALESCE(ofc_num, 999999)::INTEGER, created_at
    FROM public.module_curated_ofcs
    ON CONFLICT (module_code, ofc_id) DO NOTHING;
    
    -- Drop old table after migration
    DROP TABLE IF EXISTS public.module_curated_ofc_sources CASCADE;
    DROP TABLE IF EXISTS public.module_curated_ofcs CASCADE;
  ELSE
    -- Create new table without migration
    CREATE TABLE IF NOT EXISTS public.module_ofcs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module_code TEXT NOT NULL REFERENCES public.assessment_modules(module_code) ON DELETE CASCADE,
      batch_id UUID REFERENCES public.module_import_batches(id) ON DELETE SET NULL,
      ofc_id TEXT NOT NULL,
      ofc_num INT NULL,
      ofc_text TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (module_code, ofc_id)
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_module_ofcs_module 
  ON public.module_ofcs(module_code);

CREATE INDEX IF NOT EXISTS idx_module_ofcs_batch 
  ON public.module_ofcs(batch_id);

CREATE INDEX IF NOT EXISTS idx_module_ofcs_ofcnum 
  ON public.module_ofcs(ofc_num);

COMMENT ON TABLE public.module_ofcs IS
'Stores module-specific OFCs. These are NOT baseline OFCs and are displayed only when module is attached to an assessment.';

COMMENT ON COLUMN public.module_ofcs.batch_id IS
'References the import batch that created this OFC. Nullable for legacy data.';

COMMENT ON COLUMN public.module_ofcs.ofc_id IS
'Unique identifier for the OFC (e.g., EVP_OFC_001).';

COMMENT ON COLUMN public.module_ofcs.order_index IS
'Deterministic ordering of OFCs within the module. Lower numbers appear first.';

-- ============================================================================
-- 5. Create module_ofc_sources table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.module_ofc_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_ofc_id UUID NOT NULL REFERENCES public.module_ofcs(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_label TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_module_ofc_sources_ofc 
  ON public.module_ofc_sources(module_ofc_id);

COMMENT ON TABLE public.module_ofc_sources IS
'Source URLs for module OFCs. Links to external references.';

-- ============================================================================
-- 6. Create module_risk_drivers table (read-only context)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.module_risk_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code TEXT NOT NULL REFERENCES public.assessment_modules(module_code) ON DELETE CASCADE,
  driver_type TEXT NOT NULL CHECK (driver_type IN ('CYBER_DRIVER', 'FRAUD_DRIVER')),
  driver_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_module_risk_drivers_module 
  ON public.module_risk_drivers(module_code);

CREATE INDEX IF NOT EXISTS idx_module_risk_drivers_type 
  ON public.module_risk_drivers(driver_type);

COMMENT ON TABLE public.module_risk_drivers IS
'Stores cyber/fraud risk drivers as context only. These are initiating causes with physical-security consequences but are NOT converted to assessment requirements. Read-only context for convergence bridge.';

COMMENT ON COLUMN public.module_risk_drivers.module_code IS
'References the assessment module that acknowledges this risk driver.';

COMMENT ON COLUMN public.module_risk_drivers.driver_type IS
'Type of risk driver: CYBER_DRIVER (cyber threats) or FRAUD_DRIVER (fraud/payment threats).';

COMMENT ON COLUMN public.module_risk_drivers.driver_text IS
'Text describing the risk driver (e.g., "Unauthorized access to charging infrastructure", "Payment fraud leading to service disruption").';

COMMIT;
