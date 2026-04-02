-- Migration: Add deprecation metadata to required_elements table
-- Purpose: Support deprecation of legacy baseline required elements (BASE-0xx)
-- Date: 2025-01-27
--
-- IMPORTANT: This migration is for the psa_engine backend database.
-- The psa_rebuild frontend uses file-based required elements (JSON), not database tables.
--
-- Step 1: Add deprecation columns to required_elements table
-- Note: This assumes the table exists in the psa_engine database.

-- Check if table exists before attempting to alter
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'required_elements'
    ) THEN
        -- Table exists, proceed with migration
        ALTER TABLE required_elements
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deprecated_reason TEXT;

-- Create index for efficient filtering of active elements
CREATE INDEX IF NOT EXISTS idx_required_elements_status ON required_elements(status);
CREATE INDEX IF NOT EXISTS idx_required_elements_code_status ON required_elements(element_code, status);

        -- Add comment to document the deprecation fields
        COMMENT ON COLUMN required_elements.status IS 'Element status: active (default) or deprecated. Deprecated elements are excluded from OFC generation and baseline views.';
        COMMENT ON COLUMN required_elements.deprecated_at IS 'Timestamp when the element was deprecated. NULL for active elements.';
        COMMENT ON COLUMN required_elements.deprecated_reason IS 'Reason for deprecation. Typically explains what replaced the deprecated element.';
    ELSE
        RAISE NOTICE 'Table required_elements does not exist. This migration is for psa_engine backend database.';
        RAISE NOTICE 'If you are in psa_rebuild, required elements are file-based (JSON) and do not need database migrations.';
    END IF;
END $$;

