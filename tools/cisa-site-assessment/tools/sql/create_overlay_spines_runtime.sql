-- Create Overlay Spines Runtime Table
-- Purpose: Store sector/subsector-specific overlay questions as runtime spines
-- Policy: Additive overlay layer; baseline_spines_runtime remains unchanged
-- Database: RUNTIME (wivohgbuuwxoyfyzntsd)
-- Generated: 2026-01-18

-- ============================================================================
-- 1. Create overlay_spines_runtime table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.overlay_spines_runtime (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canon_id TEXT NOT NULL UNIQUE,
  layer TEXT NOT NULL CHECK (layer IN ('SECTOR', 'SUBSECTOR')),
  sector_id TEXT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  subsector_id TEXT NULL REFERENCES public.subsectors(id) ON DELETE CASCADE,
  discipline_code TEXT NOT NULL,
  subtype_code TEXT NULL,
  question_text TEXT NOT NULL,
  response_enum JSONB NOT NULL DEFAULT '["YES","NO","N_A"]'::jsonb,
  order_index INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT overlay_spines_sector_check CHECK (
    (layer = 'SECTOR' AND sector_id IS NOT NULL AND subsector_id IS NULL) OR
    (layer = 'SUBSECTOR' AND subsector_id IS NOT NULL AND sector_id IS NOT NULL)
  )
);

COMMENT ON TABLE public.overlay_spines_runtime IS
'Overlay spines for sector/subsector-specific questions. Additive layer on top of baseline_spines_runtime.';

COMMENT ON COLUMN public.overlay_spines_runtime.canon_id IS
'Unique identifier for the overlay question (e.g., "SUB-COMMERCIAL-SHOPPING_MALLS-ACS-001").';

COMMENT ON COLUMN public.overlay_spines_runtime.layer IS
'Layer type: SECTOR (applies to all subsectors in a sector) or SUBSECTOR (specific subsector only).';

COMMENT ON COLUMN public.overlay_spines_runtime.sector_id IS
'Reference to sectors.id (TEXT). Required for SECTOR layer; also required for SUBSECTOR layer for fast filtering.';

COMMENT ON COLUMN public.overlay_spines_runtime.subsector_id IS
'Reference to subsectors.id (TEXT). Required for SUBSECTOR layer; NULL for SECTOR layer.';

COMMENT ON COLUMN public.overlay_spines_runtime.discipline_code IS
'Discipline code (e.g., "ACS", "VSS") matching baseline_spines_runtime.discipline_code.';

COMMENT ON COLUMN public.overlay_spines_runtime.subtype_code IS
'Subtype code (e.g., "ACS_BIOMETRIC_ACCESS") matching baseline_spines_runtime.subtype_code. NULL for discipline-level overlays.';

COMMENT ON COLUMN public.overlay_spines_runtime.order_index IS
'Ordering index within discipline/layer. Lower values appear first.';

COMMENT ON COLUMN public.overlay_spines_runtime.is_active IS
'Soft delete flag. Set to FALSE to deactivate without deleting.';

-- ============================================================================
-- 2. Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_overlay_spines_runtime_active_layer_sector
  ON public.overlay_spines_runtime(is_active, layer, sector_id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_overlay_spines_runtime_active_layer_subsector
  ON public.overlay_spines_runtime(is_active, layer, subsector_id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_overlay_spines_runtime_discipline_subtype
  ON public.overlay_spines_runtime(discipline_code, subtype_code)
  WHERE subtype_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_overlay_spines_runtime_canon_id
  ON public.overlay_spines_runtime(canon_id);

-- ============================================================================
-- 3. Create overlay_spine_order_registry table (optional but recommended)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.overlay_spine_order_registry (
  canon_id TEXT PRIMARY KEY REFERENCES public.overlay_spines_runtime(canon_id) ON DELETE CASCADE,
  order_index INT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.overlay_spine_order_registry IS
'Deterministic ordering registry for overlay spines. Allows order changes without updating main table.';

CREATE INDEX IF NOT EXISTS idx_overlay_spine_order_registry_order
  ON public.overlay_spine_order_registry(order_index);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify table creation
SELECT 
  'TABLE CREATED' AS status,
  COUNT(*) AS overlay_spines_count
FROM public.overlay_spines_runtime;

-- Show table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'overlay_spines_runtime'
ORDER BY ordinal_position;
