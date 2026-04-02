-- Migration: Add trace fields to module_ofcs for source system tracking
-- Date: 2026-01-21
-- Purpose: Enable tracking of original source IDs (e.g., IST_OFC_*) without displaying them
--
-- HARD RULE: This migration is for RUNTIME project ONLY
-- Do NOT run this on CORPUS project

BEGIN;

-- Add trace fields to module_ofcs
ALTER TABLE public.module_ofcs
  ADD COLUMN IF NOT EXISTS source_system TEXT NULL,
  ADD COLUMN IF NOT EXISTS source_ofc_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS source_ofc_num INT NULL;

-- Add index for source system queries
CREATE INDEX IF NOT EXISTS idx_module_ofcs_source_system 
  ON public.module_ofcs(source_system);

COMMENT ON COLUMN public.module_ofcs.source_system IS
'Source system identifier (e.g., "VULN_JSON", "IST_HTML"). Used for traceability without exposing source IDs in UI.';

COMMENT ON COLUMN public.module_ofcs.source_ofc_id IS
'Original OFC ID from source system (e.g., "IST_OFC_000045"). Stored for traceability but NOT displayed as the module OFC ID.';

COMMENT ON COLUMN public.module_ofcs.source_ofc_num IS
'Original OFC number from source system. Stored for traceability but NOT displayed as the module OFC number.';

COMMIT;
