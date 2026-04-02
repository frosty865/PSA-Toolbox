-- STEP 1: Add verification_relevance column
ALTER TABLE public.source_statements
ADD COLUMN IF NOT EXISTS verification_relevance TEXT
CHECK (verification_relevance IN ('verifiable','context'))
DEFAULT 'verifiable';

