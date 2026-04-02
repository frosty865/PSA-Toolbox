-- STEP 4: Verification queries

-- Count by verification_relevance
SELECT verification_relevance, COUNT(*) 
FROM public.source_statements 
GROUP BY verification_relevance;

-- Count in final review view
SELECT COUNT(*) 
FROM public.v_unreviewed_statements;

-- Detailed breakdown
SELECT 
    verification_relevance,
    review_status,
    COUNT(*) as count
FROM public.source_statements
GROUP BY verification_relevance, review_status
ORDER BY verification_relevance, review_status;

-- Unreviewed breakdown by verification_relevance
SELECT 
    verification_relevance,
    COUNT(*) as count
FROM public.source_statements
WHERE review_status = 'unreviewed'
GROUP BY verification_relevance;

