-- ================================================================================
-- CORPUS Database Cleanup - Remove Duplicate Tables
-- Generated: 2026-01-28T03:56:43.304Z
-- ⚠️  RUN ONLY ON CORPUS DATABASE ⚠️
-- ================================================================================

-- DROP tables that should be in RUNTIME only:
DROP TABLE IF EXISTS public.assessment_module_instances CASCADE;