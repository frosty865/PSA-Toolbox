-- Migration: Add discipline_subtype_id to module_ofcs for template-driven OFC creation
-- Date: 2026-01-25
-- Purpose: OFC creation is template-driven by discipline_subtype_id. ofc_text comes from
--          public/doctrine/module_ofc_templates_v1.json. Nullable for existing rows.

ALTER TABLE public.module_ofcs
  ADD COLUMN IF NOT EXISTS discipline_subtype_id UUID REFERENCES public.discipline_subtypes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_module_ofcs_discipline_subtype_id
  ON public.module_ofcs(discipline_subtype_id) WHERE discipline_subtype_id IS NOT NULL;

COMMENT ON COLUMN public.module_ofcs.discipline_subtype_id IS
'References discipline_subtypes.id. Template-driven OFCs must set this; ofc_text comes from module_ofc_templates_v1.';
