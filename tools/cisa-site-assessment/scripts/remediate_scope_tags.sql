-- Structural cleanup of source_registry.scope_tags (CORPUS).
-- Removes: strings, objects without type/code, objects with type not in ('sector','subsector','module').
-- Does NOT validate against taxonomy (run remediate_scope_tags.ts for taxonomy-aware cleanup).

UPDATE public.source_registry sr
SET
  scope_tags = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements(sr.scope_tags) AS elem
    WHERE jsonb_typeof(elem) = 'object'
      AND elem ? 'type'
      AND elem ? 'code'
      AND elem->>'type' IN ('sector', 'subsector', 'module')
      AND trim(COALESCE(elem->>'code', '')) <> ''
  ),
  updated_at = now()
WHERE jsonb_typeof(sr.scope_tags) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(sr.scope_tags) AS e
    WHERE jsonb_typeof(e) != 'object'
       OR NOT (e ? 'type' AND e ? 'code')
       OR e->>'type' NOT IN ('sector', 'subsector', 'module')
       OR trim(COALESCE(e->>'code', '')) = ''
  );
