-- ============================================================================
-- Seed Reference Implementations: Emergency Action Planning (EAP) — 6 subtypes
-- ============================================================================
-- Date: 2026-02-26
-- Purpose: Thin-slice authoritative doctrine. Canonical template (Purpose, Scope,
--          Core Elements, Common Failure Modes). Bound by discipline_subtype_id.
-- TARGET DB: RUNTIME
-- Template: docs/doctrine/REFERENCE_IMPLEMENTATION_TEMPLATE.md

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Evacuation Procedures — 9a84b834-8fe5-4c25-a11b-750276b2f76e
-- ---------------------------------------------------------------------------
INSERT INTO public.discipline_subtype_reference_impl (discipline_subtype_id, reference_impl)
VALUES (
  '9a84b834-8fe5-4c25-a11b-750276b2f76e',
  '{
    "template_version": "2.0",
    "discipline": "EAP",
    "subtype": "Evacuation Procedures",
    "purpose": "Evacuation procedures describe how occupants move from interior spaces to areas of safety and how that movement is directed and accounted for.",
    "scope": "Applies when occupants must leave a building or zone in response to a fire, hazard, or other condition that makes remaining in place unsafe. Relevant to all occupied facilities.",
    "core_elements": [
      "Identified routes and paths for occupants to leave the building or zone.",
      "Designated areas outside or away from the hazard where occupants are to assemble.",
      "A recognized method to account for or track occupants after they have moved to safety.",
      "Roles or assignments that support directing movement and accounting during an evacuation.",
      "Consideration of occupants who may need assistance or different routes."
    ],
    "common_failure_modes": [
      "Evacuation guidance exists only informally or differs by area or shift with no consistent procedure.",
      "Assembly locations or movement expectations are unclear or unknown to occupants.",
      "No defined method to account for occupants after they have left the building.",
      "Routes or assembly areas are obstructed, inappropriate for the hazard, or not maintained."
    ]
  }'::jsonb
)
ON CONFLICT (discipline_subtype_id) DO UPDATE SET reference_impl = EXCLUDED.reference_impl, updated_at = now();

-- ---------------------------------------------------------------------------
-- 2) Lockdown / Lockout Procedures — ded67053-d321-445c-95f9-d2326b72b6e6
-- ---------------------------------------------------------------------------
INSERT INTO public.discipline_subtype_reference_impl (discipline_subtype_id, reference_impl)
VALUES (
  'ded67053-d321-445c-95f9-d2326b72b6e6',
  '{
    "template_version": "2.0",
    "discipline": "EAP",
    "subtype": "Lockdown / Lockout Procedures",
    "purpose": "Lockdown and lockout procedures describe how occupants are kept inside and how movement is restricted when a threat condition makes it safer to remain in place than to leave.",
    "scope": "Applies when a threat or hazard warrants securing occupants indoors and limiting access or movement. Relevant to schools, offices, healthcare, and other occupied facilities.",
    "core_elements": [
      "Defined actions for securing doors, windows, and other entry points from the inside.",
      "Recognition of different threat conditions (e.g., threat inside versus outside the building) and corresponding actions.",
      "Roles or assignments for initiating, communicating, and sustaining the lockdown or lockout.",
      "A way to communicate the protective action to occupants and, where appropriate, to responders or authorities.",
      "Consideration of how occupants in common areas or corridors move to a securable space."
    ],
    "common_failure_modes": [
      "Triggers for when to initiate lockdown or lockout are unclear or inconsistent.",
      "Actions differ by area or are not defined for common scenarios (e.g., inside versus outside threat).",
      "Roles for initiating and managing the lockdown are undefined or unknown to staff.",
      "Doors or spaces cannot be effectively secured from the inside, or occupants do not know how to secure them."
    ]
  }'::jsonb
)
ON CONFLICT (discipline_subtype_id) DO UPDATE SET reference_impl = EXCLUDED.reference_impl, updated_at = now();

-- ---------------------------------------------------------------------------
-- 3) Shelter-in-Place — b7fefab1-cd13-4781-93d4-fedd133cdf67
-- ---------------------------------------------------------------------------
INSERT INTO public.discipline_subtype_reference_impl (discipline_subtype_id, reference_impl)
VALUES (
  'b7fefab1-cd13-4781-93d4-fedd133cdf67',
  '{
    "template_version": "2.0",
    "discipline": "EAP",
    "subtype": "Shelter-in-Place",
    "purpose": "Shelter-in-place procedures describe how occupants remain indoors and where they go when evacuation is unsafe or impractical due to an external hazard.",
    "scope": "Applies when hazards such as severe weather, airborne contaminants, or community violence make it safer to stay inside than to evacuate. Relevant to all occupied facilities.",
    "core_elements": [
      "Identified interior locations or zones where occupants are to remain or move to during a shelter-in-place event.",
      "Guidance on what actions occupants and staff take once in the shelter location (e.g., closing windows, shutting ventilation, staying away from windows).",
      "A method to communicate that shelter-in-place is in effect and when it has ended.",
      "Consideration of how long occupants may need to remain and what they need (e.g., access to restrooms, basic supplies).",
      "Recognition of different hazard types that may require different sheltering actions."
    ],
    "common_failure_modes": [
      "Shelter locations are not designated, are unknown to occupants, or are unsuitable for the hazard (e.g., glass-heavy or perimeter spaces for severe weather).",
      "Actions once in the shelter (e.g., closing vents, staying low) are not defined or communicated.",
      "Staff or occupants are unaware of when to initiate shelter-in-place or when it is safe to end it.",
      "Shelter spaces are cluttered, inaccessible, or used for other purposes in a way that undermines their use in an emergency."
    ]
  }'::jsonb
)
ON CONFLICT (discipline_subtype_id) DO UPDATE SET reference_impl = EXCLUDED.reference_impl, updated_at = now();

-- ---------------------------------------------------------------------------
-- 4) Muster Points / Rally Areas — 09335ae3-724b-48c5-b4cc-c97905ebe768
-- ---------------------------------------------------------------------------
INSERT INTO public.discipline_subtype_reference_impl (discipline_subtype_id, reference_impl)
VALUES (
  '09335ae3-724b-48c5-b4cc-c97905ebe768',
  '{
    "template_version": "2.0",
    "discipline": "EAP",
    "subtype": "Muster Points / Rally Areas",
    "purpose": "Muster points and rally areas are designated places where occupants assemble after leaving a building or zone during an evacuation or emergency movement.",
    "scope": "Applies wherever evacuation or relocation is part of the facility response. Relevant to all occupied facilities with defined evacuation procedures.",
    "core_elements": [
      "Designated locations at a safe distance from the building or hazard where occupants are to assemble.",
      "Clear access from primary evacuation routes so occupants can reach the assembly area without re‑exposure to the hazard.",
      "Consideration of capacity, terrain, and exposure (e.g., weather, secondary hazards) when siting assembly areas.",
      "Signage or other cues so occupants and staff can identify and find the assembly area.",
      "Link between assembly at the muster point and any accountability or head-count process."
    ],
    "common_failure_modes": [
      "Assembly areas are not designated, are too close to the hazard, or are difficult to reach from main routes.",
      "Muster points are not marked or are unknown to occupants and staff.",
      "Access to the assembly area is blocked, seasonal, or otherwise unreliable when needed.",
      "The link between assembling at the muster point and accountability or reunification is unclear or missing."
    ]
  }'::jsonb
)
ON CONFLICT (discipline_subtype_id) DO UPDATE SET reference_impl = EXCLUDED.reference_impl, updated_at = now();

-- ---------------------------------------------------------------------------
-- 5) Reunification Procedures — eeb09a9c-b830-4118-ab27-535b48359303
-- ---------------------------------------------------------------------------
INSERT INTO public.discipline_subtype_reference_impl (discipline_subtype_id, reference_impl)
VALUES (
  'eeb09a9c-b830-4118-ab27-535b48359303',
  '{
    "template_version": "2.0",
    "discipline": "EAP",
    "subtype": "Reunification Procedures",
    "purpose": "Reunification procedures describe how occupants are accounted for and reunited with responsible parties after an evacuation, relocation, or other protective action has ended.",
    "scope": "Applies after evacuations, shelter-in-place, or other events where occupants have been moved or held in a protective status. Especially relevant where minors, visitors, or dependents are present.",
    "core_elements": [
      "A defined process for accounting for occupants (e.g., head count, roster check) after protective actions.",
      "Identified location or process where reunification occurs and how it is communicated to families or responsible parties.",
      "Roles for staff who verify identity and release occupants to authorized individuals.",
      "Recognition of occupants who may need to be accounted for or reunited differently (e.g., unaccompanied minors, persons with access or functional needs).",
      "A way to communicate reunification status and location to those who need to retrieve occupants."
    ],
    "common_failure_modes": [
      "No defined process for post-incident accountability or for where and how reunification occurs.",
      "Reunification is handled ad hoc with no fixed location or consistent process.",
      "Expectations for staff, occupants, and visitors during accountability and reunification are unclear.",
      "Communication to families or responsible parties about when and where to reunify is absent or inconsistent."
    ]
  }'::jsonb
)
ON CONFLICT (discipline_subtype_id) DO UPDATE SET reference_impl = EXCLUDED.reference_impl, updated_at = now();

-- ---------------------------------------------------------------------------
-- 6) Staff Emergency Roles — 57faa5fb-4c92-45cd-91d4-ae64181d9e09
-- ---------------------------------------------------------------------------
INSERT INTO public.discipline_subtype_reference_impl (discipline_subtype_id, reference_impl)
VALUES (
  '57faa5fb-4c92-45cd-91d4-ae64181d9e09',
  '{
    "template_version": "2.0",
    "discipline": "EAP",
    "subtype": "Staff Emergency Roles",
    "purpose": "Staff emergency roles define who is responsible for which actions during an emergency, such as directing evacuation, accounting for occupants, communicating with responders, or providing first aid.",
    "scope": "Applies to staff or designated personnel in occupied facilities. Roles may cover evacuation coordination, accountability, communications, medical response, floor or area wardens, and similar functions.",
    "core_elements": [
      "Identified roles or functions (e.g., evacuation coordinator, accountability lead, floor warden, communication contact) and what each is responsible for during an incident.",
      "Assignment of roles to positions, areas, or individuals so that someone is responsible for each function.",
      "A way for staff to know their own role and how it connects to others (e.g., who reports to whom, who triggers which protective action).",
      "Consideration of coverage when assigned staff are absent or when the incident affects their area.",
      "Link between these roles and the procedures for evacuation, lockdown, shelter-in-place, and reunification."
    ],
    "common_failure_modes": [
      "Roles are not defined, or responsibilities are unclear or overlapping.",
      "Staff are unaware of their assigned role or of who holds other critical roles.",
      "No backup or coverage when the assigned person is absent or unable to act.",
      "Roles exist on paper but are not practiced or integrated with actual procedures and communications."
    ]
  }'::jsonb
)
ON CONFLICT (discipline_subtype_id) DO UPDATE SET reference_impl = EXCLUDED.reference_impl, updated_at = now();

COMMIT;
