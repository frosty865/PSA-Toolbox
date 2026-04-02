-- Migration: Module Risk Drivers (Context Only)
-- Date: 2026-01-21
-- Purpose: Create table for storing cyber/fraud drivers as context without converting to requirements
--
-- HARD RULE: This migration is for RUNTIME project ONLY
-- Do NOT run this on CORPUS project
--
-- Risk drivers are initiating causes (cyber/fraud) that have physical-security consequences.
-- They are stored as context but do NOT become assessment requirements.

BEGIN;

-- ============================================================================
-- 1. Create module_risk_drivers table
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
'Stores cyber/fraud risk drivers as context only. These are initiating causes with physical-security consequences but are NOT converted to assessment requirements. Used for convergence bridge inference to generate PSA-scope questions.';

COMMENT ON COLUMN public.module_risk_drivers.module_code IS
'References the assessment module that acknowledges this risk driver.';

COMMENT ON COLUMN public.module_risk_drivers.driver_type IS
'Type of risk driver: CYBER_DRIVER (cyber threats) or FRAUD_DRIVER (fraud/payment threats).';

COMMENT ON COLUMN public.module_risk_drivers.driver_text IS
'Text describing the risk driver (e.g., "Unauthorized access to charging infrastructure", "Payment fraud leading to service disruption").';

COMMIT;
