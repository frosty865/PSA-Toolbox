-- Update Visitor Management Format Question to CHECKLIST Type
-- Target: BASE-ACS-ACS_VISITOR_MANAGEMENT_SYSTEMS-D2-001
-- 
-- Changes:
-- 1. Update question_text to "Which format is used for visitor management at this facility?"
-- 2. Update response_enum to ["PAPER","DIGITAL","HYBRID"]
--
-- Run with: npx tsx tools/run_sql.ts tools/sql/update_visitor_management_checklist.sql

-- Update the question in baseline_questions table (if it exists)
UPDATE public.baseline_questions
SET 
  question_text = 'Which format is used for visitor management at this facility?',
  response_enum = '["PAPER","DIGITAL","HYBRID"]'::jsonb,
  updated_at = now()
WHERE question_code = 'BASE-ACS-ACS_VISITOR_MANAGEMENT_SYSTEMS-D2-001';

-- Verify the update
SELECT 
  question_code,
  question_text,
  response_enum,
  updated_at
FROM public.baseline_questions
WHERE question_code = 'BASE-ACS-ACS_VISITOR_MANAGEMENT_SYSTEMS-D2-001';

-- Note: This question is also defined in tools/outputs/baseline_depth2_questions.json
-- The JSON file has been updated separately and will be used by the API route
-- to load depth-2 questions.
