-- Phase 6 Review Table
-- Stores human review decisions for quarantined chunks from Phase 4

CREATE TABLE IF NOT EXISTS public.phase6_reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Chunk identification
    chunk_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    page_number INTEGER,
    page_numbers INTEGER[],  -- Array for multi-page chunks
    excerpt_text TEXT NOT NULL,
    source_citation TEXT,
    
    -- Phase 4 quarantine data
    candidate_matches JSONB,  -- Array of candidate matches with scores
    quarantine_reason TEXT NOT NULL,
    
    -- Review decision
    reviewer_id UUID,  -- User ID who reviewed
    reviewer_role TEXT NOT NULL
        CHECK (reviewer_role IN ('ENGINEER', 'GOVERNANCE')),
    review_decision TEXT NOT NULL
        CHECK (review_decision IN ('APPROVE_ALIGNMENT', 'REJECT_AS_NON_ACTIONABLE', 'SPLIT_REQUIRED')),
    
    -- Approved alignment (nullable, required if APPROVE_ALIGNMENT)
    approved_discipline TEXT,
    approved_subtype TEXT,
    
    -- Review notes (required for APPROVE or REJECT)
    review_notes TEXT,
    
    -- Timestamps
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    CHECK (
        (review_decision = 'APPROVE_ALIGNMENT' AND approved_discipline IS NOT NULL AND approved_subtype IS NOT NULL AND review_notes IS NOT NULL) OR
        (review_decision = 'REJECT_AS_NON_ACTIONABLE' AND review_notes IS NOT NULL) OR
        (review_decision = 'SPLIT_REQUIRED')
    ),
    CHECK (
        (review_decision = 'APPROVE_ALIGNMENT' AND reviewer_id IS NOT NULL) OR
        (review_decision != 'APPROVE_ALIGNMENT')
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_phase6_reviews_chunk_id ON public.phase6_reviews(chunk_id);
CREATE INDEX IF NOT EXISTS idx_phase6_reviews_document_id ON public.phase6_reviews(document_id);
CREATE INDEX IF NOT EXISTS idx_phase6_reviews_reviewer_id ON public.phase6_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_phase6_reviews_review_decision ON public.phase6_reviews(review_decision);
CREATE INDEX IF NOT EXISTS idx_phase6_reviews_reviewed_at ON public.phase6_reviews(reviewed_at DESC);

-- Unique constraint: one review per chunk (immutable once submitted)
CREATE UNIQUE INDEX IF NOT EXISTS idx_phase6_reviews_chunk_id_unique ON public.phase6_reviews(chunk_id);

-- Comments
COMMENT ON TABLE public.phase6_reviews IS 'Phase 6 human review decisions for quarantined chunks from Phase 4';
COMMENT ON COLUMN public.phase6_reviews.review_decision IS 'APPROVE_ALIGNMENT: chunk moves to VALIDATED. REJECT_AS_NON_ACTIONABLE: permanently excluded. SPLIT_REQUIRED: flagged for future chunk-splitting';
COMMENT ON COLUMN public.phase6_reviews.reviewer_role IS 'ENGINEER or GOVERNANCE role required to submit reviews';
COMMENT ON COLUMN public.phase6_reviews.candidate_matches IS 'JSONB array of candidate matches from Phase 4 with scores';

