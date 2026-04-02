-- Demote a module from ACTIVE to DRAFT status
-- 
-- Usage: Replace MODULE_CODE_HERE with your module code
-- Run this in RUNTIME database

-- Check current status and content
SELECT 
  module_code,
  module_name,
  status,
  (SELECT COUNT(*) FROM public.module_questions WHERE module_code = am.module_code) as question_count,
  (SELECT COUNT(*) FROM public.module_ofcs WHERE module_code = am.module_code) as ofc_count
FROM public.assessment_modules am
WHERE module_code = 'MODULE_CODE_HERE';

-- Update status to DRAFT
-- WARNING: This will prevent the module from being attached to new assessments
UPDATE public.assessment_modules
SET status = 'DRAFT', updated_at = now()
WHERE module_code = 'MODULE_CODE_HERE'
  AND status = 'ACTIVE';

-- Verify the change
SELECT module_code, module_name, status, updated_at
FROM public.assessment_modules
WHERE module_code = 'MODULE_CODE_HERE';
