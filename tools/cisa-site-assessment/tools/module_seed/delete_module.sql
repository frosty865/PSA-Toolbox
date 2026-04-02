-- Completely delete a module and all related data
-- 
-- WARNING: This will permanently delete:
--   - Module metadata (assessment_modules)
--   - All module questions (module_questions) - CASCADE
--   - All module OFCs (module_ofcs) - CASCADE
--   - All module sources (module_ofc_sources) - CASCADE
--   - All module instances (assessment_module_instances) - CASCADE
--   - All module VOFCs (module_ofc_library, module_ofc_citations) - CASCADE
--   - All module instance data (module_instances, etc.) - CASCADE
--
-- Usage: Replace MODULE_CODE_HERE with your module code
-- Run this in RUNTIME database

-- First, check what will be deleted
SELECT 
  'Module Metadata' as item_type,
  COUNT(*) as count
FROM public.assessment_modules
WHERE module_code = 'MODULE_CODE_HERE'

UNION ALL

SELECT 
  'Module Questions' as item_type,
  COUNT(*) as count
FROM public.module_questions
WHERE module_code = 'MODULE_CODE_HERE'

UNION ALL

SELECT 
  'Module OFCs' as item_type,
  COUNT(*) as count
FROM public.module_ofcs
WHERE module_code = 'MODULE_CODE_HERE'

UNION ALL

SELECT 
  'Assessment Instances' as item_type,
  COUNT(*) as count
FROM public.assessment_module_instances
WHERE module_code = 'MODULE_CODE_HERE'

UNION ALL

SELECT 
  'Module VOFCs' as item_type,
  COUNT(*) as count
FROM public.module_ofc_library
WHERE module_code = 'MODULE_CODE_HERE'

UNION ALL

SELECT 
  'Module Instances' as item_type,
  COUNT(*) as count
FROM public.module_instances
WHERE module_code = 'MODULE_CODE_HERE';

-- Delete the module (CASCADE will handle all related records)
-- WARNING: This is permanent and cannot be undone!
DELETE FROM public.assessment_modules
WHERE module_code = 'MODULE_CODE_HERE';

-- Verify deletion
SELECT 
  module_code,
  module_name,
  status
FROM public.assessment_modules
WHERE module_code = 'MODULE_CODE_HERE';
-- Should return 0 rows
