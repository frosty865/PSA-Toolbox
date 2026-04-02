-- Add qa_flag column to assessments table for QA exclusion
-- This allows durable exclusion of QA validation assessments from production views

-- Add column with default false (all existing assessments are production)
ALTER TABLE public.assessments
ADD COLUMN IF NOT EXISTS qa_flag boolean NOT NULL DEFAULT false;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_assessments_qa_flag 
ON public.assessments(qa_flag) 
WHERE qa_flag = false;

-- Add comment
COMMENT ON COLUMN public.assessments.qa_flag IS 
'Flag to mark QA validation assessments. When true, assessment should be excluded from production UI, exports, and scoring.';

-- Update existing QA assessments (those with [QA] prefix in name)
UPDATE public.assessments
SET qa_flag = true
WHERE facility_name LIKE '[QA]%' OR facility_name LIKE '%QA%';

