/**
 * Plan type resolution: module metadata → request override → source titles → fallback.
 * Never default to "Physical Security Plan" unless explicitly selected.
 */

/** PLAN modules use schema-first plan capabilities (plan_schemas). */
const PLAN_MODULE_CODES = new Set(["MODULE_ACTIVE_ASSAILANT_EMERGENCY_ACTION_PLAN"]);

export function isPlanModule(moduleCode: string): boolean {
  const code = (moduleCode ?? "").trim().toUpperCase();
  return code.length > 0 && PLAN_MODULE_CODES.has(code);
}

export type PlanTypeResult = {
  plan_type: string;
  confidence: "high" | "medium" | "low";
  reason: string;
};

function norm(s: string): string {
  return (s || "").toLowerCase();
}

export function resolvePlanType(opts: {
  module_plan_type?: string | null;
  request_plan_type?: string | null;
  source_titles?: string[];
}): PlanTypeResult {
  const modulePlan = (opts.module_plan_type ?? "").trim();
  if (modulePlan) return { plan_type: modulePlan, confidence: "high", reason: "module metadata" };

  const reqPlan = (opts.request_plan_type ?? "").trim();
  if (reqPlan) return { plan_type: reqPlan, confidence: "high", reason: "request override" };

  const titles = (opts.source_titles ?? []).map(norm).join(" | ");

  if (titles.includes("active shooter") || titles.includes("active assailant")) {
    return { plan_type: "Active Assailant Emergency Action Plan", confidence: "medium", reason: "source titles" };
  }

  if (titles.includes("emergency action plan") || titles.includes("eap") || titles.includes("cisa eap")) {
    return { plan_type: "Emergency Action Plan", confidence: "medium", reason: "source titles" };
  }

  if (titles.includes("continuity") || titles.includes("coop")) {
    return { plan_type: "Continuity of Operations Plan", confidence: "medium", reason: "source titles" };
  }

  return { plan_type: "Emergency Action Plan", confidence: "low", reason: "fallback default" };
}
