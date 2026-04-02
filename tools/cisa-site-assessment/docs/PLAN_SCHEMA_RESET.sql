-- One-time manual cleanup: remove stored plan schema for a module so the next "Force Re-Derive" rebuilds from scratch.
-- Run in the RUNTIME database (e.g. Supabase SQL editor or psql to the runtime DB).

-- Single module (Active Assailant EAP):
DELETE FROM public.plan_schema_registry WHERE module_code = 'MODULE_ACTIVE_ASSAILANT_EMERGENCY_ACTION_PLAN';

-- Or any module (replace <MODULE_CODE>):
-- DELETE FROM public.plan_schema_registry WHERE module_code = '<MODULE_CODE>';

-- Cascade will remove plan_schema_sections and plan_schema_elements for that row.
-- Then use the UI "Force Re-Derive Plan Schema" or POST .../plan/derive-schema?force=1.
