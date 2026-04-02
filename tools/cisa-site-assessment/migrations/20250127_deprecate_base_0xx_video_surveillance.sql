-- Migration: Deprecate legacy BASE-0xx required elements for Video Surveillance Systems
-- Purpose: Mark BASE-061 through BASE-071 as deprecated (component existence elements)
-- Date: 2025-01-27
--
-- These elements represent component existence and are superseded by:
-- - Baseline Questions v1 (existence/governance-based)
-- - Component Capability Layer
-- - Phase 2.5 evidence-backed OFCs

-- Deprecate BASE-061 through BASE-071 for Video Surveillance Systems discipline
-- Note: Adjust discipline_id and discipline_name filter based on your actual database values

UPDATE required_elements
SET 
    status = 'deprecated',
    deprecated_at = CURRENT_TIMESTAMP,
    deprecated_reason = 'Superseded by Baseline Questions v1 and Component Capability Layer. Legacy component existence elements replaced by evidence-backed assessment model.'
WHERE 
    element_code IN ('BASE-061', 'BASE-062', 'BASE-063', 'BASE-064', 'BASE-065', 'BASE-066', 'BASE-070', 'BASE-071')
    AND discipline_name = 'Video Surveillance Systems'
    AND status = 'active';  -- Only update if currently active

-- Log the deprecation
DO $$
DECLARE
    deprecated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO deprecated_count
    FROM required_elements
    WHERE element_code IN ('BASE-061', 'BASE-062', 'BASE-063', 'BASE-064', 'BASE-065', 'BASE-066', 'BASE-070', 'BASE-071')
      AND status = 'deprecated';
    
    RAISE NOTICE 'Deprecated % required elements (BASE-061 through BASE-071 for Video Surveillance Systems)', deprecated_count;
END $$;

