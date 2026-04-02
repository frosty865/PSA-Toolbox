-- STEP 5: Example normalization operations

-- Create a new vulnerability
INSERT INTO public.normalized_vulnerabilities (
    discipline,
    discipline_subtype,
    canonical_title,
    canonical_description
) VALUES (
    'Video Surveillance Systems',
    'Camera Coverage',
    'Incomplete camera coverage of critical approach areas',
    'Cameras do not provide full visual coverage of all critical approach areas, creating blind spots that limit detection and assessment.'
);

-- Link multiple source statements as evidence
-- (Replace <statement_uuid_1>, <statement_uuid_2>, <vulnerability_uuid> with actual UUIDs)
-- INSERT INTO public.normalized_evidence_links (
--     source_statement_id,
--     vulnerability_id
-- ) VALUES
--     ('<statement_uuid_1>', '<vulnerability_uuid>'),
--     ('<statement_uuid_2>', '<vulnerability_uuid>');

-- Create a new OFC
INSERT INTO public.normalized_ofcs (
    discipline,
    discipline_subtype,
    canonical_text
) VALUES (
    'Access Control',
    'Card Reader Systems',
    'Card readers must be installed at all exterior entry points and configured to log all access attempts.'
);

-- Link source statement to OFC
-- INSERT INTO public.normalized_evidence_links (
--     source_statement_id,
--     ofc_id
-- ) VALUES
--     ('<statement_uuid>', '<ofc_uuid>');

-- Approve a normalized vulnerability
-- UPDATE public.normalized_vulnerabilities
-- SET status = 'approved', updated_at = now()
-- WHERE id = '<vulnerability_uuid>';

-- Deprecate a normalized record (keeps for historical traceability)
-- UPDATE public.normalized_vulnerabilities
-- SET status = 'deprecated', updated_at = now()
-- WHERE id = '<vulnerability_uuid>';

-- Query normalization queue
-- SELECT * FROM public.v_normalization_queue;

-- Query normalized summary
-- SELECT * FROM public.v_normalized_summary;

