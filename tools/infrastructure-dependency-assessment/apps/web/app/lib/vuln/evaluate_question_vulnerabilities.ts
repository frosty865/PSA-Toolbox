/**
 * Question-driven vulnerability evaluation.
 * Uses QUESTION_VULN_MAP + CITATIONS; applies triggers, PRA gating, and attaches citations.
 */

import {
  QUESTION_VULN_MAP,
  QUESTION_ID_TO_ANSWER_KEYS,
  type Trigger,
  type VulnTemplate,
  type FeatureFlags,
} from './question_vuln_map';
import { CITATIONS } from './citations_registry';

export type EvaluatedVulnerability = {
  id: string;
  category: VulnTemplate['category'];
  title: string;
  summary: string;
  citations: string[];
  ofcs: VulnTemplate['ofcs'];
};

function isVulnDebugEnabled(): boolean {
  return process.env.ADA_VULN_DEBUG === '1' || process.env.ADA_VULN_DEBUG === 'true';
}

function getAnswer(input: Record<string, unknown> | undefined, qid: string): unknown {
  if (!input) return undefined;
  const keys = QUESTION_ID_TO_ANSWER_KEYS[qid] ?? [qid];
  const sources: Record<string, unknown>[] = [input];
  const answers = input.answers as Record<string, unknown> | undefined;
  if (answers && typeof answers === 'object') sources.push(answers);
  for (const k of keys) {
    for (const src of sources) {
      const v = src[k];
      if (v !== undefined && v !== null) return v;
    }
  }
  return input[qid] ?? answers?.[qid];
}

function normalizeValue(v: unknown): string | number | boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'string') {
    const lower = v.toLowerCase();
    if (lower === 'yes') return 'YES';
    if (lower === 'no') return 'NO';
    if (lower === 'unknown') return 'UNKNOWN';
    return v;
  }
  return v as string | number | boolean;
}

function evalTrigger(input: Record<string, unknown>, t: Trigger): boolean {
  switch (t.op) {
    case 'eq': {
      const ans = normalizeValue(getAnswer(input, t.questionId));
      const want =
        typeof t.value === 'string' && ['yes', 'no', 'unknown'].includes((t.value as string).toLowerCase())
          ? ((t.value as string).toUpperCase() as 'YES' | 'NO' | 'UNKNOWN')
          : t.value;
      return ans === want;
    }
    case 'neq':
      return getAnswer(input, t.questionId) !== t.value;
    case 'in': {
      const ans = getAnswer(input, t.questionId);
      return t.values.includes(ans) || t.values.includes(normalizeValue(ans));
    }
    case 'present': {
      const v = getAnswer(input, t.questionId);
      return v !== undefined && v !== null && v !== '';
    }
    case 'empty': {
      const v = getAnswer(input, t.questionId);
      return Array.isArray(v) && v.length === 0;
    }
    case 'and':
      return t.all.every((x) => evalTrigger(input, x));
    case 'or':
      return t.any.some((x) => evalTrigger(input, x));
    case 'not':
      return !evalTrigger(input, t.inner);
    default:
      return false;
  }
}

function anyTriggerSatisfied(input: Record<string, unknown>, triggers: Trigger[]): boolean {
  return (triggers ?? []).some((t) => evalTrigger(input, t));
}

export function evaluateVulnerabilitiesByCategory(
  categoryCode: VulnTemplate['category'],
  categoryInput: Record<string, unknown>,
  flags: FeatureFlags
): EvaluatedVulnerability[] {
  const out: EvaluatedVulnerability[] = [];

  if (isVulnDebugEnabled()) {
    console.log('[VULN EVAL] map keys:', Object.keys(QUESTION_VULN_MAP).length);
    const topKeys = Object.keys(categoryInput ?? {}).filter((k) => !k.startsWith('_'));
    const answersKeys =
      typeof categoryInput?.answers === 'object' && categoryInput.answers != null
        ? Object.keys(categoryInput.answers as Record<string, unknown>)
        : [];
    console.log('[VULN INPUT KEYS]', categoryCode, { top: topKeys.slice(0, 20), answers: answersKeys.slice(0, 20) });
  }

  for (const [, templates] of Object.entries(QUESTION_VULN_MAP)) {
    for (const v of templates) {
      if (v.category !== categoryCode) continue;

      if (v.requiresPRA && !flags.praEnabled) continue;

      if (!anyTriggerSatisfied(categoryInput, v.triggers)) continue;

      for (const cid of v.citations ?? []) {
        if (!CITATIONS[cid]) {
          throw new Error(`Vuln ${v.id} references missing citation ${cid}`);
        }
      }

      const ofcs = (v.ofcs ?? []).filter((o) => flags.praEnabled || !o.requiresPRA);

      out.push({
        id: v.id,
        category: v.category,
        title: v.title,
        summary: v.summary,
        citations: v.citations ?? [],
        ofcs,
      });
    }
  }

  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}
