-- STEP 1: Add verification_relevance column
ALTER TABLE public.source_statements
ADD COLUMN IF NOT EXISTS verification_relevance TEXT DEFAULT 'verifiable';

-- Add CHECK constraint (if it doesn't exist)
ALTER TABLE public.source_statements
DROP CONSTRAINT IF EXISTS source_statements_verification_relevance_check;

ALTER TABLE public.source_statements
ADD CONSTRAINT source_statements_verification_relevance_check
CHECK (verification_relevance IN ('verifiable','context'));

-- STEP 3: Update review view to require verification_relevance = 'verifiable'
-- Note: This assumes assertion_class column exists. If not, remove that condition.
CREATE OR REPLACE VIEW public.v_unreviewed_statements AS
SELECT 
    ss.id,
    ss.document_id,
    ss.page_ref,
    ss.raw_text,
    ss.source_excerpt,
    ss.source_citation,
    ss.review_status,
    ss.disposition_type,
    ss.assigned_discipline,
    ss.assigned_subtype,
    ss.reviewer_notes,
    ss.reviewed_at,
    ss.verification_relevance
FROM public.source_statements ss
WHERE ss.review_status = 'unreviewed'
  AND ss.assertion_class = 'candidate'
  AND ss.verification_relevance = 'verifiable'
  AND (ss.assigned_discipline IS NULL 
       OR ss.assigned_discipline IN (
           'Access Control',
           'Video Surveillance',
           'Intrusion Detection',
           'Perimeter Security',
           'Physical Barriers',
           'Security Lighting',
           'Security Communications',
           'Security Monitoring',
           'Security Operations',
           'Security Personnel',
           'Security Systems Integration',
           'Visitor Management',
           'Emergency Response',
           'Security Maintenance',
           'Security Testing',
           'Security Documentation',
           'Security Training',
           'Security Policies',
           'Risk Assessment',
           'Security Planning'
       ));

