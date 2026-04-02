-- Module VOFC Setup Verification Queries
-- 
-- PREREQUISITES:
-- 1. Run migration: db/migrations/runtime/20260126_1200_module_vofc_library.sql (in RUNTIME)
-- 2. Run migration: db/migrations/corpus/20260126_add_unique_constraint_doc_sha256.sql (in CORPUS, if source_registry is there)
--
-- Use diagnose_table_locations.py to check where tables exist:
--   python tools/module_seed/diagnose_table_locations.py

-- ============================================================================
-- SECTION A: RUNTIME Database Queries
-- ============================================================================
-- Run these in RUNTIME database

-- A1. Verify module_ofc_library table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'module_ofc_library';

-- A2. Verify module_ofc_citations table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'module_ofc_citations';

-- A3. VOFC count per module
SELECT module_code, COUNT(*) 
FROM public.module_ofc_library
GROUP BY module_code
ORDER BY COUNT(*) DESC;

-- A4. Citations wired
SELECT m.module_code, COUNT(c.id) AS citation_count
FROM public.module_ofc_library m
JOIN public.module_ofc_citations c ON c.module_ofc_id = m.id
WHERE m.module_code = 'MODULE_VEHICLE_RAMMING_SAT'
GROUP BY m.module_code;

-- A5. Check if source_registry exists in RUNTIME
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'source_registry'
) AS source_registry_in_runtime;

-- ============================================================================
-- SECTION B: CORPUS Database Queries (if source_registry is in CORPUS)
-- ============================================================================
-- Run these in CORPUS database (only if source_registry is there)

-- B1. Verify UNIQUE constraint on source_registry.doc_sha256
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname='public'
  AND tablename='source_registry'
  AND indexdef ILIKE '%doc_sha256%';

-- Expected: A unique index/constraint including doc_sha256
-- If not present, apply migration: db/migrations/corpus/20260126_add_unique_constraint_doc_sha256.sql

-- B2. Verify XLSX source registry entry
SELECT id, source_key, source_type, title, local_path, doc_sha256, scope_tags
FROM public.source_registry
WHERE scope_tags @> '{"source_type":"XLSX","module_code":"MODULE_VEHICLE_RAMMING_SAT"}'::jsonb
ORDER BY created_at DESC
LIMIT 5;

-- B3. Verify Triage Module Tagging
SELECT COUNT(*)
FROM public.source_registry
WHERE scope_tags @> '{"tags":{"module":"MODULE_VEHICLE_RAMMING_SAT"}}'::jsonb;

-- B4. Verify Untraceables Backfill
SELECT
  SUM(CASE WHEN source_registry_id IS NULL THEN 1 ELSE 0 END) AS untraceable,
  SUM(CASE WHEN source_registry_id IS NOT NULL THEN 1 ELSE 0 END) AS traceable
FROM public.corpus_documents;
