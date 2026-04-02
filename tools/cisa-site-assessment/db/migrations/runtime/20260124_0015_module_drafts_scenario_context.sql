-- Migration: Add scenario context to module_drafts (Scenario Context Gate)
-- Date: 2026-01-24
-- Purpose: scenario_context (JSONB) and scenario_context_ready (BOOLEAN).
--          Enforced in API: when scenario_context_ready=true, scenario_context must
--          have threat_scenarios (1-2), environments (1+), assets_at_risk (1+).
-- TARGET DB: RUNTIME

BEGIN;

ALTER TABLE public.module_drafts
  ADD COLUMN IF NOT EXISTS scenario_context JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.module_drafts
  ADD COLUMN IF NOT EXISTS scenario_context_ready BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.module_drafts.scenario_context IS
'Scenario context: threat_scenarios, environments, assets_at_risk, phases. Validated in API.';
COMMENT ON COLUMN public.module_drafts.scenario_context_ready IS
'True when scenario_context has required fields (1-2 threat_scenarios, 1+ environments, 1+ assets_at_risk).';

COMMIT;
