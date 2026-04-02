-- Create QA Validation Assessment for OFC Regeneration Testing
-- This assessment is marked for QA purposes and should be excluded from production queries

-- Note: Adjust column names and values based on your actual schema
-- This is a template that may need modification

-- Option 1: If assessments table has qa_flag column
INSERT INTO public.assessments (
    id,
    name,
    status,
    qa_flag,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'QA Validation Assessment - OFC Regeneration Test',
    'draft',
    true,
    now(),
    now()
);

-- Option 2: If using metadata JSON column
-- INSERT INTO public.assessments (
--     id,
--     name,
--     status,
--     metadata,
--     created_at,
--     updated_at
-- ) VALUES (
--     gen_random_uuid(),
--     'QA Validation Assessment - OFC Regeneration Test',
--     'draft',
--     '{"qa_flag": true, "purpose": "OFC_regeneration_validation"}'::jsonb,
--     now(),
--     now()
-- );

-- Option 3: Use name prefix to identify QA assessments
-- INSERT INTO public.assessments (
--     id,
--     name,
--     status,
--     created_at,
--     updated_at
-- ) VALUES (
--     gen_random_uuid(),
--     '[QA] OFC Regeneration Test',
--     'draft',
--     now(),
--     now()
-- );

-- After creating the assessment, note the assessment_id and use it in the response inserts below
-- Example responses (adjust question_template_id values based on your database):

-- Response 1: CONTROL_EXISTS = NO (BASE-000)
-- INSERT INTO public.assessment_responses (
--     assessment_instance_id,
--     question_template_id,
--     response,
--     responded_at
-- ) VALUES (
--     '<assessment_id_from_above>',
--     '<question_template_id_for_BASE-000>',
--     'NO',
--     now()
-- );

-- Response 2: CONTROL_EXISTS = YES, CONTROL_OPERABLE = NO (for same subtype)
-- (Insert EXISTS = YES first, then OPERABLE = NO)

-- Response 3: CONTROL_EXISTS = YES, CONTROL_OPERABLE = YES, CONTROL_RESILIENCE = NO
-- (Insert all prerequisites first, then RESILIENCE = NO)

