-- Depth-2 (Conditional) Baseline Questions
-- Generated: 2026-01-16T20:08:09.616Z
--
-- PURPOSE:
--   These questions are conditional follow-ups that appear only when
--   the parent baseline spine (Depth-1) is answered YES.
--
-- CONDITIONAL LOGIC:
--   Depth-2 questions are shown conditionally based on parent answer:
--   - IF parent_spine.response = "YES" THEN show Depth-2 questions
--   - IF parent_spine.response = "NO" OR "N_A" THEN hide Depth-2 questions
--
-- VALIDATION:
--   Total questions: 205
--   Subtypes covered: 93
--   Max per subtype: 5
--

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_BIOMETRIC_ACCESS-D2-001',
  'BASE-ACS-ACS_BIOMETRIC_ACCESS',
  'ACS',
  'ACS_BIOMETRIC_ACCESS',
  'Is enrollment standardized and verified by trained personnel?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_CREDENTIAL_BADGE_SYSTEMS-D2-001',
  'BASE-ACS-ACS_CREDENTIAL_BADGE_SYSTEMS',
  'ACS',
  'ACS_CREDENTIAL_BADGE_SYSTEMS',
  'Do supervisors approve access levels?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_DOOR_MONITORING-D2-001',
  'BASE-ACS-ACS_DOOR_MONITORING',
  'ACS',
  'ACS_DOOR_MONITORING',
  'Do propped or forced doors trigger alarms?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_DOOR_MONITORING-D2-002',
  'BASE-ACS-ACS_DOOR_MONITORING',
  'ACS',
  'ACS_DOOR_MONITORING',
  'Are alarms monitored 24/7 or logged?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_DOOR_MONITORING-D2-003',
  'BASE-ACS-ACS_DOOR_MONITORING',
  'ACS',
  'ACS_DOOR_MONITORING',
  'Is there a process for investigating repeated alarms?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_DOOR_READERS-D2-001',
  'BASE-ACS-ACS_DOOR_READERS',
  'ACS',
  'ACS_DOOR_READERS',
  'Are readers tamper-resistant and properly installed?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_DOOR_READERS-D2-002',
  'BASE-ACS-ACS_DOOR_READERS',
  'ACS',
  'ACS_DOOR_READERS',
  'Are readers updated for security patches or encryption upgrades?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_ELECTRIC_STRIKES_MAG_LOCKS-D2-001',
  'BASE-ACS-ACS_ELECTRIC_STRIKES_MAG_LOCKS',
  'ACS',
  'ACS_ELECTRIC_STRIKES_MAG_LOCKS',
  'Are mag locks tied into the fire alarm system?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_ELECTRIC_STRIKES_MAG_LOCKS-D2-002',
  'BASE-ACS-ACS_ELECTRIC_STRIKES_MAG_LOCKS',
  'ACS',
  'ACS_ELECTRIC_STRIKES_MAG_LOCKS',
  'Is the fail-safe/fail-secure mode appropriate for the risk?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_ELECTRIC_STRIKES_MAG_LOCKS-D2-003',
  'BASE-ACS-ACS_ELECTRIC_STRIKES_MAG_LOCKS',
  'ACS',
  'ACS_ELECTRIC_STRIKES_MAG_LOCKS',
  'Do doors release properly during power outages or emergency tests?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_KEYPADS_PIN_ENTRY-D2-001',
  'BASE-ACS-ACS_KEYPADS_PIN_ENTRY',
  'ACS',
  'ACS_KEYPADS_PIN_ENTRY',
  'Are PINs assigned individually or shared among groups?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_KEYPADS_PIN_ENTRY-D2-002',
  'BASE-ACS-ACS_KEYPADS_PIN_ENTRY',
  'ACS',
  'ACS_KEYPADS_PIN_ENTRY',
  'Does the keypad have a lockout after failed attempts?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_KEYPADS_PIN_ENTRY-D2-003',
  'BASE-ACS-ACS_KEYPADS_PIN_ENTRY',
  'ACS',
  'ACS_KEYPADS_PIN_ENTRY',
  'Is the keypad visible from public or visitor areas?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_KEYPADS_PIN_ENTRY-D2-004',
  'BASE-ACS-ACS_KEYPADS_PIN_ENTRY',
  'ACS',
  'ACS_KEYPADS_PIN_ENTRY',
  'Are PIN entry logs or access attempts monitored?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  4
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_LOCKING_HARDWARE-D2-001',
  'BASE-ACS-ACS_LOCKING_HARDWARE',
  'ACS',
  'ACS_LOCKING_HARDWARE',
  'Do all exterior and interior doors latch securely?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_LOCKING_HARDWARE-D2-002',
  'BASE-ACS-ACS_LOCKING_HARDWARE',
  'ACS',
  'ACS_LOCKING_HARDWARE',
  'Are locks appropriate for the area’s risk profile?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_LOCKING_HARDWARE-D2-003',
  'BASE-ACS-ACS_LOCKING_HARDWARE',
  'ACS',
  'ACS_LOCKING_HARDWARE',
  'Are classroom or office doors capable of emergency lockdown?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_LOCKING_HARDWARE-D2-004',
  'BASE-ACS-ACS_LOCKING_HARDWARE',
  'ACS',
  'ACS_LOCKING_HARDWARE',
  'Is locking hardware included in preventive maintenance?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  4
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_SECURED_VESTIBULES-D2-001',
  'BASE-ACS-ACS_SECURED_VESTIBULES',
  'ACS',
  'ACS_SECURED_VESTIBULES',
  'Are vestibule doors and hardware routinely inspected to ensure proper function?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_VISITOR_MANAGEMENT_SYSTEMS-D2-001',
  'BASE-ACS-ACS_VISITOR_MANAGEMENT_SYSTEMS',
  'ACS',
  'ACS_VISITOR_MANAGEMENT_SYSTEMS',
  'Which format is used for visitor management at this facility?',
  '["PAPER","DIGITAL","HYBRID"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO UPDATE SET
  question_text = EXCLUDED.question_text,
  response_enum = EXCLUDED.response_enum;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_VISITOR_MANAGEMENT_SYSTEMS-D2-002',
  'BASE-ACS-ACS_VISITOR_MANAGEMENT_SYSTEMS',
  'ACS',
  'ACS_VISITOR_MANAGEMENT_SYSTEMS',
  'Are visitors required to present ID before entry?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_VISITOR_MANAGEMENT_SYSTEMS-D2-003',
  'BASE-ACS-ACS_VISITOR_MANAGEMENT_SYSTEMS',
  'ACS',
  'ACS_VISITOR_MANAGEMENT_SYSTEMS',
  'Are badges clearly marked and differentiated from staff?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_VISITOR_MANAGEMENT_SYSTEMS-D2-004',
  'BASE-ACS-ACS_VISITOR_MANAGEMENT_SYSTEMS',
  'ACS',
  'ACS_VISITOR_MANAGEMENT_SYSTEMS',
  'Does the system track check-in and check-out times?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  4
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ACS-ACS_VISITOR_MANAGEMENT_SYSTEMS-D2-005',
  'BASE-ACS-ACS_VISITOR_MANAGEMENT_SYSTEMS',
  'ACS',
  'ACS_VISITOR_MANAGEMENT_SYSTEMS',
  'Are visitor records retained for a documented period?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  5
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-COM-COM_BACKUP_COMMUNICATIONS-D2-001',
  'BASE-COM-COM_BACKUP_COMMUNICATIONS',
  'COM',
  'COM_BACKUP_COMMUNICATIONS',
  'Do backups operate independently of primary network and power?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-COM-COM_BACKUP_COMMUNICATIONS-D2-002',
  'BASE-COM-COM_BACKUP_COMMUNICATIONS',
  'COM',
  'COM_BACKUP_COMMUNICATIONS',
  'Are backup instructions documented and accessible?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-COM-COM_COMMUNICATION_PROTOCOLS-D2-001',
  'BASE-COM-COM_COMMUNICATION_PROTOCOLS',
  'COM',
  'COM_COMMUNICATION_PROTOCOLS',
  'Do you have documented call trees or contact lists with current information?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-COM-COM_INTEROPERABLE_COMMUNICATIONS-D2-001',
  'BASE-COM-COM_INTEROPERABLE_COMMUNICATIONS',
  'COM',
  'COM_INTEROPERABLE_COMMUNICATIONS',
  'Do all critical personnel carry compatible devices?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-COM-COM_PA_SYSTEMS-D2-001',
  'BASE-COM-COM_PA_SYSTEMS',
  'COM',
  'COM_PA_SYSTEMS',
  'Can PA announcements be clearly heard in all occupied areas?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-COM-COM_PA_SYSTEMS-D2-002',
  'BASE-COM-COM_PA_SYSTEMS',
  'COM',
  'COM_PA_SYSTEMS',
  'Does PA have backup power for extended outages?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-COM-COM_PAGING_SYSTEMS-D2-001',
  'BASE-COM-COM_PAGING_SYSTEMS',
  'COM',
  'COM_PAGING_SYSTEMS',
  'Are paging codes standardized and documented?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-COM-COM_PAGING_SYSTEMS-D2-002',
  'BASE-COM-COM_PAGING_SYSTEMS',
  'COM',
  'COM_PAGING_SYSTEMS',
  'Can emergency messages override routine paging?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-COM-COM_PAGING_SYSTEMS-D2-003',
  'BASE-COM-COM_PAGING_SYSTEMS',
  'COM',
  'COM_PAGING_SYSTEMS',
  'Does the paging coverage include high-risk or remote areas?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-COM-COM_RADIOS_TWO_WAY-D2-001',
  'BASE-COM-COM_RADIOS_TWO_WAY',
  'COM',
  'COM_RADIOS_TWO_WAY',
  'Do you have clear radio procedures and call signs?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-COM-COM_RADIOS_TWO_WAY-D2-002',
  'BASE-COM-COM_RADIOS_TWO_WAY',
  'COM',
  'COM_RADIOS_TWO_WAY',
  'Do you practice radio communication during drills?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_DEFENSIBLE_SPACE-D2-001',
  'BASE-CPTED-CPTED_DEFENSIBLE_SPACE',
  'CPTED',
  'CPTED_DEFENSIBLE_SPACE',
  'Have users been engaged in designing or improving shared spaces to increase ownership?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_EXTERIOR_LIGHTING-D2-001',
  'BASE-CPTED-CPTED_EXTERIOR_LIGHTING',
  'CPTED',
  'CPTED_EXTERIOR_LIGHTING',
  'Do you conduct nighttime inspections to assess real-world lighting conditions?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_EXTERIOR_LIGHTING-D2-002',
  'BASE-CPTED-CPTED_EXTERIOR_LIGHTING',
  'CPTED',
  'CPTED_EXTERIOR_LIGHTING',
  'Is lighting coordinated with video surveillance coverage and guard patrol patterns?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_EXTERIOR_LIGHTING-D2-003',
  'BASE-CPTED-CPTED_EXTERIOR_LIGHTING',
  'CPTED',
  'CPTED_EXTERIOR_LIGHTING',
  'Are controls (photocells, timers, BMS) set to ensure consistent coverage during hours of darkness?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_LANDSCAPING_CONTROL-D2-001',
  'BASE-CPTED-CPTED_LANDSCAPING_CONTROL',
  'CPTED',
  'CPTED_LANDSCAPING_CONTROL',
  'Have landscaping standards or guidelines been developed that include security considerations?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_LANDSCAPING_CONTROL-D2-002',
  'BASE-CPTED-CPTED_LANDSCAPING_CONTROL',
  'CPTED',
  'CPTED_LANDSCAPING_CONTROL',
  'Do planting plans limit concealment near doors, windows, and pedestrian paths?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_LANDSCAPING_CONTROL-D2-003',
  'BASE-CPTED-CPTED_LANDSCAPING_CONTROL',
  'CPTED',
  'CPTED_LANDSCAPING_CONTROL',
  'Are trees and large shrubs monitored so they do not become climb aids or observation blockers?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_LANDSCAPING_CONTROL-D2-004',
  'BASE-CPTED-CPTED_LANDSCAPING_CONTROL',
  'CPTED',
  'CPTED_LANDSCAPING_CONTROL',
  'Is landscaping reviewed after major changes to lighting, cameras, or fencing?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  4
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_NATURAL_SURVEILLANCE-D2-001',
  'BASE-CPTED-CPTED_NATURAL_SURVEILLANCE',
  'CPTED',
  'CPTED_NATURAL_SURVEILLANCE',
  'Have you evaluated landscaping and structures for hiding places or ambush points?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_NATURAL_SURVEILLANCE-D2-002',
  'BASE-CPTED-CPTED_NATURAL_SURVEILLANCE',
  'CPTED',
  'CPTED_NATURAL_SURVEILLANCE',
  'Are parking and pedestrian routes visible from occupied areas or patrols?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_NATURAL_SURVEILLANCE-D2-003',
  'BASE-CPTED-CPTED_NATURAL_SURVEILLANCE',
  'CPTED',
  'CPTED_NATURAL_SURVEILLANCE',
  'Do interior layouts allow informal observation of hallways and common spaces?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_NATURAL_SURVEILLANCE-D2-004',
  'BASE-CPTED-CPTED_NATURAL_SURVEILLANCE',
  'CPTED',
  'CPTED_NATURAL_SURVEILLANCE',
  'Have sightlines been reassessed since major renovations or additions?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  4
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_SIGHTLINES-D2-001',
  'BASE-CPTED-CPTED_SIGHTLINES',
  'CPTED',
  'CPTED_SIGHTLINES',
  'Have you adjusted landscaping, signage, or fixtures to improve sightlines?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_SIGHTLINES-D2-002',
  'BASE-CPTED-CPTED_SIGHTLINES',
  'CPTED',
  'CPTED_SIGHTLINES',
  'Do you periodically reassess sightlines after changes to the site or building?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_TERRITORIAL_REINFORCEMENT-D2-001',
  'BASE-CPTED-CPTED_TERRITORIAL_REINFORCEMENT',
  'CPTED',
  'CPTED_TERRITORIAL_REINFORCEMENT',
  'Are restricted areas clearly marked?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_TERRITORIAL_REINFORCEMENT-D2-002',
  'BASE-CPTED-CPTED_TERRITORIAL_REINFORCEMENT',
  'CPTED',
  'CPTED_TERRITORIAL_REINFORCEMENT',
  'Have you had issues with loitering or unauthorized use of spaces?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_TERRITORIAL_REINFORCEMENT-D2-003',
  'BASE-CPTED-CPTED_TERRITORIAL_REINFORCEMENT',
  'CPTED',
  'CPTED_TERRITORIAL_REINFORCEMENT',
  'Do staff feel responsible for monitoring adjacent exterior areas?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_WAYFINDING-D2-001',
  'BASE-CPTED-CPTED_WAYFINDING',
  'CPTED',
  'CPTED_WAYFINDING',
  'Can a first-time visitor navigate to key locations without assistance?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_WAYFINDING-D2-002',
  'BASE-CPTED-CPTED_WAYFINDING',
  'CPTED',
  'CPTED_WAYFINDING',
  'Do signs align with emergency evacuation routes and assembly areas?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_WAYFINDING-D2-003',
  'BASE-CPTED-CPTED_WAYFINDING',
  'CPTED',
  'CPTED_WAYFINDING',
  'Is wayfinding consistent across buildings, floors, or wings?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_WAYFINDING-D2-004',
  'BASE-CPTED-CPTED_WAYFINDING',
  'CPTED',
  'CPTED_WAYFINDING',
  'Has signage been evaluated during drills for clarity and speed?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  4
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-CPTED-CPTED_WAYFINDING-D2-005',
  'BASE-CPTED-CPTED_WAYFINDING',
  'CPTED',
  'CPTED_WAYFINDING',
  'Are color coding, symbols, or zone identifiers used to simplify navigation?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  5
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EAP-EAP_EMERGENCY_DRILLS-D2-001',
  'BASE-EAP-EAP_EMERGENCY_DRILLS',
  'EAP',
  'EAP_EMERGENCY_DRILLS',
  'Are drills designed to test realistic scenarios and decision-making?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EAP-EAP_EMERGENCY_DRILLS-D2-002',
  'BASE-EAP-EAP_EMERGENCY_DRILLS',
  'EAP',
  'EAP_EMERGENCY_DRILLS',
  'Do drills include evaluation of communications and coordination?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EAP-EAP_EMERGENCY_GUIDES_FLIP_CHARTS-D2-001',
  'BASE-EAP-EAP_EMERGENCY_GUIDES_FLIP_CHARTS',
  'EAP',
  'EAP_EMERGENCY_GUIDES_FLIP_CHARTS',
  'Do guides reflect the current hazard plan and facility layout?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EAP-EAP_EMERGENCY_GUIDES_FLIP_CHARTS-D2-002',
  'BASE-EAP-EAP_EMERGENCY_GUIDES_FLIP_CHARTS',
  'EAP',
  'EAP_EMERGENCY_GUIDES_FLIP_CHARTS',
  'Are guides available in formats accessible to all occupants?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EAP-EAP_EMERGENCY_GUIDES_FLIP_CHARTS-D2-003',
  'BASE-EAP-EAP_EMERGENCY_GUIDES_FLIP_CHARTS',
  'EAP',
  'EAP_EMERGENCY_GUIDES_FLIP_CHARTS',
  'Are guides used during drills and training sessions?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EAP-EAP_LOCKDOWN_LOCKOUT_PROCEDURES-D2-001',
  'BASE-EAP-EAP_LOCKDOWN_LOCKOUT_PROCEDURES',
  'EAP',
  'EAP_LOCKDOWN_LOCKOUT_PROCEDURES',
  'Is there a written lockdown/lockout procedure?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EAP-EAP_LOCKDOWN_LOCKOUT_PROCEDURES-D2-002',
  'BASE-EAP-EAP_LOCKDOWN_LOCKOUT_PROCEDURES',
  'EAP',
  'EAP_LOCKDOWN_LOCKOUT_PROCEDURES',
  'Can rooms be secured from within during lockdown?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EAP-EAP_LOCKDOWN_LOCKOUT_PROCEDURES-D2-003',
  'BASE-EAP-EAP_LOCKDOWN_LOCKOUT_PROCEDURES',
  'EAP',
  'EAP_LOCKDOWN_LOCKOUT_PROCEDURES',
  'Are procedures coordinated with local law enforcement?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EAP-EAP_MUSTER_POINTS_RALLY_AREAS-D2-001',
  'BASE-EAP-EAP_MUSTER_POINTS_RALLY_AREAS',
  'EAP',
  'EAP_MUSTER_POINTS_RALLY_AREAS',
  'Are muster locations outside known blast, debris, or vehicle paths?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EAP-EAP_MUSTER_POINTS_RALLY_AREAS-D2-002',
  'BASE-EAP-EAP_MUSTER_POINTS_RALLY_AREAS',
  'EAP',
  'EAP_MUSTER_POINTS_RALLY_AREAS',
  'Is signage present and visible from evacuation routes?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EAP-EAP_MUSTER_POINTS_RALLY_AREAS-D2-003',
  'BASE-EAP-EAP_MUSTER_POINTS_RALLY_AREAS',
  'EAP',
  'EAP_MUSTER_POINTS_RALLY_AREAS',
  'Are staff trained and drilled on evacuation and assembly procedures?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EAP-EAP_SHELTER_IN_PLACE-D2-001',
  'BASE-EAP-EAP_SHELTER_IN_PLACE',
  'EAP',
  'EAP_SHELTER_IN_PLACE',
  'Do you have separate guidance for weather, chemical, and community-threat scenarios?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EAP-EAP_STAFF_EMERGENCY_ROLES-D2-001',
  'BASE-EAP-EAP_STAFF_EMERGENCY_ROLES',
  'EAP',
  'EAP_STAFF_EMERGENCY_ROLES',
  'Are roles documented and accessible to all personnel?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EAP-EAP_STAFF_EMERGENCY_ROLES-D2-002',
  'BASE-EAP-EAP_STAFF_EMERGENCY_ROLES',
  'EAP',
  'EAP_STAFF_EMERGENCY_ROLES',
  'Are backups assigned for each critical position?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EAP-EAP_STAFF_EMERGENCY_ROLES-D2-003',
  'BASE-EAP-EAP_STAFF_EMERGENCY_ROLES',
  'EAP',
  'EAP_STAFF_EMERGENCY_ROLES',
  'Do staff understand decision authority and communications protocols?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EMR-EMR_BUSINESS_CONTINUITY-D2-001',
  'BASE-EMR-EMR_BUSINESS_CONTINUITY',
  'EMR',
  'EMR_BUSINESS_CONTINUITY',
  'Does the continuity plan involve external partners and suppliers?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EMR-EMR_CRISIS_MANAGEMENT-D2-001',
  'BASE-EMR-EMR_CRISIS_MANAGEMENT',
  'EMR',
  'EMR_CRISIS_MANAGEMENT',
  'Do you integrate external agencies into your planning?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EMR-EMR_EMERGENCY_COMMUNICATIONS-D2-001',
  'BASE-EMR-EMR_EMERGENCY_COMMUNICATIONS',
  'EMR',
  'EMR_EMERGENCY_COMMUNICATIONS',
  'Are templates or pre-scripted messages prepared?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EMR-EMR_ICS_NIMS_INTEGRATION-D2-001',
  'BASE-EMR-EMR_ICS_NIMS_INTEGRATION',
  'EMR',
  'EMR_ICS_NIMS_INTEGRATION',
  'Are staff assigned facility-level ICS roles and trained in those roles?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EMR-EMR_ICS_NIMS_INTEGRATION-D2-002',
  'BASE-EMR-EMR_ICS_NIMS_INTEGRATION',
  'EMR',
  'EMR_ICS_NIMS_INTEGRATION',
  'Is there a process for establishing unified command with responders?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EMR-EMR_ICS_NIMS_INTEGRATION-D2-003',
  'BASE-EMR-EMR_ICS_NIMS_INTEGRATION',
  'EMR',
  'EMR_ICS_NIMS_INTEGRATION',
  'Do emergency plans use ICS terminology for clarity and compatibility?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EMR-EMR_MASS_NOTIFICATION-D2-001',
  'BASE-EMR-EMR_MASS_NOTIFICATION',
  'EMR',
  'EMR_MASS_NOTIFICATION',
  'Do you have redundancy across audible, visual, and digital alerting?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EMR-EMR_MASS_NOTIFICATION-D2-002',
  'BASE-EMR-EMR_MASS_NOTIFICATION',
  'EMR',
  'EMR_MASS_NOTIFICATION',
  'Do alerts integrate with any automation or lockdown measures?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EMR-EMR_REDUNDANCY_BACKUP_SYSTEMS-D2-001',
  'BASE-EMR-EMR_REDUNDANCY_BACKUP_SYSTEMS',
  'EMR',
  'EMR_REDUNDANCY_BACKUP_SYSTEMS',
  'Are security systems isolated from IT single points of failure?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EMR-EMR_RESILIENCE_PLANNING-D2-001',
  'BASE-EMR-EMR_RESILIENCE_PLANNING',
  'EMR',
  'EMR_RESILIENCE_PLANNING',
  'Do you have documented continuity or resilience plans?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-EMR-EMR_RESILIENCE_PLANNING-D2-002',
  'BASE-EMR-EMR_RESILIENCE_PLANNING',
  'EMR',
  'EMR_RESILIENCE_PLANNING',
  'Have you coordinated plans with local emergency management or utilities?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-FAC-FAC_BALLISTIC_BARRIERS-D2-001',
  'BASE-FAC-FAC_BALLISTIC_BARRIERS',
  'FAC',
  'FAC_BALLISTIC_BARRIERS',
  'Do barriers provide continuous protection (no open seams)?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-FAC-FAC_BALLISTIC_BARRIERS-D2-002',
  'BASE-FAC-FAC_BALLISTIC_BARRIERS',
  'FAC',
  'FAC_BALLISTIC_BARRIERS',
  'Are reception or guard staff trained on barrier use and positioning?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-FAC-FAC_BALLISTIC_BARRIERS-D2-003',
  'BASE-FAC-FAC_BALLISTIC_BARRIERS',
  'FAC',
  'FAC_BALLISTIC_BARRIERS',
  'Is Were barriers installed by certified personnel?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-FAC-FAC_BALLISTIC_BARRIERS-D2-004',
  'BASE-FAC-FAC_BALLISTIC_BARRIERS',
  'FAC',
  'FAC_BALLISTIC_BARRIERS',
  'Do barriers align with identified threat levels in the risk assessment?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  4
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-FAC-FAC_BLAST_MITIGATION-D2-001',
  'BASE-FAC-FAC_BLAST_MITIGATION',
  'FAC',
  'FAC_BLAST_MITIGATION',
  'Have any protective measures (glazing, structural detailing, stand-off barriers) been designed by qualified engineers?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-FAC-FAC_BLAST_MITIGATION-D2-002',
  'BASE-FAC-FAC_BLAST_MITIGATION',
  'FAC',
  'FAC_BLAST_MITIGATION',
  'Have blast effects been considered in continuity and mass-casualty planning?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-FAC-FAC_EXTERIOR_WALL_REINFORCEMENT-D2-001',
  'BASE-FAC-FAC_EXTERIOR_WALL_REINFORCEMENT',
  'FAC',
  'FAC_EXTERIOR_WALL_REINFORCEMENT',
  'Have walls near public approaches been evaluated for forced entry, ballistic, or blast resistance as appropriate?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-FAC-FAC_EXTERIOR_WALL_REINFORCEMENT-D2-002',
  'BASE-FAC-FAC_EXTERIOR_WALL_REINFORCEMENT',
  'FAC',
  'FAC_EXTERIOR_WALL_REINFORCEMENT',
  'Are there weak points such as louvers, access hatches, or penetrations that undermine overall wall performance?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-FAC-FAC_EXTERIOR_WALL_REINFORCEMENT-D2-003',
  'BASE-FAC-FAC_EXTERIOR_WALL_REINFORCEMENT',
  'FAC',
  'FAC_EXTERIOR_WALL_REINFORCEMENT',
  'Have structural or security engineers reviewed exterior wall conditions during major projects?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-FAC-FAC_IMPACT_RESISTANT_GLAZING-D2-001',
  'BASE-FAC-FAC_IMPACT_RESISTANT_GLAZING',
  'FAC',
  'FAC_IMPACT_RESISTANT_GLAZING',
  'Are the surrounding frames reinforced consistent with the glazing?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-FAC-FAC_IMPACT_RESISTANT_GLAZING-D2-002',
  'BASE-FAC-FAC_IMPACT_RESISTANT_GLAZING',
  'FAC',
  'FAC_IMPACT_RESISTANT_GLAZING',
  'Do access points have continuous hardening across all adjacent panes?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-FAC-FAC_IMPACT_RESISTANT_GLAZING-D2-003',
  'BASE-FAC-FAC_IMPACT_RESISTANT_GLAZING',
  'FAC',
  'FAC_IMPACT_RESISTANT_GLAZING',
  'Is glazing included in your forced-entry and storm hardening strategy?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-FAC-FAC_STRUCTURAL_HARDENING-D2-001',
  'BASE-FAC-FAC_STRUCTURAL_HARDENING',
  'FAC',
  'FAC_STRUCTURAL_HARDENING',
  'Do structural upgrades align with the threat assessment?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-FAC-FAC_STRUCTURAL_HARDENING-D2-002',
  'BASE-FAC-FAC_STRUCTURAL_HARDENING',
  'FAC',
  'FAC_STRUCTURAL_HARDENING',
  'Is Was an engineer involved in evaluating wall, ceiling, and floor strength?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-FAC-FAC_STRUCTURAL_HARDENING-D2-003',
  'BASE-FAC-FAC_STRUCTURAL_HARDENING',
  'FAC',
  'FAC_STRUCTURAL_HARDENING',
  'Has hardening been maintained through renovations?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-FAC-FAC_WINDOW_FILM-D2-001',
  'BASE-FAC-FAC_WINDOW_FILM',
  'FAC',
  'FAC_WINDOW_FILM',
  'Is film applied to all glazing within reach or just selected panes?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-FAC-FAC_WINDOW_FILM-D2-002',
  'BASE-FAC-FAC_WINDOW_FILM',
  'FAC',
  'FAC_WINDOW_FILM',
  'Are maintenance and inspection procedures documented?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-FAC-FAC_WINDOW_FILM-D2-003',
  'BASE-FAC-FAC_WINDOW_FILM',
  'FAC',
  'FAC_WINDOW_FILM',
  'Is Was film part of a risk-informed glazing strategy?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-IDS-IDS_ALARM_MONITORING-D2-001',
  'BASE-IDS-IDS_ALARM_MONITORING',
  'IDS',
  'IDS_ALARM_MONITORING',
  'Do you receive and review detailed alarm activity reports?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-IDS-IDS_ALARM_PANELS-D2-001',
  'BASE-IDS-IDS_ALARM_PANELS',
  'IDS',
  'IDS_ALARM_PANELS',
  'Is there a current, accurate zone list mapped to floor plans?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-IDS-IDS_DOOR_CONTACTS-D2-001',
  'BASE-IDS-IDS_DOOR_CONTACTS',
  'IDS',
  'IDS_DOOR_CONTACTS',
  'Is intrusion monitoring provided on-site, off-site, or both?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-IDS-IDS_GLASS_BREAK_SENSORS-D2-001',
  'BASE-IDS-IDS_GLASS_BREAK_SENSORS',
  'IDS',
  'IDS_GLASS_BREAK_SENSORS',
  'Does the facility rely solely on window locks without detection?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-IDS-IDS_MOTION_DETECTORS-D2-001',
  'BASE-IDS-IDS_MOTION_DETECTORS',
  'IDS',
  'IDS_MOTION_DETECTORS',
  'Are dual-tech sensors installed in environmentally unstable areas?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-IDS-IDS_MOTION_DETECTORS-D2-002',
  'BASE-IDS-IDS_MOTION_DETECTORS',
  'IDS',
  'IDS_MOTION_DETECTORS',
  'Is sensor coverage mapped and documented?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-IDS-IDS_PERIMETER_IDS-D2-001',
  'BASE-IDS-IDS_PERIMETER_IDS',
  'IDS',
  'IDS_PERIMETER_IDS',
  'Are PIDS events correlated with cameras, lighting, and guard patrol routes?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'INT-001-D2-001',
  'INT-001',
  'INT',
  'INT_ACCESS_RESTRICTED_AREAS',
  'Are these spaces monitored with cameras or sensors?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'INT-001-D2-002',
  'INT-001',
  'INT',
  'INT_ACCESS_RESTRICTED_AREAS',
  'Do staff understand their responsibilities within restricted zones?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-INT-INT_HARD_INTERIOR_BARRIERS-D2-001',
  'BASE-INT-INT_HARD_INTERIOR_BARRIERS',
  'INT',
  'INT_HARD_INTERIOR_BARRIERS',
  'Do walls extend to the true ceiling or deck above?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-INT-INT_HARD_INTERIOR_BARRIERS-D2-002',
  'BASE-INT-INT_HARD_INTERIOR_BARRIERS',
  'INT',
  'INT_HARD_INTERIOR_BARRIERS',
  'Are high-value rooms reinforced or hardened?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-INT-INT_HARD_INTERIOR_BARRIERS-D2-003',
  'BASE-INT-INT_HARD_INTERIOR_BARRIERS',
  'INT',
  'INT_HARD_INTERIOR_BARRIERS',
  'Is Were barrier requirements considered during renovations?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-INT-INT_INTERIOR_DOORS-D2-001',
  'BASE-INT-INT_INTERIOR_DOORS',
  'INT',
  'INT_INTERIOR_DOORS',
  'Do interior doors critical to security consistently latch?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-INT-INT_INTERIOR_DOORS-D2-002',
  'BASE-INT-INT_INTERIOR_DOORS',
  'INT',
  'INT_INTERIOR_DOORS',
  'Are sensitive rooms protected by appropriate door construction?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-INT-INT_INTERIOR_DOORS-D2-003',
  'BASE-INT-INT_INTERIOR_DOORS',
  'INT',
  'INT_INTERIOR_DOORS',
  'Are closers, hinges, and strikes functioning properly?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-INT-INT_INTERIOR_DOORS-D2-004',
  'BASE-INT-INT_INTERIOR_DOORS',
  'INT',
  'INT_INTERIOR_DOORS',
  'Is there a routine inspection or maintenance schedule?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  4
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-INT-INT_INTERIOR_LIGHTING-D2-001',
  'BASE-INT-INT_INTERIOR_LIGHTING',
  'INT',
  'INT_INTERIOR_LIGHTING',
  'Is lighting coordinated with camera coverage and image clarity?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-INT-INT_INTERIOR_LIGHTING-D2-002',
  'BASE-INT-INT_INTERIOR_LIGHTING',
  'INT',
  'INT_INTERIOR_LIGHTING',
  'Are lighting repairs completed promptly?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-INT-INT_INTERIOR_LIGHTING-D2-003',
  'BASE-INT-INT_INTERIOR_LIGHTING',
  'INT',
  'INT_INTERIOR_LIGHTING',
  'Do sensors or timers inadvertently leave critical areas dark?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-INT-INT_INTERIOR_LIGHTING-D2-004',
  'BASE-INT-INT_INTERIOR_LIGHTING',
  'INT',
  'INT_INTERIOR_LIGHTING',
  'Are stairwells and emergency routes well illuminated at all hours?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  4
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-INT-INT_SECURE_ROOMS-D2-001',
  'BASE-INT-INT_SECURE_ROOMS',
  'INT',
  'INT_SECURE_ROOMS',
  'Have you assessed alternative attack paths (e.g., ceiling, adjacent rooms, glazing)?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-INT-INT_SENSITIVE_ITEM_STORAGE-D2-001',
  'BASE-INT-INT_SENSITIVE_ITEM_STORAGE',
  'INT',
  'INT_SENSITIVE_ITEM_STORAGE',
  'Do you maintain inventories, sign-out logs, or electronic tracking?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-INT-INT_SENSITIVE_ITEM_STORAGE-D2-002',
  'BASE-INT-INT_SENSITIVE_ITEM_STORAGE',
  'INT',
  'INT_SENSITIVE_ITEM_STORAGE',
  'Have you experienced losses or unexplained discrepancies in sensitive items?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ISC-ISC_COORDINATION_PROTOCOLS-D2-001',
  'BASE-ISC-ISC_COORDINATION_PROTOCOLS',
  'ISC',
  'ISC_COORDINATION_PROTOCOLS',
  'Do you have MOUs, letters of agreement, or documented expectations with them?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ISC-ISC_COORDINATION_PROTOCOLS-D2-002',
  'BASE-ISC-ISC_COORDINATION_PROTOCOLS',
  'ISC',
  'ISC_COORDINATION_PROTOCOLS',
  'Do you hold joint after-action reviews and implement shared improvements?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ISC-ISC_FUSION_CENTER_INTERFACE-D2-001',
  'BASE-ISC-ISC_FUSION_CENTER_INTERFACE',
  'ISC',
  'ISC_FUSION_CENTER_INTERFACE',
  'Are you currently connected to a state or regional fusion center?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ISC-ISC_FUSION_CENTER_INTERFACE-D2-002',
  'BASE-ISC-ISC_FUSION_CENTER_INTERFACE',
  'ISC',
  'ISC_FUSION_CENTER_INTERFACE',
  'Have you ever sent information back to the fusion center?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ISC-ISC_ISAC_ISAOS-D2-001',
  'BASE-ISC-ISC_ISAC_ISAOS',
  'ISC',
  'ISC_ISAC_ISAOS',
  'Are you a member of, or connected to, any sector ISAC or ISAO?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ISC-ISC_ISAC_ISAOS-D2-002',
  'BASE-ISC-ISC_ISAC_ISAOS',
  'ISC',
  'ISC_ISAC_ISAOS',
  'Can you give examples of changes made based on ISAC/ISAO information?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ISC-ISC_ISAC_ISAOS-D2-003',
  'BASE-ISC-ISC_ISAC_ISAOS',
  'ISC',
  'ISC_ISAC_ISAOS',
  'Do you ever provide incident or near-miss information back to the ISAC/ISAO?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ISC-ISC_JTTF_ENGAGEMENT-D2-001',
  'BASE-ISC-ISC_JTTF_ENGAGEMENT',
  'ISC',
  'ISC_JTTF_ENGAGEMENT',
  'Is Given your facility’s profile, have you engaged with the local FBI or JTTF?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ISC-ISC_JTTF_ENGAGEMENT-D2-002',
  'BASE-ISC-ISC_JTTF_ENGAGEMENT',
  'ISC',
  'ISC_JTTF_ENGAGEMENT',
  'Have you received or requested terrorism-related briefings tailored to your sector?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ISC-ISC_JTTF_ENGAGEMENT-D2-003',
  'BASE-ISC-ISC_JTTF_ENGAGEMENT',
  'ISC',
  'ISC_JTTF_ENGAGEMENT',
  'Can you cite any procedural or physical changes driven by JTTF-related threat information?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ISC-ISC_LAW_ENFORCEMENT_LIAISON-D2-001',
  'BASE-ISC-ISC_LAW_ENFORCEMENT_LIAISON',
  'ISC',
  'ISC_LAW_ENFORCEMENT_LIAISON',
  'Have they toured the facility or reviewed floor plans?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-ISC-ISC_LAW_ENFORCEMENT_LIAISON-D2-002',
  'BASE-ISC-ISC_LAW_ENFORCEMENT_LIAISON',
  'ISC',
  'ISC_LAW_ENFORCEMENT_LIAISON',
  'Are they involved in your emergency drills or planning processes?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-KEY-KEY_KEY_CABINETS-D2-001',
  'BASE-KEY-KEY_KEY_CABINETS',
  'KEY',
  'KEY_KEY_CABINETS',
  'Do you maintain a master key matrix and update it after changes?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-KEY-KEY_KEY_CABINETS-D2-002',
  'BASE-KEY-KEY_KEY_CABINETS',
  'KEY',
  'KEY_KEY_CABINETS',
  'Are high-security or restricted keys stored separately?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-KEY-KEY_KEY_LOGS_ACCOUNTABILITY-D2-001',
  'BASE-KEY-KEY_KEY_LOGS_ACCOUNTABILITY',
  'KEY',
  'KEY_KEY_LOGS_ACCOUNTABILITY',
  'Do logs include purpose, time, and responsible individual?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-KEY-KEY_MASTER_KEY_MANAGEMENT-D2-001',
  'BASE-KEY-KEY_MASTER_KEY_MANAGEMENT',
  'KEY',
  'KEY_MASTER_KEY_MANAGEMENT',
  'Are contractors allowed key access without oversight?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-KEY-KEY_MASTER_KEY_MANAGEMENT-D2-002',
  'BASE-KEY-KEY_MASTER_KEY_MANAGEMENT',
  'KEY',
  'KEY_MASTER_KEY_MANAGEMENT',
  'Are high-security keys used for sensitive areas?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-KEY-KEY_REKEYING_PROCEDURES-D2-001',
  'BASE-KEY-KEY_REKEYING_PROCEDURES',
  'KEY',
  'KEY_REKEYING_PROCEDURES',
  'Are access control systems updated in parallel with mechanical changes?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-KEY-KEY_RESTRICTED_KEYS-D2-001',
  'BASE-KEY-KEY_RESTRICTED_KEYS',
  'KEY',
  'KEY_RESTRICTED_KEYS',
  'Do you use patented or restricted keyways to prevent unauthorized duplication?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-PER-PER_BOLLARDS_BARRIERS-D2-001',
  'BASE-PER-PER_BOLLARDS_BARRIERS',
  'PER',
  'PER_BOLLARDS_BARRIERS',
  'Are there gaps or flanking paths around installed barriers?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-PER-PER_BOLLARDS_BARRIERS-D2-002',
  'BASE-PER-PER_BOLLARDS_BARRIERS',
  'PER',
  'PER_BOLLARDS_BARRIERS',
  'Do barriers interfere with emergency vehicle access?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-PER-PER_BOUNDARY_DEMARCATION-D2-001',
  'BASE-PER-PER_BOUNDARY_DEMARCATION',
  'PER',
  'PER_BOUNDARY_DEMARCATION',
  'Are restricted boundaries consistently marked and maintained?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-PER-PER_CLEAR_ZONES-D2-001',
  'BASE-PER-PER_CLEAR_ZONES',
  'PER',
  'PER_CLEAR_ZONES',
  'Is vegetation controlled to maintain full visibility of the fence line?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-PER-PER_CLEAR_ZONES-D2-002',
  'BASE-PER-PER_CLEAR_ZONES',
  'PER',
  'PER_CLEAR_ZONES',
  'Are maintenance crews aware of security clear zone requirements?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-PER-PER_CLEAR_ZONES-D2-003',
  'BASE-PER-PER_CLEAR_ZONES',
  'PER',
  'PER_CLEAR_ZONES',
  'Do cameras and lighting have unobstructed views along the perimeter?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-PER-PER_GATES-D2-001',
  'BASE-PER-PER_GATES',
  'PER',
  'PER_GATES',
  'Is there a verification step before opening?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-PER-PER_GATES-D2-002',
  'BASE-PER-PER_GATES',
  'PER',
  'PER_GATES',
  'Are gates monitored by cameras or sensors?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-PER-PER_GATES-D2-003',
  'BASE-PER-PER_GATES',
  'PER',
  'PER_GATES',
  'Are gate operators inspected and maintained routinely?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-PER-PER_PERIMETER_LIGHTING-D2-001',
  'BASE-PER-PER_PERIMETER_LIGHTING',
  'PER',
  'PER_PERIMETER_LIGHTING',
  'Have you performed a nighttime walk-through recently?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-PER-PER_PERIMETER_LIGHTING-D2-002',
  'BASE-PER-PER_PERIMETER_LIGHTING',
  'PER',
  'PER_PERIMETER_LIGHTING',
  'Is lighting coordinated with camera placement and guard patrols?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-PER-PER_PERIMETER_LIGHTING-D2-003',
  'BASE-PER-PER_PERIMETER_LIGHTING',
  'PER',
  'PER_PERIMETER_LIGHTING',
  'Are critical access points illuminated during power loss?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-PER-PER_PERIMETER_SIGNAGE-D2-001',
  'BASE-PER-PER_PERIMETER_SIGNAGE',
  'PER',
  'PER_PERIMETER_SIGNAGE',
  'Do perimeter signs clearly indicate restricted areas and entry points?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-PER-PER_PERIMETER_SIGNAGE-D2-002',
  'BASE-PER-PER_PERIMETER_SIGNAGE',
  'PER',
  'PER_PERIMETER_SIGNAGE',
  'Are signs reflective and visible under nighttime conditions?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-PER-PER_PERIMETER_SIGNAGE-D2-003',
  'BASE-PER-PER_PERIMETER_SIGNAGE',
  'PER',
  'PER_PERIMETER_SIGNAGE',
  'Is signage consistent in design, language, and placement?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-PER-PER_PERIMETER_SIGNAGE-D2-004',
  'BASE-PER-PER_PERIMETER_SIGNAGE',
  'PER',
  'PER_PERIMETER_SIGNAGE',
  'Do signs support legal enforcement of trespassing or restricted access?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  4
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-PER-PER_PERIMETER_SIGNAGE-D2-005',
  'BASE-PER-PER_PERIMETER_SIGNAGE',
  'PER',
  'PER_PERIMETER_SIGNAGE',
  'Is vegetation maintained to preserve sign visibility?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  5
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-PER-001-D2-001',
  'BASE-PER-001',
  'PER',
  'PER_VEHICLE_ACCESS_CONTROL_POINTS',
  'Do guards have protected positions and clear lines of sight?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-PER-001-D2-002',
  'BASE-PER-001',
  'PER',
  'PER_VEHICLE_ACCESS_CONTROL_POINTS',
  'Are VACPs monitored by cameras and access logs?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-SFO-SFO_GUARD_POSTS-D2-001',
  'BASE-SFO-SFO_GUARD_POSTS',
  'SFO',
  'SFO_GUARD_POSTS',
  'Are there written post orders and do guards know them without prompting?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-SFO-SFO_INCIDENT_REPORTING-D2-001',
  'BASE-SFO-SFO_INCIDENT_REPORTING',
  'SFO',
  'SFO_INCIDENT_REPORTING',
  'Do you track near-misses, suspicious activity, and minor events, or only major incidents?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-SFO-SFO_PATROL_ROUTES-D2-001',
  'BASE-SFO-SFO_PATROL_ROUTES',
  'SFO',
  'SFO_PATROL_ROUTES',
  'Do patrols vary timing and direction to avoid predictability?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-SFO-SFO_RADIO_COMMUNICATIONS-D2-001',
  'BASE-SFO-SFO_RADIO_COMMUNICATIONS',
  'SFO',
  'SFO_RADIO_COMMUNICATIONS',
  'Do you have a dedicated emergency radio channel?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-SFO-SFO_RADIO_COMMUNICATIONS-D2-002',
  'BASE-SFO-SFO_RADIO_COMMUNICATIONS',
  'SFO',
  'SFO_RADIO_COMMUNICATIONS',
  'Do you practice structured radio communication during drills?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-SFO-SFO_RESPONSE_PROCEDURES-D2-001',
  'BASE-SFO-SFO_RESPONSE_PROCEDURES',
  'SFO',
  'SFO_RESPONSE_PROCEDURES',
  'Are there clear, role-based responsibilities for each type of incident?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-SFO-SFO_SCHOOL_RESOURCE_OFFICER_SRO-D2-001',
  'BASE-SFO-SFO_SCHOOL_RESOURCE_OFFICER_SRO',
  'SFO',
  'SFO_SCHOOL_RESOURCE_OFFICER_SRO',
  'Do you have a current MOU that outlines the SRO’s mission, authority, and limitations?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-SFO-SFO_SECURITY_OFFICER_TRAINING-D2-001',
  'BASE-SFO-SFO_SECURITY_OFFICER_TRAINING',
  'SFO',
  'SFO_SECURITY_OFFICER_TRAINING',
  'Do officers participate in drills, exercises, or after-action reviews?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-SMG-SMG_POLICY_COMPLIANCE_TRACKING-D2-001',
  'BASE-SMG-SMG_POLICY_COMPLIANCE_TRACKING',
  'SMG',
  'SMG_POLICY_COMPLIANCE_TRACKING',
  'Are compliance responsibilities assigned by role?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-SMG-SMG_POLICY_COMPLIANCE_TRACKING-D2-002',
  'BASE-SMG-SMG_POLICY_COMPLIANCE_TRACKING',
  'SMG',
  'SMG_POLICY_COMPLIANCE_TRACKING',
  'Do compliance findings drive procedural or policy changes?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-SMG-SMG_RISK_ASSESSMENT_RISK_MANAGEMENT-D2-001',
  'BASE-SMG-SMG_RISK_ASSESSMENT_RISK_MANAGEMENT',
  'SMG',
  'SMG_RISK_ASSESSMENT_RISK_MANAGEMENT',
  'Do you revisit risk after major changes in layout, occupancy, or threat environment?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-SMG-SMG_SECURITY_DOCUMENTATION-D2-001',
  'BASE-SMG-SMG_SECURITY_DOCUMENTATION',
  'SMG',
  'SMG_SECURITY_DOCUMENTATION',
  'Can you quickly provide responders with relevant documentation during an incident?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-SMG-SMG_SECURITY_POLICIES-D2-001',
  'BASE-SMG-SMG_SECURITY_POLICIES',
  'SMG',
  'SMG_SECURITY_POLICIES',
  'Do you track and respond to repeated policy violations?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-SMG-SMG_SECURITY_PROCEDURES-D2-001',
  'BASE-SMG-SMG_SECURITY_PROCEDURES',
  'SMG',
  'SMG_SECURITY_PROCEDURES',
  'Do you maintain written procedures for routine security tasks and common incidents?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-SMG-SMG_SECURITY_PROCEDURES-D2-002',
  'BASE-SMG-SMG_SECURITY_PROCEDURES',
  'SMG',
  'SMG_SECURITY_PROCEDURES',
  'Do you test and refine procedures through drills and after-action reviews?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-SMG-SMG_SECURITY_TRAINING_PROGRAMS-D2-001',
  'BASE-SMG-SMG_SECURITY_TRAINING_PROGRAMS',
  'SMG',
  'SMG_SECURITY_TRAINING_PROGRAMS',
  'Can you point to a training change that resulted from an incident or exercise?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_ANALYTICS_BEHAVIOR_DETECTION-D2-001',
  'BASE-VSS-VSS_ANALYTICS_BEHAVIOR_DETECTION',
  'VSS',
  'VSS_ANALYTICS_BEHAVIOR_DETECTION',
  'Are alerts reviewed and validated by operators?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_ANALYTICS_BEHAVIOR_DETECTION-D2-002',
  'BASE-VSS-VSS_ANALYTICS_BEHAVIOR_DETECTION',
  'VSS',
  'VSS_ANALYTICS_BEHAVIOR_DETECTION',
  'Do camera positions support the analytic functions?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_ANALYTICS_BEHAVIOR_DETECTION-D2-003',
  'BASE-VSS-VSS_ANALYTICS_BEHAVIOR_DETECTION',
  'VSS',
  'VSS_ANALYTICS_BEHAVIOR_DETECTION',
  'Are false alarm rates tracked and managed?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_CAMERA_COVERAGE_LINE_OF_SIGHT-D2-001',
  'BASE-VSS-VSS_CAMERA_COVERAGE_LINE_OF_SIGHT',
  'VSS',
  'VSS_CAMERA_COVERAGE_LINE_OF_SIGHT',
  'Do you have documented coverage maps or audits?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_CAMERA_COVERAGE_LINE_OF_SIGHT-D2-002',
  'BASE-VSS-VSS_CAMERA_COVERAGE_LINE_OF_SIGHT',
  'VSS',
  'VSS_CAMERA_COVERAGE_LINE_OF_SIGHT',
  'Do cameras capture faces at entry points?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-001-D2-001',
  'BASE-VSS-001',
  'VSS',
  'VSS_EXTERIOR_CAMERAS',
  'Is coverage continuous around the building perimeter?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-001-D2-002',
  'BASE-VSS-001',
  'VSS',
  'VSS_EXTERIOR_CAMERAS',
  'Is exterior lighting supporting camera image quality?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_FIXED_CAMERAS-D2-001',
  'BASE-VSS-VSS_FIXED_CAMERAS',
  'VSS',
  'VSS_FIXED_CAMERAS',
  'Are fixed cameras capturing their intended coverage area?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_FIXED_CAMERAS-D2-002',
  'BASE-VSS-VSS_FIXED_CAMERAS',
  'VSS',
  'VSS_FIXED_CAMERAS',
  'Is the image quality sufficient for identification tasks?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_FIXED_CAMERAS-D2-003',
  'BASE-VSS-VSS_FIXED_CAMERAS',
  'VSS',
  'VSS_FIXED_CAMERAS',
  'Do cameras provide reliable nighttime performance?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-002-D2-001',
  'BASE-VSS-002',
  'VSS',
  'VSS_INTERIOR_CAMERAS',
  'Do cameras capture clear facial images at main interior entries and reception points?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-002-D2-002',
  'BASE-VSS-002',
  'VSS',
  'VSS_INTERIOR_CAMERAS',
  'Are interior camera locations documented and tied to floor plans or SOC displays?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_IP_CAMERAS-D2-001',
  'BASE-VSS-VSS_IP_CAMERAS',
  'VSS',
  'VSS_IP_CAMERAS',
  'Do you review video proactively (e.g., after alarms) or only after major incidents?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_MONITORING_WORKSTATIONS-D2-001',
  'BASE-VSS-VSS_MONITORING_WORKSTATIONS',
  'VSS',
  'VSS_MONITORING_WORKSTATIONS',
  'Is workstation access restricted to authorized personnel?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_MONITORING_WORKSTATIONS-D2-002',
  'BASE-VSS-VSS_MONITORING_WORKSTATIONS',
  'VSS',
  'VSS_MONITORING_WORKSTATIONS',
  'Is the operator-to-camera ratio within recognized limits?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_MONITORING_WORKSTATIONS-D2-003',
  'BASE-VSS-VSS_MONITORING_WORKSTATIONS',
  'VSS',
  'VSS_MONITORING_WORKSTATIONS',
  'Are alarms logged, escalated, and reviewed?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_MONITORING_WORKSTATIONS-D2-004',
  'BASE-VSS-VSS_MONITORING_WORKSTATIONS',
  'VSS',
  'VSS_MONITORING_WORKSTATIONS',
  'Is the workstation ergonomically designed to reduce fatigue?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  4
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_MONITORING_WORKSTATIONS-D2-005',
  'BASE-VSS-VSS_MONITORING_WORKSTATIONS',
  'VSS',
  'VSS_MONITORING_WORKSTATIONS',
  'Is there a backup console or secondary monitoring point?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  5
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_PTZ_CAMERAS-D2-001',
  'BASE-VSS-VSS_PTZ_CAMERAS',
  'VSS',
  'VSS_PTZ_CAMERAS',
  'Do operators actively control PTZs during incidents?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_PTZ_CAMERAS-D2-002',
  'BASE-VSS-VSS_PTZ_CAMERAS',
  'VSS',
  'VSS_PTZ_CAMERAS',
  'Are PTZ presets linked to access control or intrusion alarms?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_PTZ_CAMERAS-D2-003',
  'BASE-VSS-VSS_PTZ_CAMERAS',
  'VSS',
  'VSS_PTZ_CAMERAS',
  'Are PTZs protected from tampering or repositioning?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-003-D2-001',
  'BASE-VSS-003',
  'VSS',
  'VSS_RECORDING_STORAGE_NVR_DVR',
  'Do you have full recording coverage for critical cameras?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-003-D2-002',
  'BASE-VSS-003',
  'VSS',
  'VSS_RECORDING_STORAGE_NVR_DVR',
  'Do you test the recovery and export process periodically?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_VIDEO_WALL_DISPLAY_SYSTEMS-D2-001',
  'BASE-VSS-VSS_VIDEO_WALL_DISPLAY_SYSTEMS',
  'VSS',
  'VSS_VIDEO_WALL_DISPLAY_SYSTEMS',
  'Are video walls configured to highlight critical alarms?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  1
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_VIDEO_WALL_DISPLAY_SYSTEMS-D2-002',
  'BASE-VSS-VSS_VIDEO_WALL_DISPLAY_SYSTEMS',
  'VSS',
  'VSS_VIDEO_WALL_DISPLAY_SYSTEMS',
  'Do operators rely on the video wall for real monitoring?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  2
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_VIDEO_WALL_DISPLAY_SYSTEMS-D2-003',
  'BASE-VSS-VSS_VIDEO_WALL_DISPLAY_SYSTEMS',
  'VSS',
  'VSS_VIDEO_WALL_DISPLAY_SYSTEMS',
  'Are camera layouts organized by zones or risk areas?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  3
) ON CONFLICT (question_code) DO NOTHING;

INSERT INTO public.baseline_questions (
  question_code,
  parent_spine_canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  layer,
  depth,
  order_index
) VALUES (
  'BASE-VSS-VSS_VIDEO_WALL_DISPLAY_SYSTEMS-D2-004',
  'BASE-VSS-VSS_VIDEO_WALL_DISPLAY_SYSTEMS',
  'VSS',
  'VSS_VIDEO_WALL_DISPLAY_SYSTEMS',
  'Are lighting and ergonomics supportive of long-duration monitoring?',
  '["YES","NO","N_A"]'::jsonb,
  'baseline',
  2,
  4
) ON CONFLICT (question_code) DO NOTHING;
