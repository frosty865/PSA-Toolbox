/**
 * EAP criteria prompt rules for Standard generation.
 * Use in any prompt that produces criteria (PLAN/MEASURES, Python run_module_parser_from_db or TS).
 * Ensures criteria are plan elements only, not hazard/scenario content.
 */

export const EAP_CRITERIA_INSTRUCTIONS = `
CRITERIA MUST BE EMERGENCY ACTION PLAN (EAP) PLAN ELEMENTS ONLY.
- Do NOT list hazards, threats, or "what to do if…" scenarios.
- Do NOT list incident annex content (tornado, lightning, active shooter, etc.) unless the plan element itself is an annex requirement.
- Each criterion must describe a structural plan element that should exist in an EAP.
- Use this format exactly: "Plan element exists: <EAP element>."
- Generate 8–12 criteria unless the sources explicitly contain fewer.
- Criteria must be drawn from the provided sources (template/guidance).
`.trim();

export const EAP_CRITERIA_FORBIDDEN = `
FORBIDDEN CRITERIA CONTENT:
- "what to do if…"
- "initial actions for…"
- hazard-specific response steps (tornado, lightning, siren, shooter)
`.trim();

/** Full block to inject into criteria-generation prompts. */
export const EAP_CRITERIA_PROMPT_BLOCK = `${EAP_CRITERIA_INSTRUCTIONS}

${EAP_CRITERIA_FORBIDDEN}`;

/**
 * Canonical EAP plan element set (allowed element types).
 * Model can omit ones not supported by sources; it must not invent scenario criteria.
 */
export const CANONICAL_EAP_ELEMENTS = [
  "Purpose and scope are defined.",
  "Roles, authorities, and responsibilities are defined.",
  "Emergency reporting and notification procedures are documented.",
  "Evacuation procedures and routes are documented.",
  "Shelter-in-place procedures are documented.",
  "Accountability procedures for personnel and visitors are documented.",
  "Coordination procedures with law enforcement and first responders are documented.",
  "Emergency communications methods and contact rosters are documented.",
  "Training and exercise requirements are documented.",
  "Plan maintenance, review, and update cycle is documented.",
  "Access to emergency information and resources is defined (maps, floorplans, assembly areas where applicable).",
  "Procedures for assisting individuals with functional needs are documented (if present in sources).",
] as const;
