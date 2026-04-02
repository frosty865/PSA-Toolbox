import type {
  AnyStandard,
  StandardType,
  StandardsGenOptions,
  ValidationFailure,
  StandardQualityMetrics,
} from "./standards_validator";
import {
  applyDeterministicCodes,
  parseAndValidateStandardFromModelText,
  measureStandardQuality,
} from "./standards_validator";
import { ollamaGenerate } from "./ollama_client";

const OLLAMA_TIMEOUT_MS = 120_000;
const DEFAULT_BEST_OF = 2;
const MAX_BEST_OF = 3;

/**
 * Calls Ollama /api/generate and returns the raw model response text.
 */
async function callOllamaGenerate(args: { model: string; prompt: string }): Promise<string> {
  const result = await ollamaGenerate(
    { model: args.model, prompt: args.prompt, stream: false },
    OLLAMA_TIMEOUT_MS,
    "general"
  );
  return typeof result?.response === "string" ? result.response : "";
}

export type GenerateStandardArgs = {
  standardType: StandardType; // "plan" | "object"
  topic: string; // e.g., "Emergency Action Plan (EAP) program" or "Video Surveillance System (VSS)"
  /** Use resolveStandardsModel(standardType) so plan -> psa-plan-standard:latest, object -> psa-object-standard:latest. */
  model: string;
  options?: StandardsGenOptions;
  /** Number of candidates per attempt; clamps to 1..3. Defaults to STANDARDS_BEST_OF or 2. */
  bestOf?: number;
};

export type GenerateStandardResult =
  | { ok: true; standard: ReturnType<typeof applyDeterministicCodes<AnyStandard>> }
  | { ok: false; error: string; failures?: ValidationFailure[]; modelOutputSnippet?: string };

type InvalidCandidate = {
  failures: ValidationFailure[];
  modelOutputSnippet: string;
  weightedFailureScore: number;
};

type ValidCandidate = {
  standard: AnyStandard;
  modelOutputSnippet: string;
  qualityScore: number;
};

function buildPrompt(standardType: StandardType, topic: string, opts: StandardsGenOptions): string {
  const base =
    standardType === "plan"
      ? `Create a PLAN standard for ${topic}. JSON only. Return ONE JSON object only.`
      : `Create an OBJECT standard for ${topic}. JSON only. Return ONE JSON object only.`;

  const constraints: string[] = [];

  // Always ban placeholders at prompt level (validator also enforces)
  constraints.push("Do not include placeholder tokens such as <string>, <OBJ_...>, <PLAN_...>, < or >, or ...");

  // Force counts at prompt level (validator enforces)
  constraints.push("required_elements must be 8-12 items.");
  constraints.push("Each element must have 2-4 criteria.");
  constraints.push(
    standardType === "plan"
      ? "Each element must have 2-4 evidence_examples."
      : "Each element must have 2-4 field_checks."
  );

  // Optional bans
  if (opts.forbidCadence)
    constraints.push(
      "Do not include any cadence, frequency, or durations (e.g., annual, quarterly, 30 days, within 24 hours)."
    );
  if (standardType === "plan" && opts.forbidImplementationDetails)
    constraints.push(
      "Do not mention specific technologies or channels (e.g., email, app, web form, intranet). Use generic artifact descriptions."
    );
  if (standardType === "object" && opts.forbidCyberConfig)
    constraints.push(
      "Do not include cyber/IT configuration details (IP, ports, network, internet, VLAN, firewall, passwords, firmware)."
    );
  if (opts.forbidScenarioSpecific)
    constraints.push("Do not include scenario-specific items (e.g., license plates) unless explicitly requested.");

  return `${base}\n\nConstraints:\n- ${constraints.join("\n- ")}`;
}

function formatFailures(failures: ValidationFailure[]): string {
  // Keep it short and concrete so the model can repair.
  const uniq = new Map<string, ValidationFailure>();
  for (const failure of failures) {
    uniq.set(`${failure.code}:${failure.path ?? ""}:${failure.message}`, failure);
  }

  const lines = Array.from(uniq.values())
    .slice(0, 12)
    .map((failure) => {
      const where = failure.path ? ` @ ${failure.path}` : "";
      return `${failure.code}${where}: ${failure.message}`;
    });
  return lines.join("\n");
}

const FAILURE_WEIGHTS: Record<ValidationFailure["code"], number> = {
  JSON_PARSE: 14,
  TYPE_MISMATCH: 12,
  MISSING_TITLE: 8,
  ELEMENT_COUNT: 10,
  ELEMENT_SHAPE: 10,
  PLACEHOLDER: 10,
  CADENCE: 7,
  IMPLEMENTATION_DETAIL: 7,
  CYBER_CONFIG: 8,
  SCENARIO_SPECIFIC: 7,
  WEAK_CRITERIA: 6,
  DUPLICATE_CRITERIA: 9,
  DUPLICATE_ELEMENTS: 9,
  LOW_DIVERSITY: 9,
};

function scoreFailures(failures: ValidationFailure[]): number {
  let score = 0;
  for (const failure of failures) {
    score += FAILURE_WEIGHTS[failure.code] ?? 5;
  }
  return score;
}

function aggregateRecurringFailures(candidates: InvalidCandidate[]): string {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    for (const failure of candidate.failures) {
      const key = failure.code;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  if (counts.size === 0) return "";

  const lines = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([code, count]) => `- ${code}: ${count} occurrence(s)`);
  return lines.join("\n");
}

function resolveBestOf(bestOfArg?: number): number {
  const fromEnv = parseInt(process.env.STANDARDS_BEST_OF || "", 10);
  const requested = bestOfArg ?? (Number.isFinite(fromEnv) ? fromEnv : DEFAULT_BEST_OF);
  if (!Number.isFinite(requested)) return DEFAULT_BEST_OF;
  return Math.max(1, Math.min(MAX_BEST_OF, Math.trunc(requested)));
}

/**
 * Scores a valid standards candidate to prefer richer, less repetitive outputs.
 * Higher score is better.
 */
export function scoreStandardCandidate(standard: AnyStandard): number {
  const metrics: StandardQualityMetrics = measureStandardQuality(standard);

  // Weighted to prioritize lexical diversity and adequately detailed criteria.
  return (
    metrics.lexicalDiversity * 100 +
    metrics.avgCriterionTokens * 2.5 +
    Math.min(metrics.minCriterionTokens, 10) -
    metrics.duplicateCriteriaPairs * 20 -
    metrics.duplicateElementTitles * 25
  );
}

export async function generateStandardWithRepair(args: GenerateStandardArgs): Promise<GenerateStandardResult> {
  const { standardType, topic, model } = args;

  const opts: StandardsGenOptions =
    args.options ??
    (standardType === "plan"
      ? {
          forbidCadence: true,
          forbidImplementationDetails: true,
          forbidCyberConfig: false,
          forbidScenarioSpecific: false,
        }
      : {
          forbidCadence: true,
          forbidImplementationDetails: false,
          forbidCyberConfig: true,
          forbidScenarioSpecific: true,
        });

  const maxAttempts = 3; // initial + 2 repairs
  const bestOf = resolveBestOf(args.bestOf);
  let lastFailures: ValidationFailure[] | undefined;
  let lastRawSnippet: string | undefined;

  let prompt = buildPrompt(standardType, topic, opts);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const validCandidates: ValidCandidate[] = [];
    const invalidCandidates: InvalidCandidate[] = [];

    for (let i = 0; i < bestOf; i++) {
      const raw = await callOllamaGenerate({ model, prompt });
      const snippet = (raw ?? "").slice(0, 600);
      const parsed = parseAndValidateStandardFromModelText(raw, standardType, opts);

      if (parsed.ok) {
        validCandidates.push({
          standard: parsed.standard,
          modelOutputSnippet: snippet,
          qualityScore: scoreStandardCandidate(parsed.standard),
        });
      } else {
        invalidCandidates.push({
          failures: parsed.failures,
          modelOutputSnippet: snippet,
          weightedFailureScore: scoreFailures(parsed.failures),
        });
      }
    }

    if (validCandidates.length > 0) {
      validCandidates.sort((a, b) => b.qualityScore - a.qualityScore);
      const best = validCandidates[0];
      const coded = applyDeterministicCodes(best.standard);
      return { ok: true, standard: coded };
    }

    invalidCandidates.sort((a, b) => a.weightedFailureScore - b.weightedFailureScore);
    const bestInvalid = invalidCandidates[0];
    if (!bestInvalid) {
      break;
    }

    lastFailures = bestInvalid.failures;
    lastRawSnippet = bestInvalid.modelOutputSnippet;

    // Build repair prompt from strongest invalid candidate, plus recurring issue summary.
    const failureText = formatFailures(bestInvalid.failures);
    const recurring = aggregateRecurringFailures(invalidCandidates);

    prompt =
      buildPrompt(standardType, topic, opts) +
      `\n\nREPAIR:\nYour last output failed validation. Fix the issues below and return ONE corrected JSON object only.\n${failureText}` +
      (recurring ? `\n\nMost recurring issues in this attempt:\n${recurring}` : "");
  }

  return {
    ok: false,
    error: `Standards generation failed after ${maxAttempts} attempts (bestOf=${bestOf}).`,
    failures: lastFailures,
    modelOutputSnippet: lastRawSnippet,
  };
}
