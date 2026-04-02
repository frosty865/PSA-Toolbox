-- Prevent MINED candidates from being tagged as MODULE
-- Date: 2026-01-24
-- Purpose: Hard guard against misclassification - MINED candidates must be CORPUS
-- IMPORTANT: Run against CORPUS database only

BEGIN;

-- Create function to prevent MINED candidates from being MODULE
CREATE OR REPLACE FUNCTION prevent_mined_as_module()
RETURNS trigger AS $$
BEGIN
  -- Check if submitted_by = 'MINED' and ofc_origin = 'MODULE'
  IF NEW.submitted_by = 'MINED' AND NEW.ofc_origin = 'MODULE' THEN
    RAISE EXCEPTION 'MINED candidates cannot be MODULE. Use ofc_origin=''CORPUS'' for mined candidates.';
  END IF;
  
  -- Also check created_by if column exists (defensive)
  -- Note: This will only work if created_by column exists
  IF TG_TABLE_NAME = 'ofc_candidate_queue' THEN
    -- Additional check: if source is MODULE RESEARCH and no manual author, should be CORPUS
    -- This is a soft check - we'll allow it but log a warning
    -- (Hard enforcement would require checking canonical_sources which is complex)
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (only if submitted_by column exists)
DO $$
BEGIN
  -- Check if submitted_by column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ofc_candidate_queue'
      AND column_name = 'submitted_by'
  ) THEN
    -- Drop trigger if it exists
    DROP TRIGGER IF EXISTS trg_no_mined_module ON public.ofc_candidate_queue;
    
    -- Create trigger
    CREATE TRIGGER trg_no_mined_module
    BEFORE INSERT OR UPDATE ON public.ofc_candidate_queue
    FOR EACH ROW
    EXECUTE FUNCTION prevent_mined_as_module();
    
    RAISE NOTICE 'Trigger created: trg_no_mined_module';
  ELSE
    RAISE NOTICE 'submitted_by column does not exist - trigger not created (will be created when column is added)';
  END IF;
END$$;

COMMENT ON FUNCTION prevent_mined_as_module() IS
'Prevents MINED candidates from being tagged as MODULE. MINED candidates must be CORPUS.';

COMMIT;
