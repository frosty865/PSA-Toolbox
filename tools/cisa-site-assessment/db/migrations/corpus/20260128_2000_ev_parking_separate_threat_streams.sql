-- EV Parking: treat EV parking and EV charging as separate threat streams (no "EV parking/charging").
-- Updates module_standard_criteria and module_standard_criterion_ofc_templates for EV_PARKING.

-- Criteria: replace "EV parking/charging" with distinct wording
UPDATE public.module_standard_criteria
SET question_text = 'Are EV parking and EV charging each designated and managed as distinct areas to reduce incident spread impacts?'
WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
  AND criterion_key = 'EVP_001';

UPDATE public.module_standard_criteria
SET question_text = 'Are EV parking and EV charging clearly identified and wayfinding supports safe movement and response during an incident?'
WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
  AND criterion_key = 'EVP_002';

UPDATE public.module_standard_criteria
SET question_text = 'Does the facility manage separation between EV parking and EV charging areas and occupied/egress areas to reduce exposure during an EV incident?'
WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
  AND criterion_key = 'EVP_003';

UPDATE public.module_standard_criteria
SET question_text = 'Is there a means to detect and alert on abnormal conditions in EV parking and EV charging areas to support early response?'
WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
  AND criterion_key = 'EVP_004';

UPDATE public.module_standard_criteria
SET question_text = 'Is there an established capability to control or suppress an EV-related fire condition in EV parking and EV charging areas prior to responder arrival?'
WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
  AND criterion_key = 'EVP_005';

UPDATE public.module_standard_criteria
SET question_text = 'Are egress routes in and around EV parking and EV charging areas maintained clear and usable during normal operations and emergencies?'
WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
  AND criterion_key = 'EVP_008';

UPDATE public.module_standard_criteria
SET question_text = 'Is there a documented inspection and maintenance schedule for EV parking areas and EV charging equipment?'
WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
  AND criterion_key = 'EVP_012';

-- Attribute prompt
UPDATE public.module_standard_attributes
SET prompt = 'Approximate EV parking and EV charging capacity?'
WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
  AND attr_key = 'CAPACITY_LEVEL';

-- OFC templates
UPDATE public.module_standard_criterion_ofc_templates t
SET ofc_text_template = 'Designate and manage EV parking and EV charging as distinct areas to reduce incident spread impacts.'
FROM public.module_standard_criteria c
JOIN public.module_standards s ON s.id = c.standard_id
WHERE t.criterion_id = c.id AND s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_001' AND t.template_key = 'OFC_EVP_001';

UPDATE public.module_standard_criterion_ofc_templates t
SET ofc_text_template = 'Ensure EV parking and EV charging are clearly identified and wayfinding supports safe movement and responder operations during an incident.'
FROM public.module_standard_criteria c
JOIN public.module_standards s ON s.id = c.standard_id
WHERE t.criterion_id = c.id AND s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_002' AND t.template_key = 'OFC_EVP_002';

UPDATE public.module_standard_criterion_ofc_templates t
SET ofc_text_template = 'Manage separation between EV parking and EV charging areas and occupied/egress areas to reduce exposure during EV incidents.'
FROM public.module_standard_criteria c
JOIN public.module_standards s ON s.id = c.standard_id
WHERE t.criterion_id = c.id AND s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_003' AND t.template_key = 'OFC_EVP_003';

UPDATE public.module_standard_criterion_ofc_templates t
SET ofc_text_template = 'Provide a means to detect and alert on abnormal conditions in EV parking and EV charging areas to support early response.'
FROM public.module_standard_criteria c
JOIN public.module_standards s ON s.id = c.standard_id
WHERE t.criterion_id = c.id AND s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_004' AND t.template_key = 'OFC_EVP_004';

UPDATE public.module_standard_criterion_ofc_templates t
SET ofc_text_template = 'Establish and maintain a capability to control or suppress EV-related fire conditions in EV parking and EV charging areas prior to responder arrival.'
FROM public.module_standard_criteria c
JOIN public.module_standards s ON s.id = c.standard_id
WHERE t.criterion_id = c.id AND s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_005' AND t.template_key = 'OFC_EVP_005';

UPDATE public.module_standard_criterion_ofc_templates t
SET ofc_text_template = 'Maintain egress routes in and around EV parking and EV charging areas clear and usable during normal operations and emergencies.'
FROM public.module_standard_criteria c
JOIN public.module_standards s ON s.id = c.standard_id
WHERE t.criterion_id = c.id AND s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_008' AND t.template_key = 'OFC_EVP_008';

UPDATE public.module_standard_criterion_ofc_templates t
SET ofc_text_template = 'Maintain a documented inspection and maintenance schedule for EV parking areas and EV charging equipment.'
FROM public.module_standard_criteria c
JOIN public.module_standards s ON s.id = c.standard_id
WHERE t.criterion_id = c.id AND s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_012' AND t.template_key = 'OFC_EVP_012';
