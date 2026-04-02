/**
 * Scenario context schema and enums (DEPRECATED).
 * Legacy support only - scenario context is no longer used in template-first doctrine.
 * Kept for backward compatibility with existing draft_builder code.
 */

export const THREAT_SCENARIOS = [
  "INTERPERSONAL_VIOLENCE",
  "TARGETED_GRIEVANCE",
  "DOMESTIC_SPILLOVER",
  "AGGRESSIVE_BEHAVIOR",
  "THREATS_INTIMIDATION",
  "WEAPON_DISPLAY",
  "ACTIVE_ASSAILANT",
  "SABOTAGE",
  "THEFT_ROBBERY",
  "PROTEST_CIVIL_DISTURBANCE",
] as const;

export type ThreatScenario = (typeof THREAT_SCENARIOS)[number];

export const ENVIRONMENTS = [
  "PUBLIC_ENTRY",
  "RECEPTION_LOBBY",
  "OFFICE_ADMIN",
  "OPERATIONS_FLOOR",
  "CARE_AREAS",
  "PARKING_EXTERIOR",
  "LOADING_SERVICE",
  "REMOTE_SITE",
] as const;

export type Environment = (typeof ENVIRONMENTS)[number];

export const ASSETS_AT_RISK = [
  "PERSONNEL",
  "VISITORS_PUBLIC",
  "CRITICAL_OPERATIONS",
  "FACILITY_ASSETS",
  "MISSION_CONTINUITY",
] as const;

export type AssetAtRisk = (typeof ASSETS_AT_RISK)[number];

export const PHASES = ["PREVENTION", "DETECTION", "RESPONSE", "RECOVERY"] as const;

export type Phase = (typeof PHASES)[number];

export interface ScenarioContext {
  threat_scenarios: string[];
  environments: string[];
  assets_at_risk: string[];
  phases?: string[];
}

export function isThreatScenario(s: string): s is ThreatScenario {
  return (THREAT_SCENARIOS as readonly string[]).includes(s);
}

export function isEnvironment(s: string): s is Environment {
  return (ENVIRONMENTS as readonly string[]).includes(s);
}

export function isAssetAtRisk(s: string): s is AssetAtRisk {
  return (ASSETS_AT_RISK as readonly string[]).includes(s);
}

export function isPhase(s: string): s is Phase {
  return (PHASES as readonly string[]).includes(s);
}

/** Human-readable label: TARGETED_GRIEVANCE -> "targeted grievance" */
export function toLabel(val: string): string {
  return val.replace(/_/g, " ").toLowerCase();
}
