-- ================================================================================
-- RUNTIME Database Cleanup - Remove Duplicate Tables
-- Generated: 2026-01-28T03:56:43.305Z
-- ⚠️  RUN ONLY ON RUNTIME DATABASE ⚠️
-- ================================================================================

-- DROP tables that should be in CORPUS only:
DROP TABLE IF EXISTS public.module_chunk_links CASCADE;