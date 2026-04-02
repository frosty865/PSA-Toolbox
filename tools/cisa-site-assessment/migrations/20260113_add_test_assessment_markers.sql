-- Add test assessment markers and indexes
-- Enables first-class test assessment identification and safe purging
-- Date: 2025-01-13

-- ============================================================================
-- 1) Add test marker columns
-- ============================================================================

-- Add test_run_id for grouping test assessments by run/batch
ALTER TABLE public.assessments
ADD COLUMN IF NOT EXISTS test_run_id TEXT NULL;

-- Add test_purpose for documenting why the test was created
ALTER TABLE public.assessments
ADD COLUMN IF NOT EXISTS test_purpose TEXT NULL;

-- Add comments
COMMENT ON COLUMN public.assessments.test_run_id IS 
'Optional identifier for grouping test assessments by run/batch. When set, assessment is considered a test.';

COMMENT ON COLUMN public.assessments.test_purpose IS 
'Optional short description of why this test assessment was created (e.g., "OFC regeneration validation", "Gate ordering test").';

-- ============================================================================
-- 2) Create indexes for efficient filtering
-- ============================================================================

-- Index for qa_flag (if not already exists, update to include test_run_id)
DROP INDEX IF EXISTS idx_assessments_qa_flag;
CREATE INDEX idx_assessments_qa_flag 
ON public.assessments(qa_flag) 
WHERE qa_flag = false;

-- Index for test_run_id
CREATE INDEX IF NOT EXISTS idx_assessments_test_run_id 
ON public.assessments(test_run_id) 
WHERE test_run_id IS NOT NULL;

-- Composite index for production queries (qa_flag=false AND test_run_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_assessments_production 
ON public.assessments(qa_flag, test_run_id) 
WHERE qa_flag = false AND test_run_id IS NULL;

-- ============================================================================
-- 3) Create purge audit log table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.test_assessment_purge_log (
  purge_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purged_at timestamptz NOT NULL DEFAULT now(),
  purged_by TEXT NULL,  -- User/actor identifier if available
  mode TEXT NOT NULL CHECK (mode IN ('DRY_RUN', 'EXECUTE')),
  filters_applied JSONB NOT NULL,  -- Store filter criteria used
  counts JSONB NOT NULL,  -- Store counts of deleted rows
  assessment_ids_deleted uuid[] NULL,  -- Array of deleted assessment IDs (for audit trail)
  notes TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_purge_log_purged_at 
ON public.test_assessment_purge_log(purged_at DESC);

COMMENT ON TABLE public.test_assessment_purge_log IS 
'Audit log for test assessment purges. Records all purge operations (including dry runs) for compliance and debugging.';

-- ============================================================================
-- 4) Update existing test assessments
-- ============================================================================

-- Mark existing [QA] prefixed assessments as tests (if qa_flag not already set)
UPDATE public.assessments
SET qa_flag = true
WHERE (facility_name LIKE '[QA]%' OR facility_name LIKE '%QA%')
  AND (qa_flag IS NULL OR qa_flag = false);

