-- ================================================================================
-- POST-CLEANUP VERIFICATION (RUN AGAINST BOTH DBS SEPARATELY)
-- Generated: 2026-01-24T15:50:36.320Z
-- ================================================================================

-- CORPUS EXPECTED:
-- ofc_candidate_queue          ✅ exists
-- ofc_candidate_targets        ✅ exists
-- corpus_expansion_questions   ✅ exists
-- ofc_library_citations         ✅ exists
-- disciplines                 ❌ does not exist
-- discipline_subtypes          ❌ does not exist
-- expansion_questions           ❌ does not exist

-- RUNTIME EXPECTED:
-- disciplines                 ✅ exists
-- discipline_subtypes          ✅ exists
-- expansion_questions          ✅ exists
-- assessment_responses         ✅ exists
-- ofc_candidate_queue           ❌ does not exist
-- ofc_candidate_targets         ❌ does not exist
-- ofc_library_citations         ❌ does not exist

-- Verification queries:

-- Check CORPUS tables (should return true for CORPUS-owned, false for RUNTIME-owned):
SELECT 'CORPUS: ofc_candidate_queue exists' as check_name, to_regclass('public.ofc_candidate_queue') IS NOT NULL as result;
SELECT 'CORPUS: ofc_candidate_targets exists' as check_name, to_regclass('public.ofc_candidate_targets') IS NOT NULL as result;
SELECT 'CORPUS: corpus_expansion_questions exists' as check_name, to_regclass('public.corpus_expansion_questions') IS NOT NULL as result;
SELECT 'CORPUS: ofc_library_citations exists' as check_name, to_regclass('public.ofc_library_citations') IS NOT NULL as result;
SELECT 'CORPUS: disciplines should NOT exist' as check_name, to_regclass('public.disciplines') IS NULL as result;
SELECT 'CORPUS: discipline_subtypes should NOT exist' as check_name, to_regclass('public.discipline_subtypes') IS NULL as result;
SELECT 'CORPUS: expansion_questions should NOT exist' as check_name, to_regclass('public.expansion_questions') IS NULL as result;

-- Check RUNTIME tables (should return true for RUNTIME-owned, false for CORPUS-owned):
SELECT 'RUNTIME: disciplines exists' as check_name, to_regclass('public.disciplines') IS NOT NULL as result;
SELECT 'RUNTIME: discipline_subtypes exists' as check_name, to_regclass('public.discipline_subtypes') IS NOT NULL as result;
SELECT 'RUNTIME: expansion_questions exists' as check_name, to_regclass('public.expansion_questions') IS NOT NULL as result;
SELECT 'RUNTIME: assessment_responses exists' as check_name, to_regclass('public.assessment_responses') IS NOT NULL as result;
SELECT 'RUNTIME: ofc_candidate_queue should NOT exist' as check_name, to_regclass('public.ofc_candidate_queue') IS NULL as result;
SELECT 'RUNTIME: ofc_candidate_targets should NOT exist' as check_name, to_regclass('public.ofc_candidate_targets') IS NULL as result;
SELECT 'RUNTIME: ofc_library_citations should NOT exist' as check_name, to_regclass('public.ofc_library_citations') IS NULL as result;