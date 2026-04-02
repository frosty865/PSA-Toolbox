-- RUNTIME: Enforce unique (section_id, element_key) for plan_schemas_elements; remove duplicates first.

BEGIN;

-- 1) Remove duplicate elements: keep one per (section_id, element_key) with smallest element_ord
DELETE FROM public.plan_schemas_elements a
USING public.plan_schemas_elements b
WHERE a.section_id = b.section_id
  AND a.element_key = b.element_key
  AND a.element_ord > b.element_ord;

-- 2) Add unique index
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uq_plan_schemas_elements_section_key'
  ) THEN
    CREATE UNIQUE INDEX uq_plan_schemas_elements_section_key
      ON public.plan_schemas_elements(section_id, element_key);
  END IF;
END$$;

COMMIT;
