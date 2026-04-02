-- Verify OFC data has been wiped
SELECT 
    'ofc_nominations' as table_name,
    COUNT(*) as row_count
FROM public.ofc_nominations
UNION ALL
SELECT 
    'canonical_ofcs' as table_name,
    COUNT(*) as row_count
FROM public.canonical_ofcs
UNION ALL
SELECT 
    'canonical_ofc_citations' as table_name,
    COUNT(*) as row_count
FROM public.canonical_ofc_citations
UNION ALL
SELECT 
    'ofc_nomination_decisions' as table_name,
    COUNT(*) as row_count
FROM public.ofc_nomination_decisions;

