-- CORPUS: Automate placeholder citation when an OFC template is created.
-- Run after 20260128_1800_module_standard_citations.sql.
-- On INSERT into module_standard_criterion_ofc_templates, insert one row into
-- module_standard_citations so every new OFC template has at least one citation.

CREATE OR REPLACE FUNCTION public.trigger_insert_ofc_placeholder_citation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_standard_id UUID;
  v_criterion_key TEXT;
BEGIN
  SELECT c.standard_id, c.criterion_key
  INTO v_standard_id, v_criterion_key
  FROM public.module_standard_criteria c
  WHERE c.id = NEW.criterion_id;

  IF v_standard_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.module_standard_citations (
    standard_id,
    criterion_key,
    template_key,
    source_title,
    locator_type,
    locator_value
  ) VALUES (
    v_standard_id,
    v_criterion_key,
    NEW.template_key,
    'Standard doctrine (placeholder)',
    'other',
    'Doctrine'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_module_standard_ofc_insert_placeholder_citation
  ON public.module_standard_criterion_ofc_templates;

CREATE TRIGGER tr_module_standard_ofc_insert_placeholder_citation
  AFTER INSERT ON public.module_standard_criterion_ofc_templates
  FOR EACH ROW
  EXECUTE PROCEDURE public.trigger_insert_ofc_placeholder_citation();

COMMENT ON FUNCTION public.trigger_insert_ofc_placeholder_citation() IS
  'Inserts one placeholder citation when an OFC template is created so the standard can be approved.';
