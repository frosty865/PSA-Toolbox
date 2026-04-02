-- EV_PARKING Module Standard (doctrine) — thin slice seed
-- Run on CORPUS database after db/migrations/corpus/20260126_1200_module_standards.sql
--
-- Replace a0000000-0000-0000-0000-000000000001 with a valid discipline_subtypes.id from RUNTIME
-- (e.g. from Fire, Electrical, or Physical Security). Update via runbook if needed.
--
-- vv1.1: Refactored to capability-level, PSA-scope. Removed regulatory/compliance/implementation language.

-- 1) module_standards (standard_type OBJECT = capability/object doctrine)
INSERT INTO public.module_standards (standard_key, name, description, version, status, standard_type)
VALUES (
  'EV_PARKING',
  'EV Parking',
  'Criteria and OFCs for EV parking and charging areas. Fire, electrical, and physical separation.',
  'v1.1',
  'APPROVED',
  'OBJECT'
)
ON CONFLICT (standard_key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, version = EXCLUDED.version, status = EXCLUDED.status, standard_type = EXCLUDED.standard_type, updated_at = now();

-- 2) module_standard_attributes (5–8)
INSERT INTO public.module_standard_attributes (standard_id, attr_key, attr_type, enum_values, prompt, order_index)
SELECT id, 'HAS_CHARGING', 'BOOL', '[]'::jsonb, 'Does the site include EV charging (AC or DC)?', 0 FROM public.module_standards WHERE standard_key = 'EV_PARKING'
ON CONFLICT (standard_id, attr_key) DO UPDATE SET attr_type = EXCLUDED.attr_type, prompt = EXCLUDED.prompt, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_attributes (standard_id, attr_key, attr_type, enum_values, prompt, order_index)
SELECT id, 'INDOOR_GARAGE', 'BOOL', '[]'::jsonb, 'Is EV parking or charging in an enclosed/indoor structure?', 1 FROM public.module_standards WHERE standard_key = 'EV_PARKING'
ON CONFLICT (standard_id, attr_key) DO UPDATE SET attr_type = EXCLUDED.attr_type, prompt = EXCLUDED.prompt, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_attributes (standard_id, attr_key, attr_type, enum_values, prompt, order_index)
SELECT id, 'UNDERGROUND', 'BOOL', '[]'::jsonb, 'Is EV parking or charging in an underground level?', 2 FROM public.module_standards WHERE standard_key = 'EV_PARKING'
ON CONFLICT (standard_id, attr_key) DO UPDATE SET attr_type = EXCLUDED.attr_type, prompt = EXCLUDED.prompt, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_attributes (standard_id, attr_key, attr_type, enum_values, prompt, order_index)
SELECT id, 'CAPACITY_LEVEL', 'ENUM', '["LOW","MEDIUM","HIGH"]'::jsonb, 'Approximate EV parking and EV charging capacity?', 3 FROM public.module_standards WHERE standard_key = 'EV_PARKING'
ON CONFLICT (standard_id, attr_key) DO UPDATE SET attr_type = EXCLUDED.attr_type, enum_values = EXCLUDED.enum_values, prompt = EXCLUDED.prompt, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_attributes (standard_id, attr_key, attr_type, enum_values, prompt, order_index)
SELECT id, 'DC_FAST', 'BOOL', '[]'::jsonb, 'Is DC fast charging present?', 4 FROM public.module_standards WHERE standard_key = 'EV_PARKING'
ON CONFLICT (standard_id, attr_key) DO UPDATE SET attr_type = EXCLUDED.attr_type, prompt = EXCLUDED.prompt, order_index = EXCLUDED.order_index;

-- 3) module_standard_criteria (12; applicability_rule {} for v1.1 - capability-level, PSA-scope)
INSERT INTO public.module_standard_criteria (standard_id, criterion_key, title, question_text, discipline_subtype_id, applicability_rule, order_index)
SELECT id, 'EVP_001', 'Dedicated zone', 'Are EV parking and EV charging each designated and managed as distinct areas to reduce incident spread impacts?', NULL, '{}'::jsonb, 0 FROM public.module_standards WHERE standard_key = 'EV_PARKING'
ON CONFLICT (standard_id, criterion_key) DO UPDATE SET title = EXCLUDED.title, question_text = EXCLUDED.question_text, applicability_rule = EXCLUDED.applicability_rule, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criteria (standard_id, criterion_key, title, question_text, discipline_subtype_id, applicability_rule, order_index)
SELECT id, 'EVP_002', 'Signage', 'Are EV parking and EV charging clearly identified and wayfinding supports safe movement and response during an incident?', NULL, '{}'::jsonb, 1 FROM public.module_standards WHERE standard_key = 'EV_PARKING'
ON CONFLICT (standard_id, criterion_key) DO UPDATE SET title = EXCLUDED.title, question_text = EXCLUDED.question_text, applicability_rule = EXCLUDED.applicability_rule, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criteria (standard_id, criterion_key, title, question_text, discipline_subtype_id, applicability_rule, order_index)
SELECT id, 'EVP_003', 'Fire separation', 'Does the facility manage separation between EV parking and EV charging areas and occupied/egress areas to reduce exposure during an EV incident?', NULL, '{}'::jsonb, 2 FROM public.module_standards WHERE standard_key = 'EV_PARKING'
ON CONFLICT (standard_id, criterion_key) DO UPDATE SET title = EXCLUDED.title, question_text = EXCLUDED.question_text, applicability_rule = EXCLUDED.applicability_rule, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criteria (standard_id, criterion_key, title, question_text, discipline_subtype_id, applicability_rule, order_index)
SELECT id, 'EVP_004', 'Detection', 'Is there a means to detect and alert on abnormal conditions in EV parking and EV charging areas to support early response?', NULL, '{}'::jsonb, 3 FROM public.module_standards WHERE standard_key = 'EV_PARKING'
ON CONFLICT (standard_id, criterion_key) DO UPDATE SET title = EXCLUDED.title, question_text = EXCLUDED.question_text, applicability_rule = EXCLUDED.applicability_rule, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criteria (standard_id, criterion_key, title, question_text, discipline_subtype_id, applicability_rule, order_index)
SELECT id, 'EVP_005', 'Suppression', 'Is there an established capability to control or suppress an EV-related fire condition in EV parking and EV charging areas prior to responder arrival?', NULL, '{}'::jsonb, 4 FROM public.module_standards WHERE standard_key = 'EV_PARKING'
ON CONFLICT (standard_id, criterion_key) DO UPDATE SET title = EXCLUDED.title, question_text = EXCLUDED.question_text, applicability_rule = EXCLUDED.applicability_rule, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criteria (standard_id, criterion_key, title, question_text, discipline_subtype_id, applicability_rule, order_index)
SELECT id, 'EVP_006', 'Electrical', 'Is EV charging equipment managed under a documented lifecycle process that includes inspection, maintenance, and corrective action?', NULL, '{}'::jsonb, 5 FROM public.module_standards WHERE standard_key = 'EV_PARKING'
ON CONFLICT (standard_id, criterion_key) DO UPDATE SET title = EXCLUDED.title, question_text = EXCLUDED.question_text, applicability_rule = EXCLUDED.applicability_rule, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criteria (standard_id, criterion_key, title, question_text, discipline_subtype_id, applicability_rule, order_index)
SELECT id, 'EVP_007', 'Spacing', 'Are EV charging locations arranged to reduce the likelihood of cascading impacts to adjacent vehicles, obstructions, and critical approaches?', NULL, '{}'::jsonb, 6 FROM public.module_standards WHERE standard_key = 'EV_PARKING'
ON CONFLICT (standard_id, criterion_key) DO UPDATE SET title = EXCLUDED.title, question_text = EXCLUDED.question_text, applicability_rule = EXCLUDED.applicability_rule, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criteria (standard_id, criterion_key, title, question_text, discipline_subtype_id, applicability_rule, order_index)
SELECT id, 'EVP_008', 'Egress', 'Are egress routes in and around EV parking and EV charging areas maintained clear and usable during normal operations and emergencies?', NULL, '{}'::jsonb, 7 FROM public.module_standards WHERE standard_key = 'EV_PARKING'
ON CONFLICT (standard_id, criterion_key) DO UPDATE SET title = EXCLUDED.title, question_text = EXCLUDED.question_text, applicability_rule = EXCLUDED.applicability_rule, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criteria (standard_id, criterion_key, title, question_text, discipline_subtype_id, applicability_rule, order_index)
SELECT id, 'EVP_009', 'Spill/venting', 'Are environmental and byproduct hazards from an EV incident addressed through site procedures and response coordination where applicable?', NULL, '{}'::jsonb, 8 FROM public.module_standards WHERE standard_key = 'EV_PARKING'
ON CONFLICT (standard_id, criterion_key) DO UPDATE SET title = EXCLUDED.title, question_text = EXCLUDED.question_text, applicability_rule = EXCLUDED.applicability_rule, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criteria (standard_id, criterion_key, title, question_text, discipline_subtype_id, applicability_rule, order_index)
SELECT id, 'EVP_010', 'Emergency procedures', 'Are written procedures for EV incident recognition, notification, initial actions, and occupant safety available and communicated to relevant staff?', NULL, '{}'::jsonb, 9 FROM public.module_standards WHERE standard_key = 'EV_PARKING'
ON CONFLICT (standard_id, criterion_key) DO UPDATE SET title = EXCLUDED.title, question_text = EXCLUDED.question_text, applicability_rule = EXCLUDED.applicability_rule, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criteria (standard_id, criterion_key, title, question_text, discipline_subtype_id, applicability_rule, order_index)
SELECT id, 'EVP_011', 'DC isolation', 'Where higher-capacity charging is present, are emergency isolation actions identified and accessible to authorized personnel and responders?', NULL, '{}'::jsonb, 10 FROM public.module_standards WHERE standard_key = 'EV_PARKING'
ON CONFLICT (standard_id, criterion_key) DO UPDATE SET title = EXCLUDED.title, question_text = EXCLUDED.question_text, applicability_rule = EXCLUDED.applicability_rule, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criteria (standard_id, criterion_key, title, question_text, discipline_subtype_id, applicability_rule, order_index)
SELECT id, 'EVP_012', 'Inspection', 'Is there a documented inspection and maintenance schedule for EV parking areas and EV charging equipment?', NULL, '{}'::jsonb, 11 FROM public.module_standards WHERE standard_key = 'EV_PARKING'
ON CONFLICT (standard_id, criterion_key) DO UPDATE SET title = EXCLUDED.title, question_text = EXCLUDED.question_text, applicability_rule = EXCLUDED.applicability_rule, order_index = EXCLUDED.order_index;

-- 4) module_standard_criterion_ofc_templates (1 per criterion - vv1.1 capability-level)
-- Uses placeholder subtype UUID; replace via runbook with real discipline_subtypes.id from RUNTIME.
INSERT INTO public.module_standard_criterion_ofc_templates (criterion_id, template_key, discipline_subtype_id, ofc_text_template, max_per_criterion, order_index)
SELECT c.id, 'OFC_EVP_001', 'a0000000-0000-0000-0000-000000000001'::uuid, 'Designate and manage EV parking and EV charging as distinct areas to reduce incident spread impacts.', 1, 0
FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_001'
ON CONFLICT (criterion_id, template_key) DO UPDATE SET ofc_text_template = EXCLUDED.ofc_text_template, discipline_subtype_id = EXCLUDED.discipline_subtype_id, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criterion_ofc_templates (criterion_id, template_key, discipline_subtype_id, ofc_text_template, max_per_criterion, order_index)
SELECT c.id, 'OFC_EVP_002', 'a0000000-0000-0000-0000-000000000001'::uuid, 'Ensure EV parking and EV charging are clearly identified and wayfinding supports safe movement and responder operations during an incident.', 1, 0
FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_002'
ON CONFLICT (criterion_id, template_key) DO UPDATE SET ofc_text_template = EXCLUDED.ofc_text_template, discipline_subtype_id = EXCLUDED.discipline_subtype_id, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criterion_ofc_templates (criterion_id, template_key, discipline_subtype_id, ofc_text_template, max_per_criterion, order_index)
SELECT c.id, 'OFC_EVP_003', 'a0000000-0000-0000-0000-000000000001'::uuid, 'Manage separation between EV parking and EV charging areas and occupied/egress areas to reduce exposure during EV incidents.', 1, 0
FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_003'
ON CONFLICT (criterion_id, template_key) DO UPDATE SET ofc_text_template = EXCLUDED.ofc_text_template, discipline_subtype_id = EXCLUDED.discipline_subtype_id, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criterion_ofc_templates (criterion_id, template_key, discipline_subtype_id, ofc_text_template, max_per_criterion, order_index)
SELECT c.id, 'OFC_EVP_004', 'a0000000-0000-0000-0000-000000000001'::uuid, 'Provide a means to detect and alert on abnormal conditions in EV parking and EV charging areas to support early response.', 1, 0
FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_004'
ON CONFLICT (criterion_id, template_key) DO UPDATE SET ofc_text_template = EXCLUDED.ofc_text_template, discipline_subtype_id = EXCLUDED.discipline_subtype_id, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criterion_ofc_templates (criterion_id, template_key, discipline_subtype_id, ofc_text_template, max_per_criterion, order_index)
SELECT c.id, 'OFC_EVP_005', 'a0000000-0000-0000-0000-000000000001'::uuid, 'Establish and maintain a capability to control or suppress EV-related fire conditions in EV parking and EV charging areas prior to responder arrival.', 1, 0
FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_005'
ON CONFLICT (criterion_id, template_key) DO UPDATE SET ofc_text_template = EXCLUDED.ofc_text_template, discipline_subtype_id = EXCLUDED.discipline_subtype_id, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criterion_ofc_templates (criterion_id, template_key, discipline_subtype_id, ofc_text_template, max_per_criterion, order_index)
SELECT c.id, 'OFC_EVP_006', 'a0000000-0000-0000-0000-000000000001'::uuid, 'Manage EV charging equipment under a documented lifecycle process including inspection, maintenance, and corrective action.', 1, 0
FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_006'
ON CONFLICT (criterion_id, template_key) DO UPDATE SET ofc_text_template = EXCLUDED.ofc_text_template, discipline_subtype_id = EXCLUDED.discipline_subtype_id, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criterion_ofc_templates (criterion_id, template_key, discipline_subtype_id, ofc_text_template, max_per_criterion, order_index)
SELECT c.id, 'OFC_EVP_007', 'a0000000-0000-0000-0000-000000000001'::uuid, 'Arrange EV charging locations to reduce cascading impacts to adjacent vehicles, obstructions, and critical approaches.', 1, 0
FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_007'
ON CONFLICT (criterion_id, template_key) DO UPDATE SET ofc_text_template = EXCLUDED.ofc_text_template, discipline_subtype_id = EXCLUDED.discipline_subtype_id, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criterion_ofc_templates (criterion_id, template_key, discipline_subtype_id, ofc_text_template, max_per_criterion, order_index)
SELECT c.id, 'OFC_EVP_008', 'a0000000-0000-0000-0000-000000000001'::uuid, 'Maintain egress routes in and around EV parking and EV charging areas clear and usable during normal operations and emergencies.', 1, 0
FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_008'
ON CONFLICT (criterion_id, template_key) DO UPDATE SET ofc_text_template = EXCLUDED.ofc_text_template, discipline_subtype_id = EXCLUDED.discipline_subtype_id, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criterion_ofc_templates (criterion_id, template_key, discipline_subtype_id, ofc_text_template, max_per_criterion, order_index)
SELECT c.id, 'OFC_EVP_009', 'a0000000-0000-0000-0000-000000000001'::uuid, 'Address EV incident environmental/byproduct hazards through site procedures and responder coordination where applicable.', 1, 0
FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_009'
ON CONFLICT (criterion_id, template_key) DO UPDATE SET ofc_text_template = EXCLUDED.ofc_text_template, discipline_subtype_id = EXCLUDED.discipline_subtype_id, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criterion_ofc_templates (criterion_id, template_key, discipline_subtype_id, ofc_text_template, max_per_criterion, order_index)
SELECT c.id, 'OFC_EVP_010', 'a0000000-0000-0000-0000-000000000001'::uuid, 'Maintain written EV incident procedures for recognition, notification, initial actions, and occupant safety; communicate them to relevant staff.', 1, 0
FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_010'
ON CONFLICT (criterion_id, template_key) DO UPDATE SET ofc_text_template = EXCLUDED.ofc_text_template, discipline_subtype_id = EXCLUDED.discipline_subtype_id, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criterion_ofc_templates (criterion_id, template_key, discipline_subtype_id, ofc_text_template, max_per_criterion, order_index)
SELECT c.id, 'OFC_EVP_011', 'a0000000-0000-0000-0000-000000000001'::uuid, 'Where higher-capacity charging is present, identify and maintain accessible emergency isolation actions for authorized personnel and responders.', 1, 0
FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_011'
ON CONFLICT (criterion_id, template_key) DO UPDATE SET ofc_text_template = EXCLUDED.ofc_text_template, discipline_subtype_id = EXCLUDED.discipline_subtype_id, order_index = EXCLUDED.order_index;

INSERT INTO public.module_standard_criterion_ofc_templates (criterion_id, template_key, discipline_subtype_id, ofc_text_template, max_per_criterion, order_index)
SELECT c.id, 'OFC_EVP_012', 'a0000000-0000-0000-0000-000000000001'::uuid, 'Maintain a documented inspection and maintenance schedule for EV parking areas and EV charging equipment.', 1, 0
FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_012'
ON CONFLICT (criterion_id, template_key) DO UPDATE SET ofc_text_template = EXCLUDED.ofc_text_template, discipline_subtype_id = EXCLUDED.discipline_subtype_id, order_index = EXCLUDED.order_index;
