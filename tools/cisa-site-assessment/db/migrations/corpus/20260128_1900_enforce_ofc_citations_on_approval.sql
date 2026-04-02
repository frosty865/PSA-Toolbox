-- CORPUS: Block setting standard to APPROVED if any OFC template lacks citations.
-- Run after 20260128_1800_module_standard_citations.sql

BEGIN;

-- Helper: returns (criterion_key, template_key) pairs missing citations for a standard
CREATE OR REPLACE FUNCTION public._missing_ofc_citations(p_standard_id uuid)
RETURNS TABLE(criterion_key text, template_key text) LANGUAGE sql STABLE AS $$
  SELECT c.criterion_key, t.template_key
  FROM public.module_standard_criterion_ofc_templates t
  JOIN public.module_standard_criteria c ON c.id = t.criterion_id
  WHERE c.standard_id = p_standard_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.module_standard_citations cit
    WHERE cit.standard_id = c.standard_id
      AND cit.criterion_key = c.criterion_key
      AND cit.template_key = t.template_key
  )
  ORDER BY c.criterion_key, t.template_key;
$$;

-- Trigger: block status change to APPROVED if any OFC lacks citations
CREATE OR REPLACE FUNCTION public.trg_block_approve_without_ofc_citations()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  missing text;
BEGIN
  IF NEW.status = 'APPROVED' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT string_agg(m.criterion_key || ':' || m.template_key, ', ' ORDER BY m.criterion_key, m.template_key)
    INTO missing
    FROM public._missing_ofc_citations(NEW.id) m;

    IF missing IS NOT NULL THEN
      RAISE EXCEPTION
        'Cannot set standard % to APPROVED. OFC templates missing citations: %',
        NEW.standard_key, missing;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_approve_without_ofc_citations ON public.module_standards;

CREATE TRIGGER block_approve_without_ofc_citations
BEFORE UPDATE OF status ON public.module_standards
FOR EACH ROW
EXECUTE FUNCTION public.trg_block_approve_without_ofc_citations();

COMMIT;
