-- Deactivate SRO Baseline Spine
-- Purpose: Remove K-12-specific SRO subtype spine from baseline by deactivating it
-- Policy: Set active=false to preserve lineage (do NOT delete rows)
-- Target: SFO_SCHOOL_RESOURCE_OFFICER_SRO subtype
-- Database: RUNTIME (baseline_spines_runtime table)
-- Generated: 2026-01-16

-- ============================================================================
-- BEFORE: Report current state
-- ============================================================================
SELECT 
  'BEFORE DEACTIVATION' AS stage,
  canon_id,
  subtype_code,
  discipline_code,
  question_text,
  active
FROM public.baseline_spines_runtime
WHERE subtype_code = 'SFO_SCHOOL_RESOURCE_OFFICER_SRO'
   OR canon_id = 'BASE-SFO-SFO_SCHOOL_RESOURCE_OFFICER_SRO';

-- ============================================================================
-- DEACTIVATION
-- ============================================================================
UPDATE public.baseline_spines_runtime
SET active = FALSE
WHERE subtype_code = 'SFO_SCHOOL_RESOURCE_OFFICER_SRO'
   OR canon_id = 'BASE-SFO-SFO_SCHOOL_RESOURCE_OFFICER_SRO';

-- ============================================================================
-- AFTER: Verify deactivation
-- ============================================================================
SELECT 
  'AFTER DEACTIVATION' AS stage,
  canon_id,
  subtype_code,
  discipline_code,
  question_text,
  active
FROM public.baseline_spines_runtime
WHERE subtype_code = 'SFO_SCHOOL_RESOURCE_OFFICER_SRO'
   OR canon_id = 'BASE-SFO-SFO_SCHOOL_RESOURCE_OFFICER_SRO';
