-- Migration: Subsector Module Policy and Instance Locking
-- Date: 2026-01-21
-- Purpose: Add subsector-driven module auto-attachment with DEFAULT_ON + REQUIRED modes and locked removal guard
--
-- HARD RULE: This migration is for RUNTIME project ONLY
-- Do NOT run this on CORPUS project

BEGIN;

-- ============================================================================
-- 1. Create subsector_module_policy table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subsector_module_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subsector_id TEXT NOT NULL REFERENCES public.subsectors(id) ON DELETE CASCADE,
  module_code TEXT NOT NULL REFERENCES public.assessment_modules(module_code) ON DELETE CASCADE,
  attach_mode TEXT NOT NULL CHECK (attach_mode IN ('DEFAULT_ON', 'REQUIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subsector_id, module_code)
);

CREATE INDEX IF NOT EXISTS idx_subsector_module_policy_subsector
  ON public.subsector_module_policy(subsector_id);

CREATE INDEX IF NOT EXISTS idx_subsector_module_policy_module
  ON public.subsector_module_policy(module_code);

COMMENT ON TABLE public.subsector_module_policy IS
'Defines which modules are automatically attached to assessments based on subsector. REQUIRED modules are locked and cannot be removed.';

COMMENT ON COLUMN public.subsector_module_policy.attach_mode IS
'DEFAULT_ON: Module is auto-attached but can be removed. REQUIRED: Module is auto-attached and locked (cannot be removed).';

-- ============================================================================
-- 2. Extend assessment_module_instances table
-- ============================================================================

ALTER TABLE public.assessment_module_instances
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.assessment_module_instances
  ADD COLUMN IF NOT EXISTS attached_via TEXT NOT NULL DEFAULT 'USER'
  CHECK (attached_via IN ('USER', 'SUBSECTOR_DEFAULT', 'SUBSECTOR_REQUIRED'));

CREATE INDEX IF NOT EXISTS idx_assessment_module_instances_attached_via
  ON public.assessment_module_instances(attached_via);

CREATE INDEX IF NOT EXISTS idx_assessment_module_instances_is_locked
  ON public.assessment_module_instances(is_locked);

COMMENT ON COLUMN public.assessment_module_instances.is_locked IS
'If true, this module instance cannot be removed (required by subsector policy).';

COMMENT ON COLUMN public.assessment_module_instances.attached_via IS
'How this module was attached: USER (manual), SUBSECTOR_DEFAULT (auto-attached, removable), SUBSECTOR_REQUIRED (auto-attached, locked).';

COMMIT;
