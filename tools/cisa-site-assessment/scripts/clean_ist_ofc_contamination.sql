-- Script to identify and optionally clean IST_OFC contamination in module_ofcs
-- Run this to check for IST_OFC entries that should be removed

-- Check for IST_OFC entries
SELECT 
  module_code,
  ofc_id,
  ofc_num,
  LEFT(ofc_text, 100) as ofc_text_preview,
  created_at
FROM public.module_ofcs
WHERE ofc_id LIKE 'IST_OFC_%'
ORDER BY module_code, ofc_num;

-- If you want to delete IST_OFC entries (UNCOMMENT TO RUN):
-- DELETE FROM public.module_ofc_sources
-- WHERE module_ofc_id IN (
--   SELECT id FROM public.module_ofcs WHERE ofc_id LIKE 'IST_OFC_%'
-- );
--
-- DELETE FROM public.module_ofcs
-- WHERE ofc_id LIKE 'IST_OFC_%';
