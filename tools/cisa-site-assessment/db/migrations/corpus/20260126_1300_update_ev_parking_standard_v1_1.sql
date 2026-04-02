-- Migration: Update EV_PARKING standard from vv1 to vv1.1
-- Date: 2026-01-26
-- Purpose: Refactor EV_PARKING standard to capability-level, PSA-scope
--          Remove regulatory/compliance/implementation language
--
-- TARGET DB: CORPUS

BEGIN;

-- Update version
UPDATE public.module_standards
SET version = 'v1.1', updated_at = now()
WHERE standard_key = 'EV_PARKING';

-- Update criteria (12 criteria - capability-level rewrites)
UPDATE public.module_standard_criteria
SET 
  question_text = 'Is EV parking/charging designated and managed as a distinct area to reduce incident spread impacts?'
WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
  AND criterion_key = 'EVP_001';

UPDATE public.module_standard_criteria
SET 
  question_text = 'Is EV parking/charging clearly identified and wayfinding supports safe movement and response during an incident?'
WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
  AND criterion_key = 'EVP_002';

UPDATE public.module_standard_criteria
SET 
  question_text = 'Does the facility manage separation between EV parking/charging and occupied/egress areas to reduce exposure during an EV incident?'
WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
  AND criterion_key = 'EVP_003';

UPDATE public.module_standard_criteria
SET 
  question_text = 'Is there a means to detect and alert on abnormal conditions in EV parking/charging areas to support early response?'
WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
  AND criterion_key = 'EVP_004';

UPDATE public.module_standard_criteria
SET 
  question_text = 'Is there an established capability to control or suppress an EV-related fire condition in EV parking/charging areas prior to responder arrival?'
WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
  AND criterion_key = 'EVP_005';

UPDATE public.module_standard_criteria
SET 
  question_text = 'Is EV charging equipment managed under a documented lifecycle process that includes inspection, maintenance, and corrective action?'
WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
  AND criterion_key = 'EVP_006';

UPDATE public.module_standard_criteria
SET 
  question_text = 'Are EV charging locations arranged to reduce the likelihood of cascading impacts to adjacent vehicles, obstructions, and critical approaches?'
WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
  AND criterion_key = 'EVP_007';

UPDATE public.module_standard_criteria
SET 
  question_text = 'Are egress routes in and around EV parking/charging areas maintained clear and usable during normal operations and emergencies?'
WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
  AND criterion_key = 'EVP_008';

UPDATE public.module_standard_criteria
SET 
  question_text = 'Are environmental and byproduct hazards from an EV incident addressed through site procedures and response coordination where applicable?'
WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
  AND criterion_key = 'EVP_009';

UPDATE public.module_standard_criteria
SET 
  question_text = 'Are written procedures for EV incident recognition, notification, initial actions, and occupant safety available and communicated to relevant staff?'
WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
  AND criterion_key = 'EVP_010';

UPDATE public.module_standard_criteria
SET 
  question_text = 'Where higher-capacity charging is present, are emergency isolation actions identified and accessible to authorized personnel and responders?'
WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
  AND criterion_key = 'EVP_011';

UPDATE public.module_standard_criteria
SET 
  question_text = 'Is there a documented inspection and maintenance schedule for EV parking/charging areas and associated equipment?'
WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
  AND criterion_key = 'EVP_012';

-- Update OFC templates (12 OFCs - capability-level rewrites)
UPDATE public.module_standard_criterion_ofc_templates
SET 
  ofc_text_template = 'Designate and manage EV parking/charging as a distinct area to reduce incident spread impacts.'
WHERE criterion_id = (SELECT c.id FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_001')
  AND template_key = 'OFC_EVP_001';

UPDATE public.module_standard_criterion_ofc_templates
SET 
  ofc_text_template = 'Ensure EV parking/charging is clearly identified and wayfinding supports safe movement and responder operations during an incident.'
WHERE criterion_id = (SELECT c.id FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_002')
  AND template_key = 'OFC_EVP_002';

UPDATE public.module_standard_criterion_ofc_templates
SET 
  ofc_text_template = 'Manage separation between EV parking/charging and occupied/egress areas to reduce exposure during EV incidents.'
WHERE criterion_id = (SELECT c.id FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_003')
  AND template_key = 'OFC_EVP_003';

UPDATE public.module_standard_criterion_ofc_templates
SET 
  ofc_text_template = 'Provide a means to detect and alert on abnormal conditions in EV parking/charging areas to support early response.'
WHERE criterion_id = (SELECT c.id FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_004')
  AND template_key = 'OFC_EVP_004';

UPDATE public.module_standard_criterion_ofc_templates
SET 
  ofc_text_template = 'Establish and maintain a capability to control or suppress EV-related fire conditions in EV parking/charging areas prior to responder arrival.'
WHERE criterion_id = (SELECT c.id FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_005')
  AND template_key = 'OFC_EVP_005';

UPDATE public.module_standard_criterion_ofc_templates
SET 
  ofc_text_template = 'Manage EV charging equipment under a documented lifecycle process including inspection, maintenance, and corrective action.'
WHERE criterion_id = (SELECT c.id FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_006')
  AND template_key = 'OFC_EVP_006';

UPDATE public.module_standard_criterion_ofc_templates
SET 
  ofc_text_template = 'Arrange EV charging locations to reduce cascading impacts to adjacent vehicles, obstructions, and critical approaches.'
WHERE criterion_id = (SELECT c.id FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_007')
  AND template_key = 'OFC_EVP_007';

UPDATE public.module_standard_criterion_ofc_templates
SET 
  ofc_text_template = 'Maintain egress routes in and around EV parking/charging areas clear and usable during normal operations and emergencies.'
WHERE criterion_id = (SELECT c.id FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_008')
  AND template_key = 'OFC_EVP_008';

UPDATE public.module_standard_criterion_ofc_templates
SET 
  ofc_text_template = 'Address EV incident environmental/byproduct hazards through site procedures and responder coordination where applicable.'
WHERE criterion_id = (SELECT c.id FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_009')
  AND template_key = 'OFC_EVP_009';

UPDATE public.module_standard_criterion_ofc_templates
SET 
  ofc_text_template = 'Maintain written EV incident procedures for recognition, notification, initial actions, and occupant safety; communicate them to relevant staff.'
WHERE criterion_id = (SELECT c.id FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_010')
  AND template_key = 'OFC_EVP_010';

UPDATE public.module_standard_criterion_ofc_templates
SET 
  ofc_text_template = 'Where higher-capacity charging is present, identify and maintain accessible emergency isolation actions for authorized personnel and responders.'
WHERE criterion_id = (SELECT c.id FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_011')
  AND template_key = 'OFC_EVP_011';

UPDATE public.module_standard_criterion_ofc_templates
SET 
  ofc_text_template = 'Maintain a documented inspection and maintenance schedule for EV parking/charging areas and associated equipment.'
WHERE criterion_id = (SELECT c.id FROM public.module_standard_criteria c JOIN public.module_standards s ON s.id = c.standard_id WHERE s.standard_key = 'EV_PARKING' AND c.criterion_key = 'EVP_012')
  AND template_key = 'OFC_EVP_012';

COMMIT;
