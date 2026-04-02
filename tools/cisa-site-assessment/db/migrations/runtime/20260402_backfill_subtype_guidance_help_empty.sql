-- Backfill discipline_subtypes guidance for subtypes that were "help empty" in subtype-coverage
-- (help_enabled but no overview and no reference implementation). Source: taxonomy/discipline_subtypes.json
-- Affects: ISC_EXTERNAL_REPORTING, PER_PEDESTRIAN_ACCESS_CONTROL_POINTS, VSS_SYSTEM_ARCHITECTURE

UPDATE public.discipline_subtypes
SET
  overview = $g$
External reporting defines how and when the facility notifies agencies, partners, or authorities outside the organization about incidents, threats, or required disclosures. Clear paths reduce delay, confusion, and inconsistent messaging during stressful events.
$g$,
  psa_notes = $g$
Ask who may release information externally and how drafts are reviewed. If only one person knows the process, reporting can stall when they are unavailable.
$g$,
  updated_at = now()
WHERE code = 'ISC_EXTERNAL_REPORTING';

UPDATE public.discipline_subtypes
SET
  overview = $g$
Pedestrian access control points manage how people enter on foot at the perimeter through gates, turnstiles, staffed checkpoints, or similar controls. They are where identity checks, visitor handling, and tailgating risk are most visible.
$g$,
  psa_notes = $g$
Observe a busy arrival period. If staff wave people through or credentials are not challenged, the control point is not operating as intended.
$g$,
  updated_at = now()
WHERE code = 'PER_PEDESTRIAN_ACCESS_CONTROL_POINTS';

UPDATE public.discipline_subtypes
SET
  overview = $g$
System architecture addresses whether the video surveillance system is intentionally structured so capture, transport, recording, and monitoring functions operate as a coordinated system.
$g$,
  indicators_of_risk = ARRAY[
    'Cameras and recording components added ad hoc without an overall design',
    'System dependencies and component relationships are not understood or documented'
  ]::text[],
  common_failures = ARRAY[
    'Video surveillance treated as standalone devices rather than an integrated system',
    'No documentation showing how cameras, recording, and monitoring are organized'
  ]::text[],
  mitigation_guidance = ARRAY[
    'Document how cameras, recording/storage, and monitoring functions are organized as a system',
    'Identify system boundaries and dependencies that affect surveillance capability'
  ]::text[],
  standards_references = ARRAY[
    'ISC: Facility Security Plan Guide',
    'ISC: Occupant Emergency Programs (2024 Edition)'
  ]::text[],
  psa_notes = $g$
Trace a camera path from lens to recorder using documentation or configuration. If no one can describe the end-to-end path, the architecture is informal rather than managed.
$g$,
  updated_at = now()
WHERE code = 'VSS_SYSTEM_ARCHITECTURE';
