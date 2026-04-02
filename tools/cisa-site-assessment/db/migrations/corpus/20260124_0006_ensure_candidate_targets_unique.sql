BEGIN;

-- Ensure unique constraint exists for (candidate_id, target_key) for baseline questions
-- This prevents duplicate links when match_mode is always 'UNIVERSAL' for baseline
-- Note: The primary key already includes (candidate_id, target_type, target_key, match_mode)
-- but we want to ensure no duplicates for same candidate+question regardless of match_mode

-- Check if a simpler unique constraint exists (candidate_id, target_key) for BASE_PRIMARY
-- If not, we rely on the existing PK constraint which is sufficient

-- Add index for faster lookups by target_key (question_canon_id)
CREATE INDEX IF NOT EXISTS idx_ofc_candidate_targets_target_key_baseline
  ON public.ofc_candidate_targets (target_key)
  WHERE target_type = 'BASE_PRIMARY';

COMMENT ON INDEX idx_ofc_candidate_targets_target_key_baseline IS
'Index for fast lookup of candidates by baseline question canon_id';

COMMIT;
