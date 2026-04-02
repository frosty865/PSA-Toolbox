-- Migration: Seed Subsector Module Policy Examples
-- Date: 2026-01-21
-- Purpose: Seed example policy rows for subsector-driven module attachment
--
-- HARD RULE: This migration is for RUNTIME project ONLY
-- Do NOT run this on CORPUS project
--
-- NOTE: This seed uses LOOKUP only - no hardcoded UUIDs.
-- It will only insert if both subsector and module exist.

BEGIN;

-- Example: Attach MODULE_PUBLIC_VENUE_CROWD_MANAGEMENT as REQUIRED for Mass Gathering subsectors
-- Replace module_code with actual existing module codes in your database

DO $$
DECLARE
  v_module_code TEXT;
  v_mass_subsector TEXT;
  v_theme_subsector TEXT;
BEGIN
  -- Lookup module by code (must exist in assessment_modules)
  SELECT module_code INTO v_module_code
  FROM public.assessment_modules
  WHERE module_code = 'MODULE_PUBLIC_VENUE_CROWD_MANAGEMENT'
    AND is_active = true
  LIMIT 1;

  IF v_module_code IS NULL THEN
    RAISE NOTICE 'Seed skipped: module_code MODULE_PUBLIC_VENUE_CROWD_MANAGEMENT not found or inactive';
  ELSE
    -- Mass Gathering (lookup by name pattern)
    SELECT id INTO v_mass_subsector
    FROM public.subsectors
    WHERE name ILIKE '%mass%gather%'
       OR name ILIKE '%public%venue%'
    LIMIT 1;

    IF v_mass_subsector IS NOT NULL THEN
      INSERT INTO public.subsector_module_policy (subsector_id, module_code, attach_mode)
      VALUES (v_mass_subsector, v_module_code, 'REQUIRED')
      ON CONFLICT (subsector_id, module_code) DO NOTHING;
      
      RAISE NOTICE 'Seed: Attached MODULE_PUBLIC_VENUE_CROWD_MANAGEMENT as REQUIRED for subsector %', v_mass_subsector;
    ELSE
      RAISE NOTICE 'Seed skipped: Mass Gathering subsector not found by name lookup';
    END IF;

    -- Theme Park (lookup by name pattern)
    SELECT id INTO v_theme_subsector
    FROM public.subsectors
    WHERE name ILIKE '%theme%park%'
       OR name ILIKE '%amusement%'
    LIMIT 1;

    IF v_theme_subsector IS NOT NULL THEN
      INSERT INTO public.subsector_module_policy (subsector_id, module_code, attach_mode)
      VALUES (v_theme_subsector, v_module_code, 'DEFAULT_ON')
      ON CONFLICT (subsector_id, module_code) DO NOTHING;
      
      RAISE NOTICE 'Seed: Attached MODULE_PUBLIC_VENUE_CROWD_MANAGEMENT as DEFAULT_ON for subsector %', v_theme_subsector;
    ELSE
      RAISE NOTICE 'Seed skipped: Theme Park subsector not found by name lookup';
    END IF;
  END IF;
END $$;

COMMIT;
