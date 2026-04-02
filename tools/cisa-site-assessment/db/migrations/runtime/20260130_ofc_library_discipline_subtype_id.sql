-- RUNTIME: Add discipline_subtype_id to ofc_library for subtype gating
-- Phase 2C: question.discipline_subtype_id === ofc.discipline_subtype_id; no subtype → zero OFCs.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ofc_library' AND column_name = 'discipline_subtype_id'
  ) THEN
    ALTER TABLE public.ofc_library
      ADD COLUMN discipline_subtype_id UUID REFERENCES public.discipline_subtypes(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ofc_library_discipline_subtype_id
  ON public.ofc_library(discipline_subtype_id) WHERE discipline_subtype_id IS NOT NULL;

COMMENT ON COLUMN public.ofc_library.discipline_subtype_id IS
'Subtype gating: only attach OFCs to questions with matching discipline_subtype_id. NULL = legacy; treat as no match.';
