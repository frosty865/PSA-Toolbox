-- =============================================================================
-- RUNTIME: Module → Standard mapping (inspect, flag, fix, verify)
-- Run these on the RUNTIME database only. See docs/MODULE_STANDARD_MAPPING.md.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) INSPECT: Current mapping (module_code, standard_class, instance standard_key)
-- -----------------------------------------------------------------------------
SELECT
  am.module_code,
  am.module_name,
  am.standard_class,
  mi.standard_key,
  mi.standard_version,
  mi.generated_at
FROM assessment_modules am
LEFT JOIN module_instances mi ON mi.module_code = am.module_code
ORDER BY am.module_code;


-- -----------------------------------------------------------------------------
-- 2) FLAG: OBJECT modules incorrectly mapped to PLAN standard
-- -----------------------------------------------------------------------------
SELECT
  am.module_code,
  am.standard_class AS module_standard_class,
  mi.standard_key AS instance_standard_key,
  mi.standard_version
FROM assessment_modules am
JOIN module_instances mi ON mi.module_code = am.module_code
WHERE mi.standard_key IN ('PHYSICAL_SECURITY_PLAN', 'EAP')
  AND am.module_code IN (
    'MODULE_EV_PARKING',
    'MODULE_EV_CHARGING',
    'MODULE_EV_PARKING_CHARGING'
  );


-- -----------------------------------------------------------------------------
-- 3) FIX: Remap OBJECT modules to PHYSICAL_SECURITY_MEASURES (run only if step 2 returns rows)
-- After running, re-run Standard → Generate for each module with standard_key = PHYSICAL_SECURITY_MEASURES.
-- -----------------------------------------------------------------------------
-- 3a) Update doctrine instance
-- UPDATE module_instances mi
-- SET standard_key = 'PHYSICAL_SECURITY_MEASURES',
--     standard_version = 'v1'
-- WHERE mi.module_code IN (
--     'MODULE_EV_PARKING',
--     'MODULE_EV_CHARGING',
--     'MODULE_EV_PARKING_CHARGING'
--   )
--   AND mi.standard_key IN ('PHYSICAL_SECURITY_PLAN', 'EAP');

-- 3b) Update template class on assessment_modules
-- UPDATE assessment_modules
-- SET standard_class = 'PHYSICAL_SECURITY_MEASURES'
-- WHERE module_code IN (
--     'MODULE_EV_PARKING',
--     'MODULE_EV_CHARGING',
--     'MODULE_EV_PARKING_CHARGING'
--   )
--   AND (standard_class IS NULL OR standard_class = 'PHYSICAL_SECURITY_PLAN');


-- -----------------------------------------------------------------------------
-- 4) VERIFY: After fix, confirm OBJECT modules show MEASURES
-- -----------------------------------------------------------------------------
SELECT
  am.module_code,
  am.standard_class,
  mi.standard_key,
  mi.standard_version
FROM assessment_modules am
LEFT JOIN module_instances mi ON mi.module_code = am.module_code
WHERE am.module_code IN ('MODULE_EV_PARKING', 'MODULE_EV_CHARGING', 'MODULE_EV_PARKING_CHARGING');
