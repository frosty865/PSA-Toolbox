-- RUNTIME: PLAN mode checklist groups, items, item-attached OFCs, and roll-up on criteria.
-- Run on RUNTIME database only. Run after 20260128_1805_module_instance_citations.sql.

-- 1A) Parents: module_instance_criteria additions (PLAN capability roll-up)
ALTER TABLE public.module_instance_criteria
  ADD COLUMN IF NOT EXISTS criteria_type text DEFAULT 'STANDARD_CRITERION';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_capability_state') THEN
    CREATE TYPE plan_capability_state AS ENUM ('PRESENT','ABSENT');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_rollup_status') THEN
    CREATE TYPE plan_rollup_status AS ENUM ('COMPLETE','PARTIAL','DEFICIENT','ABSENT');
  END IF;
END$$;

ALTER TABLE public.module_instance_criteria
  ADD COLUMN IF NOT EXISTS capability_state plan_capability_state,
  ADD COLUMN IF NOT EXISTS rollup_status plan_rollup_status,
  ADD COLUMN IF NOT EXISTS checked_count integer,
  ADD COLUMN IF NOT EXISTS applicable_count integer,
  ADD COLUMN IF NOT EXISTS completion_ratio numeric(5,4);

ALTER TABLE public.module_instance_criteria
  DROP CONSTRAINT IF EXISTS mic_plan_parent_state_required;
ALTER TABLE public.module_instance_criteria
  ADD CONSTRAINT mic_plan_parent_state_required
  CHECK (
    criteria_type IS NULL OR criteria_type <> 'PLAN_CAPABILITY'
    OR capability_state IS NOT NULL
  );

COMMENT ON COLUMN public.module_instance_criteria.criteria_type IS 'PLAN_CAPABILITY for plan capabilities; STANDARD_CRITERION for measures/legacy.';
COMMENT ON COLUMN public.module_instance_criteria.capability_state IS 'PLAN only: PRESENT or ABSENT.';
COMMENT ON COLUMN public.module_instance_criteria.rollup_status IS 'PLAN only: COMPLETE|PARTIAL|DEFICIENT|ABSENT.';

-- 1B) Child OFCs: attach to checklist items
ALTER TABLE public.module_instance_ofcs
  ADD COLUMN IF NOT EXISTS checklist_item_id uuid;

CREATE INDEX IF NOT EXISTS idx_mio_checklist_item_id
  ON public.module_instance_ofcs(checklist_item_id);

-- 1C) New groups table (one per criterion for PLAN)
CREATE TABLE IF NOT EXISTS public.module_instance_checklist_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_instance_id uuid NOT NULL REFERENCES public.module_instances(id) ON DELETE CASCADE,
  criterion_id uuid NOT NULL REFERENCES public.module_instance_criteria(id) ON DELETE CASCADE,
  group_key text NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(module_instance_id, criterion_id),
  UNIQUE(module_instance_id, group_key)
);

CREATE INDEX IF NOT EXISTS idx_micg_module_instance_id
  ON public.module_instance_checklist_groups(module_instance_id);

COMMENT ON TABLE public.module_instance_checklist_groups IS 'PLAN mode: one group per capability (criterion).';

-- 1C) New items table
CREATE TABLE IF NOT EXISTS public.module_instance_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_instance_id uuid NOT NULL REFERENCES public.module_instances(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.module_instance_checklist_groups(id) ON DELETE CASCADE,
  order_index integer NOT NULL,
  text text NOT NULL,
  rationale text NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  is_na boolean NOT NULL DEFAULT false,
  derived_unchecked boolean NOT NULL DEFAULT false,
  suppressed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_mici_group_id
  ON public.module_instance_checklist_items(group_id);
CREATE INDEX IF NOT EXISTS idx_mici_module_instance_id
  ON public.module_instance_checklist_items(module_instance_id);

COMMENT ON TABLE public.module_instance_checklist_items IS 'PLAN mode: checklist items under a capability. OFCs attach to unchecked items only.';

-- 1B continued: FK for checklist_item_id (after items table exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'module_instance_ofcs'
    AND constraint_name = 'module_instance_ofcs_checklist_item_id_fkey'
  ) THEN
    ALTER TABLE public.module_instance_ofcs
      ADD CONSTRAINT module_instance_ofcs_checklist_item_id_fkey
      FOREIGN KEY (checklist_item_id) REFERENCES public.module_instance_checklist_items(id) ON DELETE SET NULL;
  END IF;
END$$;

-- 1D) Triggers: prevent OFCs on checked/NA checklist items
CREATE OR REPLACE FUNCTION public.enforce_plan_ofc_item_attachment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  item_checked boolean;
  item_na boolean;
BEGIN
  IF NEW.checklist_item_id IS NOT NULL THEN
    SELECT checked, is_na INTO item_checked, item_na
    FROM public.module_instance_checklist_items
    WHERE id = NEW.checklist_item_id;

    IF item_na IS TRUE THEN
      RAISE EXCEPTION 'Cannot attach OFC to N/A checklist item %', NEW.checklist_item_id;
    END IF;

    IF item_checked IS TRUE THEN
      RAISE EXCEPTION 'Cannot attach OFC to checked checklist item %', NEW.checklist_item_id;
    END IF;
  END IF;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_enforce_plan_ofc_item_attachment ON public.module_instance_ofcs;
CREATE TRIGGER trg_enforce_plan_ofc_item_attachment
BEFORE INSERT OR UPDATE ON public.module_instance_ofcs
FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_ofc_item_attachment();

-- Optional: prevent "What should" criteria text for PLAN_CAPABILITY
CREATE OR REPLACE FUNCTION public.enforce_plan_criteria_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.criteria_type = 'PLAN_CAPABILITY' THEN
    IF NEW.question_text ILIKE 'what should %' THEN
      RAISE EXCEPTION 'PLAN capability criteria may not start with "What should": %', left(NEW.question_text, 80);
    END IF;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_enforce_plan_criteria_text ON public.module_instance_criteria;
CREATE TRIGGER trg_enforce_plan_criteria_text
BEFORE INSERT OR UPDATE ON public.module_instance_criteria
FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_criteria_text();
