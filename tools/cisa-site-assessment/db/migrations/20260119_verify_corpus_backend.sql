-- ============================================================================
-- VERIFY CORPUS BACKEND FINGERPRINT
-- ============================================================================
-- Run this BEFORE creating psa_corpus database to verify you're on the
-- correct CORPUS backend (system_identifier: 7572288122664293568)
--
-- USAGE:
--   Run this query first to verify backend before creating database
-- ============================================================================

DO $$
DECLARE
  actual_sid TEXT;
  expected_sid TEXT := '7572288122664293568';
BEGIN
  SELECT (SELECT system_identifier FROM pg_control_system())::text INTO actual_sid;
  
  IF actual_sid IS NULL THEN
    RAISE WARNING 'Cannot verify backend (pg_control_system() unavailable). Proceeding with caution.';
  ELSIF actual_sid != expected_sid THEN
    RAISE EXCEPTION 'Wrong backend: expected CORPUS backend (system_identifier=%), but got %. '
                    'Do not create psa_corpus on the wrong backend!',
                    expected_sid, actual_sid;
  ELSE
    RAISE NOTICE '✓ Backend verified: CORPUS backend (system_identifier=%)', actual_sid;
    RAISE NOTICE 'Safe to proceed with creating psa_corpus database.';
  END IF;
END $$;
