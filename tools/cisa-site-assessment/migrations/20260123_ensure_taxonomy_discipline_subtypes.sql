-- 20260123_ensure_taxonomy_discipline_subtypes.sql
-- Purpose: Ensure public.discipline_subtypes exists in the CORPUS database.
-- Strategy:
--   - If a canonical/runtime taxonomy table already exists, create a VIEW named public.discipline_subtypes.
--   - If nothing exists, create a minimal public.discipline_subtypes table (seed required).
--
-- TARGET DB: CORPUS

BEGIN;

-- Try to find an existing taxonomy source we can map from.
-- Common candidates (adjust if your environment uses different names):
--   - public.discipline_subtypes_runtime
--   - public.taxonomy_discipline_subtypes
--   - public.canonical_discipline_subtypes
--   - public.discipline_subtypes (target)
DO $$
DECLARE
  src regclass;
BEGIN
  -- If target already exists, do nothing.
  IF to_regclass('public.discipline_subtypes') IS NOT NULL THEN
    RAISE NOTICE 'public.discipline_subtypes already exists';
    RETURN;
  END IF;

  -- Probe for likely existing source tables/views.
  src := to_regclass('public.discipline_subtypes_runtime');
  IF src IS NULL THEN src := to_regclass('public.taxonomy_discipline_subtypes'); END IF;
  IF src IS NULL THEN src := to_regclass('public.canonical_discipline_subtypes'); END IF;

  IF src IS NOT NULL THEN
    RAISE NOTICE 'Creating VIEW public.discipline_subtypes over %', src;
    EXECUTE format($v$
      CREATE VIEW public.discipline_subtypes AS
      SELECT
        id,
        discipline_id,
        name,
        description,
        code,
        is_active,
        created_at,
        updated_at
      FROM %s
    $v$, src);
    RETURN;
  END IF;

  -- No source found: create a minimal table to unblock API.
  RAISE NOTICE 'No taxonomy source table found. Creating minimal public.discipline_subtypes table (requires seeding).';

  EXECUTE $t$
    CREATE TABLE public.discipline_subtypes (
      id uuid PRIMARY KEY,
      discipline_id uuid NOT NULL,
      name text NOT NULL,
      description text NULL,
      code text NULL,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  $t$;

  -- Helpful index
  EXECUTE $i$
    CREATE INDEX discipline_subtypes_discipline_id_idx
    ON public.discipline_subtypes (discipline_id)
  $i$;

END $$;

COMMIT;
