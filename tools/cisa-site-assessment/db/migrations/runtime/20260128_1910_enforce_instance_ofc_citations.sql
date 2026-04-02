-- RUNTIME: Enforce every module_instance_ofc has >=1 citation (deferred trigger).
-- Run after 20260128_1805_module_instance_citations.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.trg_enforce_instance_ofc_citations()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(o.criterion_key || ':' || o.template_key, ', ' ORDER BY o.criterion_key, o.template_key)
  INTO missing
  FROM public.module_instance_ofcs o
  WHERE o.module_instance_id = NEW.module_instance_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.module_instance_citations c
      WHERE c.module_instance_id = o.module_instance_id
        AND c.criterion_key = o.criterion_key
        AND c.template_key = o.template_key
    );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'Instance % has OFCs missing citations: %',
      NEW.module_instance_id, missing;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS enforce_instance_ofc_citations ON public.module_instance_ofcs;

CREATE CONSTRAINT TRIGGER enforce_instance_ofc_citations
AFTER INSERT OR UPDATE ON public.module_instance_ofcs
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.trg_enforce_instance_ofc_citations();

COMMIT;
