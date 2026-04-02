/**
 * Standard (SCO) output validator: reject deep network cyber and forbidden forms;
 * allow convergence. Used after criteria generation.
 */

import {
  containsDeepNetworkCyber,
  containsForbiddenPlanElementPrefix,
} from "@/app/lib/scope/psa_scope_filter";

export const MAX_CRITERION_LENGTH = 180;

export type ValidationFailureReason =
  | "deep_network_cyber_detected"
  | "forbidden_prefix"
  | "forbidden_phrase_purpose_role"
  | "forbidden_leading_what_how"
  | "must_end_with_question"
  | "max_length_exceeded";

export interface StandardCriterionValidationError {
  index: number;
  /** Truncated for logs; use fullText for UI. */
  text: string;
  /** Full criterion text (for API response / UI). */
  fullText?: string;
  reason: ValidationFailureReason;
  message: string;
}

const PURPOSE_ROLE_PHRASE = /\b(purpose|role)\s+of\b/i;

/**
 * Validates SCO criteria/question texts. Convergence-only content is allowed.
 * @throws Error with message and optional validationErrors array (StandardCriterionValidationError[])
 */
export function validateStandardCriteriaOrThrow(
  criteriaTexts: string[]
): void {
  const errors: StandardCriterionValidationError[] = [];

  criteriaTexts.forEach((text, index) => {
    const t = (text ?? "").trim();

    const snippet = t.slice(0, 80) + (t.length > 80 ? "…" : "");
    const push = (reason: ValidationFailureReason, message: string) => {
      errors.push({ index, text: snippet, fullText: t, reason, message });
    };

    if (containsForbiddenPlanElementPrefix(t)) {
      push("forbidden_prefix", "Criterion must not start with 'Plan element exists:'");
      return;
    }

    if (containsDeepNetworkCyber(t)) {
      push("deep_network_cyber_detected", "Criterion contains deep network/technical cyber content (not allowed in SCO)");
      return;
    }

    if (/^\s*(What|How)\b/i.test(t)) {
      push("forbidden_leading_what_how", "Criterion must not start with 'What' or 'How'");
      return;
    }

    if (PURPOSE_ROLE_PHRASE.test(t)) {
      push("forbidden_phrase_purpose_role", "Criterion must not contain 'purpose of' or 'role of' (technical component phrasing)");
      return;
    }

    if (!t.endsWith("?")) {
      push("must_end_with_question", "Criterion must end with '?'");
      return;
    }

    if (t.length > MAX_CRITERION_LENGTH) {
      push("max_length_exceeded", `Criterion must be <= ${MAX_CRITERION_LENGTH} chars (got ${t.length})`);
    }
  });

  if (errors.length > 0) {
    const byReason: Record<ValidationFailureReason, number> = {
      deep_network_cyber_detected: 0,
      forbidden_prefix: 0,
      forbidden_phrase_purpose_role: 0,
      forbidden_leading_what_how: 0,
      must_end_with_question: 0,
      max_length_exceeded: 0,
    };
    errors.forEach((e) => { byReason[e.reason]++; });
    const err = new Error(
      `Standard criteria validation failed: ${errors.length} error(s). ` +
        Object.entries(byReason)
          .filter(([, n]) => n > 0)
          .map(([r, n]) => `${r}=${n}`)
          .join(", ")
    ) as Error & {
      validationErrors: StandardCriterionValidationError[];
      byReason: Record<ValidationFailureReason, number>;
    };
    err.validationErrors = errors;
    err.byReason = byReason;
    throw err;
  }
}
