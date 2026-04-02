-- Verify ofc_origin migration status
-- Run this AFTER running 20260124_0007_lock_ofc_origin_on_candidates.sql

-- 1. Check column exists and constraints
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ofc_candidate_queue'
  AND column_name = 'ofc_origin';

-- 2. Check CHECK constraint
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.ofc_candidate_queue'::regclass
  AND conname = 'chk_ofc_candidate_queue_ofc_origin';

-- 3. Check indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'ofc_candidate_queue'
  AND indexname LIKE '%ofc_origin%'
ORDER BY indexname;

-- 4. Check data distribution
SELECT 
    ofc_origin,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM public.ofc_candidate_queue
GROUP BY ofc_origin
ORDER BY ofc_origin;

-- 5. Check for NULL values (should be 0 after migration)
SELECT 
    COUNT(*) as null_count
FROM public.ofc_candidate_queue
WHERE ofc_origin IS NULL;

-- 6. Check for invalid values (should be 0 after migration)
SELECT 
    COUNT(*) as invalid_count
FROM public.ofc_candidate_queue
WHERE ofc_origin NOT IN ('CORPUS', 'MODULE');

-- Summary
SELECT 
    'Migration Status' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'ofc_candidate_queue'
              AND column_name = 'ofc_origin'
              AND is_nullable = 'NO'
        ) AND EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'public.ofc_candidate_queue'::regclass
              AND conname = 'chk_ofc_candidate_queue_ofc_origin'
        ) AND NOT EXISTS (
            SELECT 1 FROM public.ofc_candidate_queue
            WHERE ofc_origin IS NULL OR ofc_origin NOT IN ('CORPUS', 'MODULE')
        )
        THEN '✅ COMPLETE - All constraints in place, data is clean'
        ELSE '❌ INCOMPLETE - Run migration 20260124_0007_lock_ofc_origin_on_candidates.sql'
    END as status;
