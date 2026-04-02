-- Migration: Update baseline views to exclude deprecated required elements
-- Purpose: Ensure all baseline reporting excludes deprecated BASE-0xx elements
-- Date: 2025-01-27
--
-- This migration updates baseline views to explicitly exclude deprecated elements.
-- Apply this after the deprecation migration has been run.

-- Example: Update baseline vulnerability view
-- Adjust view name and structure based on your actual schema

-- DROP VIEW IF EXISTS v_baseline_vulnerabilities CASCADE;
-- CREATE VIEW v_baseline_vulnerabilities AS
-- SELECT 
--     re.element_id,
--     re.element_code,
--     re.title,
--     re.question_text,
--     re.discipline_name,
--     COUNT(DISTINCT a.assessment_id) as assessment_count
-- FROM required_elements re
-- LEFT JOIN assessment_responses ar ON re.element_id = ar.required_element_id
-- LEFT JOIN assessments a ON ar.assessment_id = a.assessment_id
-- WHERE re.layer = 'baseline'
--   AND re.status = 'active'  -- EXCLUDE DEPRECATED
--   AND ar.response = 'NO'    -- Only vulnerabilities (NO responses)
-- GROUP BY re.element_id, re.element_code, re.title, re.question_text, re.discipline_name;

-- Example: Update baseline OFC summary view
-- DROP VIEW IF EXISTS v_baseline_ofc_summary CASCADE;
-- CREATE VIEW v_baseline_ofc_summary AS
-- SELECT 
--     re.element_code,
--     re.title,
--     COUNT(DISTINCT o.ofc_id) as ofc_count
-- FROM required_elements re
-- INNER JOIN ofcs o ON re.element_id = o.required_element_id
-- WHERE re.layer = 'baseline'
--   AND re.status = 'active'  -- EXCLUDE DEPRECATED
-- GROUP BY re.element_code, re.title;

-- Note: Adjust these examples to match your actual database schema.
-- The key requirement is:
--   WHERE ... AND re.status = 'active'
--
-- This ensures deprecated elements are excluded from all baseline reporting.

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Baseline views should be updated to exclude deprecated elements (status != ''active'')';
    RAISE NOTICE 'Review and update your baseline views manually to match your schema';
END $$;

