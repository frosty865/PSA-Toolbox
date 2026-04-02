SELECT deficiency_flag, COUNT(*) 
FROM public.source_statements 
GROUP BY deficiency_flag;

SELECT COUNT(*) 
FROM public.v_unreviewed_statements;

SELECT 
    deficiency_flag,
    verification_relevance,
    COUNT(*) as count
FROM public.source_statements
WHERE review_status = 'unreviewed'
GROUP BY deficiency_flag, verification_relevance
ORDER BY deficiency_flag, verification_relevance;

SELECT 
    deficiency_flag,
    COUNT(*) as count
FROM public.source_statements
WHERE review_status = 'unreviewed'
  AND verification_relevance = 'verifiable'
GROUP BY deficiency_flag;

