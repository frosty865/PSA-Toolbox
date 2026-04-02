-- Baseline Subtype v1 Seed Script
-- Generated: 2026-01-16T15:19:33.201Z
-- Seed Mode: OVERWRITE_EXISTING
-- Total spines: 105

-- OVERWRITE_EXISTING mode: All taxonomy subtypes will be seeded.
-- This script uses INSERT ... ON CONFLICT DO UPDATE to overwrite question_text.
-- Existing subtype spines will be updated with new question_text.

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
  'Is a Biometric Access capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ACS-ACS_BIOMETRIC_ACCESS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Credential / Badge Systems capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ACS-ACS_CREDENTIAL_BADGE_SYSTEMS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Door Monitoring capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ACS-ACS_DOOR_MONITORING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Door Readers capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ACS-ACS_DOOR_READERS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is an Electric Strikes / Mag Locks capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ACS-ACS_ELECTRIC_STRIKES_MAG_LOCKS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is an Electronic Access Control capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ACS-ACS_ELECTRONIC_ACCESS_CONTROL'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Keypads / PIN Entry capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ACS-ACS_KEYPADS_PIN_ENTRY'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Locking Hardware capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ACS-ACS_LOCKING_HARDWARE'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Secured Vestibules capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ACS-ACS_SECURED_VESTIBULES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Visitor Management Systems capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ACS-ACS_VISITOR_MANAGEMENT_SYSTEMS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Backup Communications capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-COM-COM_BACKUP_COMMUNICATIONS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Communication Protocols capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-COM-COM_COMMUNICATION_PROTOCOLS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is an Interoperable Communications capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-COM-COM_INTEROPERABLE_COMMUNICATIONS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a PA Systems capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-COM-COM_PA_SYSTEMS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Paging Systems capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-COM-COM_PAGING_SYSTEMS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Radios / Two-Way capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-COM-COM_RADIOS_TWO_WAY'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  question_text = EXCLUDED.question_text,
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
  question_text = EXCLUDED.question_text,
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
  question_text = EXCLUDED.question_text,
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
  question_text = EXCLUDED.question_text,
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
  question_text = EXCLUDED.question_text,
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
  question_text = EXCLUDED.question_text,
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
  question_text = EXCLUDED.question_text,
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
  'Is an Emergency Drills capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EAP-EAP_EMERGENCY_DRILLS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is an Emergency Guides / Flip Charts capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EAP-EAP_EMERGENCY_GUIDES_FLIP_CHARTS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is an Evacuation Procedures capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EAP-EAP_EVACUATION_PROCEDURES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Lockdown / Lockout Procedures capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EAP-EAP_LOCKDOWN_LOCKOUT_PROCEDURES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Muster Points / Rally Areas capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EAP-EAP_MUSTER_POINTS_RALLY_AREAS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Reunification Procedures capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EAP-EAP_REUNIFICATION_PROCEDURES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Shelter-in-Place capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EAP-EAP_SHELTER_IN_PLACE'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Staff Emergency Roles capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EAP-EAP_STAFF_EMERGENCY_ROLES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Business Continuity capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EMR-EMR_BUSINESS_CONTINUITY'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Crisis Management capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EMR-EMR_CRISIS_MANAGEMENT'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is an Emergency Communications capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EMR-EMR_EMERGENCY_COMMUNICATIONS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is an ICS/NIMS Integration capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EMR-EMR_ICS_NIMS_INTEGRATION'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Mass Notification capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EMR-EMR_MASS_NOTIFICATION'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Redundancy / Backup Systems capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EMR-EMR_REDUNDANCY_BACKUP_SYSTEMS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Resilience Planning capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-EMR-EMR_RESILIENCE_PLANNING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  question_text = EXCLUDED.question_text,
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
  question_text = EXCLUDED.question_text,
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
  question_text = EXCLUDED.question_text,
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
  question_text = EXCLUDED.question_text,
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
  question_text = EXCLUDED.question_text,
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
  question_text = EXCLUDED.question_text,
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
  'Is an Alarm Monitoring capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-IDS-IDS_ALARM_MONITORING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is an Alarm Panels capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-IDS-IDS_ALARM_PANELS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Door Contacts capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-IDS-IDS_DOOR_CONTACTS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Glass Break Sensors capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-IDS-IDS_GLASS_BREAK_SENSORS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Motion Detectors capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-IDS-IDS_MOTION_DETECTORS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Panic / Duress Buttons capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-IDS-IDS_PANIC_DURESS_BUTTONS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Perimeter IDS capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-IDS-IDS_PERIMETER_IDS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is an Access-Restricted Areas capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-INT-INT_ACCESS_RESTRICTED_AREAS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Hard-Interior Barriers capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-INT-INT_HARD_INTERIOR_BARRIERS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is an Interior Doors capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-INT-INT_INTERIOR_DOORS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is an Interior Lighting capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-INT-INT_INTERIOR_LIGHTING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Safe Rooms capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-INT-INT_SAFE_ROOMS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Secure Rooms capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-INT-INT_SECURE_ROOMS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Sensitive Item Storage capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-INT-INT_SENSITIVE_ITEM_STORAGE'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Coordination Protocols capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ISC-ISC_COORDINATION_PROTOCOLS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is an External Reporting capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ISC-ISC_EXTERNAL_REPORTING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Fusion Center Interface capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ISC-ISC_FUSION_CENTER_INTERFACE'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is an ISAC / ISAOs capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ISC-ISC_ISAC_ISAOS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a JTTF Engagement capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ISC-ISC_JTTF_ENGAGEMENT'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Law Enforcement Liaison capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ISC-ISC_LAW_ENFORCEMENT_LIAISON'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Threat Information Sharing capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-ISC-ISC_THREAT_INFORMATION_SHARING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Key Cabinets capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-KEY-KEY_KEY_CABINETS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Key Logs / Accountability capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-KEY-KEY_KEY_LOGS_ACCOUNTABILITY'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Master Key Management capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-KEY-KEY_MASTER_KEY_MANAGEMENT'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Rekeying Procedures capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-KEY-KEY_REKEYING_PROCEDURES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Restricted Keys capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-KEY-KEY_RESTRICTED_KEYS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Bollards / Barriers capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-PER-PER_BOLLARDS_BARRIERS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Boundary Demarcation capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-PER-PER_BOUNDARY_DEMARCATION'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Clear Zones capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-PER-PER_CLEAR_ZONES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Fencing capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-PER-PER_FENCING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Gates capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-PER-PER_GATES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Perimeter Lighting capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-PER-PER_PERIMETER_LIGHTING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Perimeter Signage capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-PER-PER_PERIMETER_SIGNAGE'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Vehicle Access Control Points capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-PER-PER_VEHICLE_ACCESS_CONTROL_POINTS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Pedestrian Access Control Points capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-PER-PER_PEDESTRIAN_ACCESS_CONTROL_POINTS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Guard Posts capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SFO-SFO_GUARD_POSTS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is an Incident Reporting capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SFO-SFO_INCIDENT_REPORTING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Patrol Routes capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SFO-SFO_PATROL_ROUTES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Radio Communications capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SFO-SFO_RADIO_COMMUNICATIONS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Response Procedures capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SFO-SFO_RESPONSE_PROCEDURES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'BASE-SFO-SFO_SCHOOL_RESOURCE_OFFICER_SRO',
  'SFO',
  'SFO_SCHOOL_RESOURCE_OFFICER_SRO',
  'Is a School Resource Officer (SRO) capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SFO-SFO_SCHOOL_RESOURCE_OFFICER_SRO'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Security Officer Training capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SFO-SFO_SECURITY_OFFICER_TRAINING'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Security Operations Center (SOC) capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SFO-SFO_SECURITY_OPERATIONS_CENTER_SOC'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  question_text = EXCLUDED.question_text,
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
  question_text = EXCLUDED.question_text,
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
  question_text = EXCLUDED.question_text,
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
  'Is a Security Documentation capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SMG-SMG_SECURITY_DOCUMENTATION'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Security Policies capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SMG-SMG_SECURITY_POLICIES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Security Procedures capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SMG-SMG_SECURITY_PROCEDURES'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Security Training Programs capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-SMG-SMG_SECURITY_TRAINING_PROGRAMS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is an Analytics / Behavior Detection capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_ANALYTICS_BEHAVIOR_DETECTION'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Camera Coverage / Line of Sight capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_CAMERA_COVERAGE_LINE_OF_SIGHT'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is an Exterior Cameras capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_EXTERIOR_CAMERAS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Fixed Cameras capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_FIXED_CAMERAS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is an Interior Cameras capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_INTERIOR_CAMERAS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is an IP Cameras capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_IP_CAMERAS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Monitoring / Workstations capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_MONITORING_WORKSTATIONS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a PTZ Cameras capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_PTZ_CAMERAS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  question_text = EXCLUDED.question_text,
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
  'Is a System Architecture capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_SYSTEM_ARCHITECTURE'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
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
  'Is a Video Wall / Display Systems capability implemented?',
  '["YES","NO","N_A"]'::jsonb,
  'v1',
  MD5('BASE-VSS-VSS_VIDEO_WALL_DISPLAY_SYSTEMS'),
  true
)
ON CONFLICT (canon_id) DO UPDATE SET
  discipline_code = EXCLUDED.discipline_code,
  subtype_code = EXCLUDED.subtype_code,
  question_text = EXCLUDED.question_text,
  response_enum = EXCLUDED.response_enum,
  canon_version = EXCLUDED.canon_version,
  canon_hash = EXCLUDED.canon_hash,
  active = EXCLUDED.active;

COMMIT;
