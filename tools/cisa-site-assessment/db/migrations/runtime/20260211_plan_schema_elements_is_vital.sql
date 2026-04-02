-- RUNTIME: Add is_vital to plan_schema_elements (TOC-derived and __core elements are vital).

BEGIN;

ALTER TABLE public.plan_schema_elements
  ADD COLUMN IF NOT EXISTS is_vital boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.plan_schema_elements.is_vital IS 'True for TOC-derived sub-entries and __core fallback; plans treat all as documentation-critical.';

COMMIT;
