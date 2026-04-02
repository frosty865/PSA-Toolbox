-- ============================================================================
-- Discipline Subtype Reference Implementation Store
-- Stores canonical reference implementations per discipline_subtype_id
-- ============================================================================
-- Date: 2026-01-24
-- Purpose: Store subtype-bound reference implementations for baseline intent
--          Provides "What this question means" guidance per subtype
-- TARGET DB: RUNTIME

BEGIN;

CREATE TABLE IF NOT EXISTS public.discipline_subtype_reference_impl (
  discipline_subtype_id UUID PRIMARY KEY
    REFERENCES public.discipline_subtypes(id) ON DELETE CASCADE,
  reference_impl JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discipline_subtype_reference_impl_json
  ON public.discipline_subtype_reference_impl
  USING GIN (reference_impl);

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_discipline_subtype_reference_impl_updated_at
  ON public.discipline_subtype_reference_impl;

CREATE TRIGGER trg_discipline_subtype_reference_impl_updated_at
BEFORE UPDATE ON public.discipline_subtype_reference_impl
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

COMMENT ON TABLE public.discipline_subtype_reference_impl IS
'Canonical reference implementations per discipline subtype. Provides baseline intent, "what right looks like", descriptive branching, and OFC trigger notes.';

COMMENT ON COLUMN public.discipline_subtype_reference_impl.reference_impl IS
'JSONB payload containing sections: section1 (baseline existence question), section2 (what right looks like), section3 (descriptive branching YES-only), section4 (OFC trigger notes non-user-facing).';

COMMIT;
