-- How many vulnerabilities exist?
SELECT COUNT(*) as total_vulnerabilities
FROM public.normalized_vulnerabilities;

-- How many statements rejected?
SELECT COUNT(*) as total_rejected
FROM public.source_statements 
WHERE review_status = 'rejected';

-- Any vulnerabilities without evidence? (must be zero)
SELECT COUNT(*) as vulnerabilities_without_evidence
FROM public.normalized_vulnerabilities v
LEFT JOIN public.normalized_evidence_links l
  ON v.id = l.vulnerability_id
WHERE l.id IS NULL;

-- Breakdown by status
SELECT status, COUNT(*) as count
FROM public.normalized_vulnerabilities
GROUP BY status
ORDER BY status;

-- Breakdown by discipline
SELECT discipline, COUNT(*) as count
FROM public.normalized_vulnerabilities
GROUP BY discipline
ORDER BY count DESC;

-- Statements linked to vulnerabilities
SELECT COUNT(DISTINCT source_statement_id) as statements_linked
FROM public.normalized_evidence_links
WHERE vulnerability_id IS NOT NULL;

