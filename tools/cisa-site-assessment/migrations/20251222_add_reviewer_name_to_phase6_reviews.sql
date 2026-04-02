-- Add reviewer_name column to phase6_reviews table
-- Required for engineering-only review gate audit trail

-- Add reviewer_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'phase6_reviews' 
        AND column_name = 'reviewer_name'
    ) THEN
        ALTER TABLE public.phase6_reviews 
        ADD COLUMN reviewer_name TEXT;
        
        COMMENT ON COLUMN public.phase6_reviews.reviewer_name IS 'Name of the reviewer (required for audit trail)';
    END IF;
END $$;

-- Update constraint to require reviewer_name for APPROVE_ALIGNMENT
ALTER TABLE public.phase6_reviews
DROP CONSTRAINT IF EXISTS phase6_reviews_review_decision_check;

ALTER TABLE public.phase6_reviews
ADD CONSTRAINT phase6_reviews_review_decision_check CHECK (
    (review_decision = 'APPROVE_ALIGNMENT' AND approved_discipline IS NOT NULL AND approved_subtype IS NOT NULL AND review_notes IS NOT NULL AND reviewer_name IS NOT NULL) OR
    (review_decision = 'REJECT_AS_NON_ACTIONABLE' AND review_notes IS NOT NULL) OR
    (review_decision = 'SPLIT_REQUIRED')
);

-- Update reviewer_role constraint to ENGINEER only (temporary gate)
ALTER TABLE public.phase6_reviews
DROP CONSTRAINT IF EXISTS phase6_reviews_reviewer_role_check;

ALTER TABLE public.phase6_reviews
ADD CONSTRAINT phase6_reviews_reviewer_role_check CHECK (
    reviewer_role = 'ENGINEER'
);

COMMENT ON COLUMN public.phase6_reviews.reviewer_role IS 'ENGINEER role required (engineering-only review gate active)';

