-- Baseline Subtype v1 Seed Script
-- Generated: 2026-04-02T02:47:25.070Z
-- Seed Mode: PRESERVE_EXISTING
-- Total spines: 104

-- PRESERVE_EXISTING mode: Existing subtype spines are preserved.
-- This script uses INSERT ... ON CONFLICT DO UPDATE but preserves question_text.
-- Only new subtype spines will be inserted; existing question_text is not updated.

BEGIN;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-ACS-ACS_BIOMETRIC_ACCESS',
  'ACS',
  'ACS_BIOMETRIC_ACCESS',
  'Is biometric authentication used to grant entry at controlled points?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ACS-ACS_BIOMETRIC_ACCESS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-ACS-ACS_CREDENTIAL_BADGE_SYSTEMS',
  'ACS',
  'ACS_CREDENTIAL_BADGE_SYSTEMS',
  'Are credentials or badges used to grant entry at controlled points?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ACS-ACS_CREDENTIAL_BADGE_SYSTEMS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-ACS-ACS_DOOR_MONITORING',
  'ACS',
  'ACS_DOOR_MONITORING',
  'Are doors monitored for forced or unauthorized opening at controlled entry points?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ACS-ACS_DOOR_MONITORING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-ACS-ACS_DOOR_READERS',
  'ACS',
  'ACS_DOOR_READERS',
  'Are door readers installed at controlled entry points?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ACS-ACS_DOOR_READERS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-ACS-ACS_ELECTRIC_STRIKES_MAG_LOCKS',
  'ACS',
  'ACS_ELECTRIC_STRIKES_MAG_LOCKS',
  'Are electric strikes or mag locks installed on controlled doors?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ACS-ACS_ELECTRIC_STRIKES_MAG_LOCKS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-ACS-ACS_ELECTRONIC_ACCESS_CONTROL',
  'ACS',
  'ACS_ELECTRONIC_ACCESS_CONTROL',
  'Is an electronic access control system in use at controlled entry points?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ACS-ACS_ELECTRONIC_ACCESS_CONTROL'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-ACS-ACS_KEYPADS_PIN_ENTRY',
  'ACS',
  'ACS_KEYPADS_PIN_ENTRY',
  'Are keypads or PIN entry devices used at controlled entry points?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ACS-ACS_KEYPADS_PIN_ENTRY'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-ACS-ACS_LOCKING_HARDWARE',
  'ACS',
  'ACS_LOCKING_HARDWARE',
  'Is mechanical locking hardware installed on controlled doors?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ACS-ACS_LOCKING_HARDWARE'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-ACS-ACS_SECURED_VESTIBULES',
  'ACS',
  'ACS_SECURED_VESTIBULES',
  'Are secured vestibules used to separate public and controlled space?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ACS-ACS_SECURED_VESTIBULES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-ACS-ACS_VISITOR_MANAGEMENT_SYSTEMS',
  'ACS',
  'ACS_VISITOR_MANAGEMENT_SYSTEMS',
  'Are visitor management systems used to manage facility entry?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ACS-ACS_VISITOR_MANAGEMENT_SYSTEMS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-COM-COM_BACKUP_COMMUNICATIONS',
  'COM',
  'COM_BACKUP_COMMUNICATIONS',
  'Is there a backup communication method available during outages or incidents?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-COM-COM_BACKUP_COMMUNICATIONS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-COM-COM_COMMUNICATION_PROTOCOLS',
  'COM',
  'COM_COMMUNICATION_PROTOCOLS',
  'Are communication protocols defined for incident coordination?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-COM-COM_COMMUNICATION_PROTOCOLS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-COM-COM_INTEROPERABLE_COMMUNICATIONS',
  'COM',
  'COM_INTEROPERABLE_COMMUNICATIONS',
  'Can communications interoperate with external responders or partner systems?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-COM-COM_INTEROPERABLE_COMMUNICATIONS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-COM-COM_PA_SYSTEMS',
  'COM',
  'COM_PA_SYSTEMS',
  'Are public address systems available to broadcast announcements?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-COM-COM_PA_SYSTEMS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-COM-COM_PAGING_SYSTEMS',
  'COM',
  'COM_PAGING_SYSTEMS',
  'Are paging systems available to broadcast alerts?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-COM-COM_PAGING_SYSTEMS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-COM-COM_RADIOS_TWO_WAY',
  'COM',
  'COM_RADIOS_TWO_WAY',
  'Are two-way radios available for staff coordination?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-COM-COM_RADIOS_TWO_WAY'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-CPTED-CPTED_DEFENSIBLE_SPACE',
  'CPTED',
  'CPTED_DEFENSIBLE_SPACE',
  'Is a Defensible Space capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-CPTED-CPTED_DEFENSIBLE_SPACE'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-CPTED-CPTED_EXTERIOR_LIGHTING',
  'CPTED',
  'CPTED_EXTERIOR_LIGHTING',
  'Is an Exterior Lighting capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-CPTED-CPTED_EXTERIOR_LIGHTING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-CPTED-CPTED_LANDSCAPING_CONTROL',
  'CPTED',
  'CPTED_LANDSCAPING_CONTROL',
  'Is a Landscaping Control capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-CPTED-CPTED_LANDSCAPING_CONTROL'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-CPTED-CPTED_NATURAL_SURVEILLANCE',
  'CPTED',
  'CPTED_NATURAL_SURVEILLANCE',
  'Is a Natural Surveillance capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-CPTED-CPTED_NATURAL_SURVEILLANCE'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-CPTED-CPTED_SIGHTLINES',
  'CPTED',
  'CPTED_SIGHTLINES',
  'Is a Sightlines capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-CPTED-CPTED_SIGHTLINES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-CPTED-CPTED_TERRITORIAL_REINFORCEMENT',
  'CPTED',
  'CPTED_TERRITORIAL_REINFORCEMENT',
  'Is a Territorial Reinforcement capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-CPTED-CPTED_TERRITORIAL_REINFORCEMENT'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-CPTED-CPTED_WAYFINDING',
  'CPTED',
  'CPTED_WAYFINDING',
  'Is a Wayfinding capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-CPTED-CPTED_WAYFINDING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-EAP-EAP_EMERGENCY_DRILLS',
  'EAP',
  'EAP_EMERGENCY_DRILLS',
  'Are emergency drills planned or conducted for the facility?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EAP-EAP_EMERGENCY_DRILLS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-EAP-EAP_EMERGENCY_GUIDES_FLIP_CHARTS',
  'EAP',
  'EAP_EMERGENCY_GUIDES_FLIP_CHARTS',
  'Are emergency guides or flip charts available for staff use?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EAP-EAP_EMERGENCY_GUIDES_FLIP_CHARTS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-EAP-EAP_EVACUATION_PROCEDURES',
  'EAP',
  'EAP_EVACUATION_PROCEDURES',
  'Are evacuation routes and assembly steps documented for the facility?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EAP-EAP_EVACUATION_PROCEDURES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-EAP-EAP_LOCKDOWN_LOCKOUT_PROCEDURES',
  'EAP',
  'EAP_LOCKDOWN_LOCKOUT_PROCEDURES',
  'Are lockdown or lockout steps documented for threats requiring restricted access?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EAP-EAP_LOCKDOWN_LOCKOUT_PROCEDURES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-EAP-EAP_MUSTER_POINTS_RALLY_AREAS',
  'EAP',
  'EAP_MUSTER_POINTS_RALLY_AREAS',
  'Are muster points or rally areas designated for evacuees after departure?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EAP-EAP_MUSTER_POINTS_RALLY_AREAS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-EAP-EAP_REUNIFICATION_PROCEDURES',
  'EAP',
  'EAP_REUNIFICATION_PROCEDURES',
  'Are reunification steps documented for reuniting occupants after an incident?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EAP-EAP_REUNIFICATION_PROCEDURES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-EAP-EAP_SHELTER_IN_PLACE',
  'EAP',
  'EAP_SHELTER_IN_PLACE',
  'Are shelter-in-place steps documented for threats that require occupants to stay inside?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EAP-EAP_SHELTER_IN_PLACE'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-EAP-EAP_STAFF_EMERGENCY_ROLES',
  'EAP',
  'EAP_STAFF_EMERGENCY_ROLES',
  'Are staff responsibilities assigned for emergency response?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EAP-EAP_STAFF_EMERGENCY_ROLES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-EMR-EMR_BUSINESS_CONTINUITY',
  'EMR',
  'EMR_BUSINESS_CONTINUITY',
  'Is continuity of operations planned for facility disruptions?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EMR-EMR_BUSINESS_CONTINUITY'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-EMR-EMR_CRISIS_MANAGEMENT',
  'EMR',
  'EMR_CRISIS_MANAGEMENT',
  'Is crisis management defined for major incidents affecting the facility?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EMR-EMR_CRISIS_MANAGEMENT'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-EMR-EMR_EMERGENCY_COMMUNICATIONS',
  'EMR',
  'EMR_EMERGENCY_COMMUNICATIONS',
  'Is there a defined method to notify occupants during emergencies?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EMR-EMR_EMERGENCY_COMMUNICATIONS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-EMR-EMR_ICS_NIMS_INTEGRATION',
  'EMR',
  'EMR_ICS_NIMS_INTEGRATION',
  'Is incident command or NIMS integration defined for the facility?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EMR-EMR_ICS_NIMS_INTEGRATION'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-EMR-EMR_MASS_NOTIFICATION',
  'EMR',
  'EMR_MASS_NOTIFICATION',
  'Is mass notification available for urgent protective actions?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EMR-EMR_MASS_NOTIFICATION'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-EMR-EMR_REDUNDANCY_BACKUP_SYSTEMS',
  'EMR',
  'EMR_REDUNDANCY_BACKUP_SYSTEMS',
  'Are backup systems defined for critical operations?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EMR-EMR_REDUNDANCY_BACKUP_SYSTEMS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-EMR-EMR_RESILIENCE_PLANNING',
  'EMR',
  'EMR_RESILIENCE_PLANNING',
  'Is resilience planning defined for the facility?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EMR-EMR_RESILIENCE_PLANNING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-FAC-FAC_BALLISTIC_BARRIERS',
  'FAC',
  'FAC_BALLISTIC_BARRIERS',
  'Is a Ballistic Barriers capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-FAC-FAC_BALLISTIC_BARRIERS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-FAC-FAC_BLAST_MITIGATION',
  'FAC',
  'FAC_BLAST_MITIGATION',
  'Is a Blast Mitigation capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-FAC-FAC_BLAST_MITIGATION'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-FAC-FAC_EXTERIOR_WALL_REINFORCEMENT',
  'FAC',
  'FAC_EXTERIOR_WALL_REINFORCEMENT',
  'Is an Exterior Wall Reinforcement capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-FAC-FAC_EXTERIOR_WALL_REINFORCEMENT'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-FAC-FAC_IMPACT_RESISTANT_GLAZING',
  'FAC',
  'FAC_IMPACT_RESISTANT_GLAZING',
  'Is an Impact-Resistant Glazing capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-FAC-FAC_IMPACT_RESISTANT_GLAZING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-FAC-FAC_STRUCTURAL_HARDENING',
  'FAC',
  'FAC_STRUCTURAL_HARDENING',
  'Is a Structural Hardening capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-FAC-FAC_STRUCTURAL_HARDENING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-FAC-FAC_WINDOW_FILM',
  'FAC',
  'FAC_WINDOW_FILM',
  'Is a Window Film capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-FAC-FAC_WINDOW_FILM'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-IDS-IDS_ALARM_MONITORING',
  'IDS',
  'IDS_ALARM_MONITORING',
  'Are alarms monitored by staff or a central service?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-IDS-IDS_ALARM_MONITORING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-IDS-IDS_ALARM_PANELS',
  'IDS',
  'IDS_ALARM_PANELS',
  'Are alarm panels installed to receive detection signals?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-IDS-IDS_ALARM_PANELS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-IDS-IDS_DOOR_CONTACTS',
  'IDS',
  'IDS_DOOR_CONTACTS',
  'Are door contacts installed to detect opening events?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-IDS-IDS_DOOR_CONTACTS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-IDS-IDS_GLASS_BREAK_SENSORS',
  'IDS',
  'IDS_GLASS_BREAK_SENSORS',
  'Are glass break sensors installed to detect forced entry?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-IDS-IDS_GLASS_BREAK_SENSORS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-IDS-IDS_MOTION_DETECTORS',
  'IDS',
  'IDS_MOTION_DETECTORS',
  'Are motion detectors installed to detect movement in protected areas?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-IDS-IDS_MOTION_DETECTORS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-IDS-IDS_PANIC_DURESS_BUTTONS',
  'IDS',
  'IDS_PANIC_DURESS_BUTTONS',
  'Are panic or duress buttons installed for silent alerting?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-IDS-IDS_PANIC_DURESS_BUTTONS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-IDS-IDS_PERIMETER_IDS',
  'IDS',
  'IDS_PERIMETER_IDS',
  'Is intrusion detection deployed along the perimeter?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-IDS-IDS_PERIMETER_IDS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-INT-INT_ACCESS_RESTRICTED_AREAS',
  'INT',
  'INT_ACCESS_RESTRICTED_AREAS',
  'Are restricted areas controlled at their entry points?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-INT-INT_ACCESS_RESTRICTED_AREAS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-INT-INT_HARD_INTERIOR_BARRIERS',
  'INT',
  'INT_HARD_INTERIOR_BARRIERS',
  'Are hard interior barriers used to separate protected spaces?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-INT-INT_HARD_INTERIOR_BARRIERS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-INT-INT_INTERIOR_DOORS',
  'INT',
  'INT_INTERIOR_DOORS',
  'Are interior doors used to control movement between spaces?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-INT-INT_INTERIOR_DOORS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-INT-INT_INTERIOR_LIGHTING',
  'INT',
  'INT_INTERIOR_LIGHTING',
  'Is interior lighting used to support protected spaces or visibility?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-INT-INT_INTERIOR_LIGHTING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-INT-INT_SAFE_ROOMS',
  'INT',
  'INT_SAFE_ROOMS',
  'Are safe rooms designated for temporary protective shelter?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-INT-INT_SAFE_ROOMS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-INT-INT_SECURE_ROOMS',
  'INT',
  'INT_SECURE_ROOMS',
  'Are secure rooms designated for protected occupancy?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-INT-INT_SECURE_ROOMS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-INT-INT_SENSITIVE_ITEM_STORAGE',
  'INT',
  'INT_SENSITIVE_ITEM_STORAGE',
  'Is protected storage provided for sensitive items?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-INT-INT_SENSITIVE_ITEM_STORAGE'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-ISC-ISC_COORDINATION_PROTOCOLS',
  'ISC',
  'ISC_COORDINATION_PROTOCOLS',
  'Are coordination protocols defined for partner response and escalation?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ISC-ISC_COORDINATION_PROTOCOLS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-ISC-ISC_EXTERNAL_REPORTING',
  'ISC',
  'ISC_EXTERNAL_REPORTING',
  'Is external reporting defined for incidents or threats?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ISC-ISC_EXTERNAL_REPORTING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-ISC-ISC_FUSION_CENTER_INTERFACE',
  'ISC',
  'ISC_FUSION_CENTER_INTERFACE',
  'Is there an interface for sharing information with a fusion center?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ISC-ISC_FUSION_CENTER_INTERFACE'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-ISC-ISC_ISAC_ISAOS',
  'ISC',
  'ISC_ISAC_ISAOS',
  'Is there participation in ISAC or ISAO information sharing?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ISC-ISC_ISAC_ISAOS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-ISC-ISC_JTTF_ENGAGEMENT',
  'ISC',
  'ISC_JTTF_ENGAGEMENT',
  'Is JTTF engagement defined for relevant incidents?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ISC-ISC_JTTF_ENGAGEMENT'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-ISC-ISC_LAW_ENFORCEMENT_LIAISON',
  'ISC',
  'ISC_LAW_ENFORCEMENT_LIAISON',
  'Is law enforcement liaison defined for the facility?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ISC-ISC_LAW_ENFORCEMENT_LIAISON'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-ISC-ISC_THREAT_INFORMATION_SHARING',
  'ISC',
  'ISC_THREAT_INFORMATION_SHARING',
  'Is threat information shared with outside partners?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ISC-ISC_THREAT_INFORMATION_SHARING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-KEY-KEY_KEY_CABINETS',
  'KEY',
  'KEY_KEY_CABINETS',
  'Are key cabinets used to secure stored keys?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-KEY-KEY_KEY_CABINETS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-KEY-KEY_KEY_LOGS_ACCOUNTABILITY',
  'KEY',
  'KEY_KEY_LOGS_ACCOUNTABILITY',
  'Are key issuance and return logs maintained?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-KEY-KEY_KEY_LOGS_ACCOUNTABILITY'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-KEY-KEY_MASTER_KEY_MANAGEMENT',
  'KEY',
  'KEY_MASTER_KEY_MANAGEMENT',
  'Are master keys controlled separately from standard keys?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-KEY-KEY_MASTER_KEY_MANAGEMENT'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-KEY-KEY_REKEYING_PROCEDURES',
  'KEY',
  'KEY_REKEYING_PROCEDURES',
  'Are rekeying procedures documented after key loss or turnover?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-KEY-KEY_REKEYING_PROCEDURES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-KEY-KEY_RESTRICTED_KEYS',
  'KEY',
  'KEY_RESTRICTED_KEYS',
  'Are restricted keys issued only to authorized personnel?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-KEY-KEY_RESTRICTED_KEYS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-PER-PER_BOLLARDS_BARRIERS',
  'PER',
  'PER_BOLLARDS_BARRIERS',
  'Are bollards or vehicle barriers installed to deter vehicle access?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-PER-PER_BOLLARDS_BARRIERS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-PER-PER_BOUNDARY_DEMARCATION',
  'PER',
  'PER_BOUNDARY_DEMARCATION',
  'Is the site boundary clearly marked or demarcated?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-PER-PER_BOUNDARY_DEMARCATION'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-PER-PER_CLEAR_ZONES',
  'PER',
  'PER_CLEAR_ZONES',
  'Are clear zones maintained along the perimeter?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-PER-PER_CLEAR_ZONES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-PER-PER_FENCING',
  'PER',
  'PER_FENCING',
  'Is fencing present along the site boundary?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-PER-PER_FENCING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-PER-PER_GATES',
  'PER',
  'PER_GATES',
  'Are gates installed at perimeter entry points?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-PER-PER_GATES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-PER-PER_PERIMETER_LIGHTING',
  'PER',
  'PER_PERIMETER_LIGHTING',
  'Is perimeter lighting installed to illuminate the site boundary?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-PER-PER_PERIMETER_LIGHTING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-PER-PER_PERIMETER_SIGNAGE',
  'PER',
  'PER_PERIMETER_SIGNAGE',
  'Is perimeter signage posted to mark restricted areas?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-PER-PER_PERIMETER_SIGNAGE'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-PER-PER_VEHICLE_ACCESS_CONTROL_POINTS',
  'PER',
  'PER_VEHICLE_ACCESS_CONTROL_POINTS',
  'Are vehicle entry points controlled with gates, barriers, or checkpoints?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-PER-PER_VEHICLE_ACCESS_CONTROL_POINTS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-PER-PER_PEDESTRIAN_ACCESS_CONTROL_POINTS',
  'PER',
  'PER_PEDESTRIAN_ACCESS_CONTROL_POINTS',
  'Are pedestrian entry points controlled with staff, turnstiles, or checkpoints?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-PER-PER_PEDESTRIAN_ACCESS_CONTROL_POINTS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-SFO-SFO_GUARD_POSTS',
  'SFO',
  'SFO_GUARD_POSTS',
  'Are guard posts assigned to protect key areas of the facility?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SFO-SFO_GUARD_POSTS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-SFO-SFO_INCIDENT_REPORTING',
  'SFO',
  'SFO_INCIDENT_REPORTING',
  'Are incident logging and escalation steps defined for security staff?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SFO-SFO_INCIDENT_REPORTING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-SFO-SFO_PATROL_ROUTES',
  'SFO',
  'SFO_PATROL_ROUTES',
  'Are patrol routes defined for security rounds and inspections?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SFO-SFO_PATROL_ROUTES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-SFO-SFO_RADIO_COMMUNICATIONS',
  'SFO',
  'SFO_RADIO_COMMUNICATIONS',
  'Are radios available for security team communications?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SFO-SFO_RADIO_COMMUNICATIONS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-SFO-SFO_RESPONSE_PROCEDURES',
  'SFO',
  'SFO_RESPONSE_PROCEDURES',
  'Are security response playbooks documented for incidents?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SFO-SFO_RESPONSE_PROCEDURES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-SFO-SFO_SECURITY_OFFICER_TRAINING',
  'SFO',
  'SFO_SECURITY_OFFICER_TRAINING',
  'Are security officers trained for assigned duties and response roles?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SFO-SFO_SECURITY_OFFICER_TRAINING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-SFO-SFO_SECURITY_OPERATIONS_CENTER_SOC',
  'SFO',
  'SFO_SECURITY_OPERATIONS_CENTER_SOC',
  'Is a security operations center available for live monitoring and coordination?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SFO-SFO_SECURITY_OPERATIONS_CENTER_SOC'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-SMG-SMG_GOVERNANCE_OVERSIGHT',
  'SMG',
  'SMG_GOVERNANCE_OVERSIGHT',
  'Is a Governance & Oversight capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SMG-SMG_GOVERNANCE_OVERSIGHT'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-SMG-SMG_POLICY_COMPLIANCE_TRACKING',
  'SMG',
  'SMG_POLICY_COMPLIANCE_TRACKING',
  'Is a Policy Compliance Tracking capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SMG-SMG_POLICY_COMPLIANCE_TRACKING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-SMG-SMG_RISK_ASSESSMENT_RISK_MANAGEMENT',
  'SMG',
  'SMG_RISK_ASSESSMENT_RISK_MANAGEMENT',
  'Is a Risk Assessment / Risk Management capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SMG-SMG_RISK_ASSESSMENT_RISK_MANAGEMENT'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-SMG-SMG_SECURITY_DOCUMENTATION',
  'SMG',
  'SMG_SECURITY_DOCUMENTATION',
  'Is security documentation maintained as the governing record set for the facility?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SMG-SMG_SECURITY_DOCUMENTATION'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-SMG-SMG_SECURITY_POLICIES',
  'SMG',
  'SMG_SECURITY_POLICIES',
  'Are security policies documented to govern facility security decisions?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SMG-SMG_SECURITY_POLICIES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-SMG-SMG_SECURITY_PROCEDURES',
  'SMG',
  'SMG_SECURITY_PROCEDURES',
  'Are step-by-step security procedures documented for operations and incidents?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SMG-SMG_SECURITY_PROCEDURES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-SMG-SMG_SECURITY_TRAINING_PROGRAMS',
  'SMG',
  'SMG_SECURITY_TRAINING_PROGRAMS',
  'Are security training programs provided to staff and contractors?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SMG-SMG_SECURITY_TRAINING_PROGRAMS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-VSS-VSS_ANALYTICS_BEHAVIOR_DETECTION',
  'VSS',
  'VSS_ANALYTICS_BEHAVIOR_DETECTION',
  'Are analytics used to detect unusual behavior on camera feeds?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_ANALYTICS_BEHAVIOR_DETECTION'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-VSS-VSS_CAMERA_COVERAGE_LINE_OF_SIGHT',
  'VSS',
  'VSS_CAMERA_COVERAGE_LINE_OF_SIGHT',
  'Are camera views unobstructed across required areas?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_CAMERA_COVERAGE_LINE_OF_SIGHT'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-VSS-VSS_EXTERIOR_CAMERAS',
  'VSS',
  'VSS_EXTERIOR_CAMERAS',
  'Are cameras deployed to observe exterior and perimeter areas?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_EXTERIOR_CAMERAS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-VSS-VSS_FIXED_CAMERAS',
  'VSS',
  'VSS_FIXED_CAMERAS',
  'Are fixed cameras used where a constant field of view is needed?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_FIXED_CAMERAS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-VSS-VSS_INTERIOR_CAMERAS',
  'VSS',
  'VSS_INTERIOR_CAMERAS',
  'Are cameras deployed to observe interior public or restricted spaces?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_INTERIOR_CAMERAS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-VSS-VSS_IP_CAMERAS',
  'VSS',
  'VSS_IP_CAMERAS',
  'Are networked IP cameras used in the video system?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_IP_CAMERAS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-VSS-VSS_MONITORING_WORKSTATIONS',
  'VSS',
  'VSS_MONITORING_WORKSTATIONS',
  'Are operator workstations available to view live camera feeds?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_MONITORING_WORKSTATIONS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-VSS-VSS_PTZ_CAMERAS',
  'VSS',
  'VSS_PTZ_CAMERAS',
  'Are pan-tilt-zoom cameras deployed where adjustable coverage is needed?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_PTZ_CAMERAS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-VSS-VSS_RECORDING_STORAGE_NVR_DVR',
  'VSS',
  'VSS_RECORDING_STORAGE_NVR_DVR',
  'Is a Recording / Storage (NVR/DVR) capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_RECORDING_STORAGE_NVR_DVR'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-VSS-VSS_SYSTEM_ARCHITECTURE',
  'VSS',
  'VSS_SYSTEM_ARCHITECTURE',
  'Is the video system architecture documented for the facility?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_SYSTEM_ARCHITECTURE'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

INSERT INTO public.baseline_spines_runtime (
  canon_id,
  discipline_code,
  subtype_code,
  question_text,
  response_enum,
  canon_version,
  canon_hash,
  active
) VALUES (
  'BASE-VSS-VSS_VIDEO_WALL_DISPLAY_SYSTEMS',
  'VSS',
  'VSS_VIDEO_WALL_DISPLAY_SYSTEMS',
  'Are display systems used to show live camera feeds?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_VIDEO_WALL_DISPLAY_SYSTEMS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  -- question_text preserved (not updated in PRESERVE_EXISTING mode)
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

COMMIT;
