-- Update all review and normalization views to exclude rejected statements

DROP VIEW IF EXISTS public.v_unreviewed_statements CASCADE;

CREATE VIEW public.v_unreviewed_statements AS
SELECT 
    ss.id AS statement_id,
    ss.document_id,
    ss.document_filename,
    ss.source_path,
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
    ss.verification_relevance,
    ss.deficiency_flag
FROM public.source_statements ss
INNER JOIN public.source_documents sd ON ss.document_id = sd.id
WHERE ss.review_status = 'unreviewed'
  AND ss.assertion_class = 'candidate'
  AND ss.verification_relevance = 'verifiable'
  AND ss.deficiency_flag = TRUE
  AND sd.corpus_scope = 'primary'
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

DROP VIEW IF EXISTS public.v_normalization_queue CASCADE;

CREATE VIEW public.v_normalization_queue AS
SELECT 
    ss.id AS statement_id,
    ss.raw_text,
    ss.document_filename,
    ss.page_ref,
    ss.assigned_discipline,
    ss.assigned_subtype
FROM public.source_statements ss
INNER JOIN public.source_documents sd ON ss.document_id = sd.id
WHERE ss.review_status = 'approved'
  AND ss.deficiency_flag = TRUE
  AND sd.corpus_scope = 'primary'
  AND NOT EXISTS (
      SELECT 1
      FROM public.normalized_evidence_links nel
      WHERE nel.source_statement_id = ss.id
  );

