/**
 * Capability-first draft question builder for the Module Draft Builder.
 * Template-driven: scenario context is optional (legacy support only).
 * READ-ONLY: returns stubs; API performs INSERT into module_draft_questions.
 * No OFC derivation; no writes to module_ofcs, ofc_candidate_queue, ofc_library*.
 */

import type { Pool } from "pg";
import type { ScenarioContext } from "./scenarioContext";
import { toLabel, isThreatScenario } from "./scenarioContext";

export type BuildMode = "LIGHT" | "DEEP";

export interface DraftQuestionStub {
  question_text: string;
  discipline_id: string;
  discipline_subtype_id: string | null;
  confidence: number | null;
  rationale: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used as type via typeof
const CAPABILITY_NEEDS = [
  "REPORTING_ESCALATION",
  "BEHAVIORAL_INDICATORS_AWARENESS",
  "ACCESS_RESTRICTION",
  "SCREENING_RECEPTION_CONTROL",
  "DE_ESCALATION_RESPONSE",
  "COMMUNICATIONS_ALERTING",
  "INCIDENT_COMMAND_COORDINATION",
  "POST_INCIDENT_RECOVERY",
] as const;

type CapabilityNeed = (typeof CAPABILITY_NEEDS)[number];

/** threat_scenario -> capability needs (deterministic) */
const THREAT_TO_CAPABILITIES: Record<string, CapabilityNeed[]> = {
  INTERPERSONAL_VIOLENCE: ["REPORTING_ESCALATION", "DE_ESCALATION_RESPONSE", "COMMUNICATIONS_ALERTING"],
  TARGETED_GRIEVANCE: ["REPORTING_ESCALATION", "BEHAVIORAL_INDICATORS_AWARENESS", "DE_ESCALATION_RESPONSE"],
  DOMESTIC_SPILLOVER: ["REPORTING_ESCALATION", "ACCESS_RESTRICTION", "COMMUNICATIONS_ALERTING"],
  AGGRESSIVE_BEHAVIOR: ["DE_ESCALATION_RESPONSE", "COMMUNICATIONS_ALERTING", "SCREENING_RECEPTION_CONTROL"],
  THREATS_INTIMIDATION: ["REPORTING_ESCALATION", "BEHAVIORAL_INDICATORS_AWARENESS", "ACCESS_RESTRICTION"],
  WEAPON_DISPLAY: ["COMMUNICATIONS_ALERTING", "ACCESS_RESTRICTION", "INCIDENT_COMMAND_COORDINATION"],
  ACTIVE_ASSAILANT: ["COMMUNICATIONS_ALERTING", "INCIDENT_COMMAND_COORDINATION", "ACCESS_RESTRICTION", "DE_ESCALATION_RESPONSE"],
  SABOTAGE: ["ACCESS_RESTRICTION", "COMMUNICATIONS_ALERTING", "INCIDENT_COMMAND_COORDINATION"],
  THEFT_ROBBERY: ["ACCESS_RESTRICTION", "SCREENING_RECEPTION_CONTROL", "COMMUNICATIONS_ALERTING"],
  PROTEST_CIVIL_DISTURBANCE: ["ACCESS_RESTRICTION", "INCIDENT_COMMAND_COORDINATION", "COMMUNICATIONS_ALERTING"],
};

/** capability -> action phrase for templates */
const CAPABILITY_ACTIONS: Record<CapabilityNeed, string> = {
  REPORTING_ESCALATION: "report and escalate concerning behavior",
  BEHAVIORAL_INDICATORS_AWARENESS: "identify and respond to behavioral indicators",
  ACCESS_RESTRICTION: "restrict access or movement",
  SCREENING_RECEPTION_CONTROL: "control screening at reception",
  DE_ESCALATION_RESPONSE: "de-escalate and respond appropriately",
  COMMUNICATIONS_ALERTING: "communicate and alert stakeholders",
  INCIDENT_COMMAND_COORDINATION: "coordinate incident command and roles",
  POST_INCIDENT_RECOVERY: "support post-incident recovery",
};

/** capability -> discipline codes (resolved to discipline_id at runtime) */
const CAPABILITY_TO_DISCIPLINE_CODES: Record<CapabilityNeed, string[]> = {
  REPORTING_ESCALATION: ["SMG", "ISC", "EAP", "SFO"],
  BEHAVIORAL_INDICATORS_AWARENESS: ["EAP", "ISC"],
  ACCESS_RESTRICTION: ["ACS", "INT", "PER"],
  SCREENING_RECEPTION_CONTROL: ["ACS", "PER"],
  DE_ESCALATION_RESPONSE: ["SFO", "EAP"],
  COMMUNICATIONS_ALERTING: ["COM", "EMR"],
  INCIDENT_COMMAND_COORDINATION: ["SMG", "EMR", "SFO"],
  POST_INCIDENT_RECOVERY: ["EAP", "EMR"],
};

const BANNED_PHRASES = ["considerations addressed", "for the scope of this module"];

const MAX_SUGGESTIONS_PER_RUN = 12;
const MAX_PER_DISCIPLINE_PER_RUN = 3;

function hasBanned(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.some((p) => lower.includes(p));
}

/**
 * Generate question text from capability, scenario, and template.
 * Each question must include at least one of: threat, environment, assets.
 */
function buildQuestionText(
  capability: CapabilityNeed,
  ctx: ScenarioContext,
  disciplineId: string
): string | null {
  const action = CAPABILITY_ACTIONS[capability];
  const threats = (ctx.threat_scenarios || []).filter(isThreatScenario);
  const envs = (ctx.environments || []).slice(0, 2);
  const assets = (ctx.assets_at_risk || []).slice(0, 2);
  const t = threats[0] ? toLabel(threats[0]) : "";
  const env = envs.map(toLabel).join(" and ") || "key areas";
  const a = assets.map(toLabel).join(" and ") || "personnel and operations";

  const templates: (() => string)[] = [
    () => `Are procedures in place to ${action} for ${t} in ${env}?`,
    () => `Are roles and escalation paths defined to address ${t} affecting ${a}?`,
    () => `Is the facility able to ${action} during ${t} in ${env}?`,
  ];

  const pick = Math.abs(hash(disciplineId + capability)) % 3;
  const text = templates[pick]();
  if (hasBanned(text)) return null;
  if (!t && !env && !a) return null;
  return text;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

function buildRationale(ctx: ScenarioContext): string {
  const t = (ctx.threat_scenarios || []).slice(0, 2).map(toLabel).join(", ");
  const e = (ctx.environments || []).slice(0, 2).map(toLabel).join(", ");
  const a = (ctx.assets_at_risk || []).slice(0, 2).map(toLabel).join(", ");
  return `Suggested due to ${t} in ${e} impacting ${a}.`;
}

export interface GenerateOptions {
  scenarioContext: ScenarioContext;
  mode: BuildMode;
  runtimePool: Pool;
  corpusPool?: Pool;
}

/**
 * Capability-first pipeline: scenario -> capability needs -> discipline/subtype -> question text.
 * Returns at most MAX_SUGGESTIONS_PER_RUN, at most MAX_PER_DISCIPLINE_PER_RUN per discipline.
 * DEEP mode: optionally use chunks to refine subtype only; we do not generate from chunks.
 */
export async function generateCapabilityFirst(options: GenerateOptions): Promise<DraftQuestionStub[]> {
  const { scenarioContext: ctx, runtimePool } = options;

  // Template-driven: if no scenario context provided, use defaults for now
  // Future: generate from module template instead of scenario context
  let threats = (ctx.threat_scenarios || []).filter(isThreatScenario);
  if (threats.length === 0) {
    // Temporary: use default threats to allow generation until templates are integrated
    threats = ["INTERPERSONAL_VIOLENCE", "TARGETED_GRIEVANCE"];
  }
  
  // Ensure we have environments and assets for question generation
  const envs = (ctx.environments || []).length > 0 ? ctx.environments : ["PUBLIC_ENTRY", "OFFICE_ADMIN"];
  const assets = (ctx.assets_at_risk || []).length > 0 ? ctx.assets_at_risk : ["PERSONNEL", "CRITICAL_OPERATIONS"];
  
  // Create a working context with defaults
  const workingContext = {
    threat_scenarios: threats,
    environments: envs,
    assets_at_risk: assets,
    phases: ctx.phases,
  };

  const caps = new Set<CapabilityNeed>();
  for (const t of threats) {
    const arr = THREAT_TO_CAPABILITIES[t] || [];
    arr.forEach((c) => caps.add(c));
  }
  
  // Use working context for question generation
  const ctxForGeneration = workingContext;

  const discRows = await runtimePool.query<{ id: string; code: string }>(
    `SELECT id, code FROM public.disciplines WHERE is_active = true AND code IS NOT NULL`
  );
  const discByCode = new Map<string, string>();
  for (const r of discRows.rows) discByCode.set(String(r.code).toUpperCase(), r.id);

  const subRows = await runtimePool.query<{ id: string; discipline_id: string; code: string }>(
    `SELECT id, discipline_id, code FROM public.discipline_subtypes WHERE is_active = true ORDER BY discipline_id, name`
  );
  const subsByDisc = new Map<string, { id: string; code: string }[]>();
  for (const r of subRows.rows) {
    const d = r.discipline_id;
    if (!subsByDisc.has(d)) subsByDisc.set(d, []);
    subsByDisc.get(d)!.push({ id: r.id, code: r.code });
  }

  const rationale = buildRationale(ctxForGeneration);
  const candidates: DraftQuestionStub[] = [];

  for (const cap of caps) {
    const codes = CAPABILITY_TO_DISCIPLINE_CODES[cap] || [];
    for (const code of codes) {
      const discId = discByCode.get(code.toUpperCase());
      if (!discId) continue;
      const subs = subsByDisc.get(discId) || [];
      const subId = subs[0]?.id ?? null;

      const text = buildQuestionText(cap, ctxForGeneration, discId);
      if (!text || hasBanned(text)) continue;

      candidates.push({
        question_text: text,
        discipline_id: discId,
        discipline_subtype_id: subId,
        confidence: 0.6,
        rationale,
      });
    }
  }

  const byDisc = new Map<string, DraftQuestionStub[]>();
  for (const c of candidates) {
    const k = c.discipline_id;
    if (!byDisc.has(k)) byDisc.set(k, []);
    byDisc.get(k)!.push(c);
  }

  const out: DraftQuestionStub[] = [];
  const used = new Set<string>();
  const perDisc: Record<string, number> = {};

  for (const [, arr] of byDisc.entries()) {
    for (const c of arr) {
      if (out.length >= MAX_SUGGESTIONS_PER_RUN) break;
      const k = c.discipline_id;
      if ((perDisc[k] || 0) >= MAX_PER_DISCIPLINE_PER_RUN) continue;
      const key = `${c.question_text}|${k}`;
      if (used.has(key)) continue;
      used.add(key);
      perDisc[k] = (perDisc[k] || 0) + 1;
      out.push(c);
    }
    if (out.length >= MAX_SUGGESTIONS_PER_RUN) break;
  }

  return out.slice(0, MAX_SUGGESTIONS_PER_RUN);
}
