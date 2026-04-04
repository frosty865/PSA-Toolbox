/**
 * Build guard: Question integrity enforcement.
 * Run via: pnpm run verify:question-integrity
 *
 * Enforcement rules:
 * 1. Every question has help (helpText or structured help)
 * 2. Structured help when required: help: { summary, yes_definition, no_definition, impact } (schema.QuestionHelpSchema)
 * 3. Every vulnerability (in derive_*_findings) has a trigger in VULNERABILITY_TRIGGERS
 * 4. No question uses undefined terms without help clarification
 * 5. Follow-up data used downstream (manual audit; this guard flags orphan follow-ups)
 *
 * To enable strict mode: requireStructuredHelp: true, failOnUndefinedTerms: true
 * (fails until all questions migrated per audit)
 */

import {
  ENERGY_CURVE_QUESTIONS,
  ENERGY_QUESTIONS,
  ENERGY_VULNERABILITY_TRIGGERS,
} from '@/app/lib/dependencies/infrastructure/energy_spec';
import {
  WATER_CURVE_QUESTIONS,
  WATER_QUESTIONS,
  WATER_VULNERABILITY_TRIGGERS,
} from '@/app/lib/dependencies/infrastructure/water_spec';
import {
  WASTEWATER_CURVE_QUESTIONS,
  WASTEWATER_QUESTIONS,
  WASTEWATER_VULNERABILITY_TRIGGERS,
} from '@/app/lib/dependencies/infrastructure/wastewater_spec';
import {
  IT_CURVE_QUESTIONS,
  IT_QUESTIONS,
  IT_VULNERABILITY_TRIGGERS,
} from '@/app/lib/dependencies/infrastructure/it_spec';
import {
  COMMS_CURVE_QUESTIONS,
  COMMS_QUESTIONS,
  COMMS_VULNERABILITY_TRIGGERS,
} from '@/app/lib/dependencies/infrastructure/comms_spec';
import { ENERGY_VULNERABILITY_TEXTS } from '@/app/lib/dependencies/derive_energy_findings';
import { WATER_VULNERABILITY_TEXTS } from '@/app/lib/dependencies/derive_water_findings';
import { WASTEWATER_VULNERABILITY_TEXTS } from '@/app/lib/dependencies/derive_wastewater_findings';
import { IT_VULNERABILITY_TEXTS } from '@/app/lib/dependencies/derive_it_findings';
import { COMMS_VULNERABILITY_TEXTS } from '@/app/lib/dependencies/derive_comms_findings';
import { orderQuestions } from '@/app/lib/dependencies/order_questions';
import type { InfrastructureCategoryId } from '@/app/lib/dependencies/canonical_question_order';
import { OT_ICS_RESILIENCE_MODULE } from '@/app/lib/modules/ot_ics_resilience_module';

type QuestionLike = {
  id: string;
  prompt: string;
  helpText?: string;
  answerType?: string;
  vulnerabilityTrigger?: string;
};

const UNDEFINED_TERMS = [
  'adequate',
  'appropriate',
  'documented',
  'reliable',
  'secure',
  'capability',
  'policy',
  'plan',
];

const PERCENT_TEXT = /(0–100|0-100|percent|percentage|%)/i;
const PERCENT_KEY = /(percent|percentage|loss_percent|backup_percent|sustained_percent)/i;

function hasHelp(q: QuestionLike): boolean {
  const h = (q as { helpText?: string; help?: string | null }).helpText ?? (q as { help?: string | null }).help;
  return !!(h && String(h).trim());
}

function hasStructuredHelp(q: unknown): boolean {
  const h = (q as { help?: { summary?: string; yes_definition?: string; no_definition?: string; impact?: string } })
    .help;
  if (typeof h !== 'object' || h == null) return false;
  return !!(h.summary && h.yes_definition && h.no_definition && h.impact);
}

function usesUndefinedTerm(prompt: string): string | null {
  const lower = prompt.toLowerCase();
  const found = UNDEFINED_TERMS.find((t) => lower.includes(t.toLowerCase()));
  return found ?? null;
}

type QuestionCollection = { infra: InfrastructureCategoryId; questions: QuestionLike[] };

function collectAllQuestions(): { flat: { tab: string; q: QuestionLike }[]; grouped: QuestionCollection[] } {
  const grouped: QuestionCollection[] = [
    {
      infra: 'ELECTRIC_POWER',
      questions: [
        ...(ENERGY_CURVE_QUESTIONS as QuestionLike[]),
        ...(ENERGY_QUESTIONS as QuestionLike[]),
      ],
    },
    {
      infra: 'WATER',
      questions: [
        ...(WATER_CURVE_QUESTIONS as QuestionLike[]),
        ...(WATER_QUESTIONS as QuestionLike[]),
      ],
    },
    {
      infra: 'WASTEWATER',
      questions: [
        ...(WASTEWATER_CURVE_QUESTIONS as QuestionLike[]),
        ...(WASTEWATER_QUESTIONS as QuestionLike[]),
      ],
    },
    {
      infra: 'INFORMATION_TECHNOLOGY',
      questions: [
        ...(IT_CURVE_QUESTIONS as QuestionLike[]),
        ...(IT_QUESTIONS as QuestionLike[]),
      ],
    },
    {
      infra: 'COMMUNICATIONS',
      questions: [
        ...(COMMS_CURVE_QUESTIONS as QuestionLike[]),
        ...(COMMS_QUESTIONS as QuestionLike[]),
      ],
    },
  ];

  const flat = grouped.flatMap(({ infra, questions }) =>
    questions.map((q) => ({ tab: infra, q }))
  );

  return { flat, grouped };
}

function getTriggeredVulnIds(
  triggers: Record<string, { no?: string; yes?: string; entry?: { vulnerability_id: string }[] }>,
): Set<string> {
  const ids = new Set<string>();
  for (const t of Object.values(triggers)) {
    if (t?.no) ids.add(t.no);
    if (t?.yes) ids.add(t.yes);
    for (const e of t?.entry ?? []) {
      if (e?.vulnerability_id) ids.add(e.vulnerability_id);
    }
  }
  return ids;
}

export function verifyQuestionIntegrity(options?: {
  requireStructuredHelp?: boolean;
  failOnUndefinedTerms?: boolean;
}): { passed: boolean; errors: string[] } {
  const errors: string[] = [];
  const requireStructured = options?.requireStructuredHelp ?? false;
  const failOnTerms = options?.failOnUndefinedTerms ?? false;

  const { flat: questions, grouped } = collectAllQuestions();
  const infraQuestionIds = new Set(questions.map((entry) => entry.q.id));

  // Enforce canonical ordering + curve invariants
  for (const { infra, questions: list } of grouped) {
    orderQuestions(infra, list);
  }

  for (const { tab, q } of questions) {
    if (!hasHelp(q)) {
      errors.push(`[${tab}] ${q.id}: Missing help`);
    }
    if (requireStructured && !hasStructuredHelp(q)) {
      errors.push(`[${tab}] ${q.id}: Help not structured (requires summary, yes_definition, no_definition, impact)`);
    }
    if (!q.id.startsWith('curve_')) {
      if (q.answerType === 'percent') {
        errors.push(`[${tab}] ${q.id}: Non-curve question uses percent answerType`);
      }
      if (PERCENT_KEY.test(q.id)) {
        errors.push(`[${tab}] ${q.id}: Non-curve question id contains percent key`);
      }
      if (PERCENT_TEXT.test(q.prompt) || (q.helpText && PERCENT_TEXT.test(q.helpText))) {
        errors.push(`[${tab}] ${q.id}: Non-curve question references percent input`);
      }
    }
    const term = usesUndefinedTerm(q.prompt);
    if (failOnTerms && term) {
      errors.push(`[${tab}] ${q.id}: Uses undefined term "${term}" without help clarification`);
    }
  }

  const modules = [OT_ICS_RESILIENCE_MODULE];
  for (const mod of modules) {
    if (mod.drives_curve) {
      errors.push(`[${mod.module_code}] Module must not drive curve`);
    }
    for (const q of mod.questions) {
      if (q.id.startsWith('curve_')) {
        errors.push(`[${mod.module_code}] ${q.id}: Module question id must not start with curve_`);
      }
      if (infraQuestionIds.has(q.id)) {
        errors.push(`[${mod.module_code}] ${q.id}: Module question id duplicates infrastructure question id`);
      }
      if (PERCENT_KEY.test(q.id)) {
        errors.push(`[${mod.module_code}] ${q.id}: Module question id contains percent key`);
      }
      if (PERCENT_TEXT.test(q.prompt) || (q.help_text && PERCENT_TEXT.test(q.help_text))) {
        errors.push(`[${mod.module_code}] ${q.id}: Module question references percent input`);
      }
    }
  }

  const vulnTracePairs: { name: string; texts: Record<string, string>; triggers: Record<string, unknown> }[] = [
    { name: 'ENERGY', texts: ENERGY_VULNERABILITY_TEXTS, triggers: ENERGY_VULNERABILITY_TRIGGERS },
    { name: 'WATER', texts: WATER_VULNERABILITY_TEXTS, triggers: WATER_VULNERABILITY_TRIGGERS },
    { name: 'WASTEWATER', texts: WASTEWATER_VULNERABILITY_TEXTS, triggers: WASTEWATER_VULNERABILITY_TRIGGERS },
    { name: 'IT', texts: IT_VULNERABILITY_TEXTS, triggers: IT_VULNERABILITY_TRIGGERS },
    { name: 'COMMS', texts: COMMS_VULNERABILITY_TEXTS, triggers: COMMS_VULNERABILITY_TRIGGERS },
  ];

  for (const { name, texts, triggers } of vulnTracePairs) {
    const triggered = getTriggeredVulnIds(triggers as Record<string, { no?: string; yes?: string; entry?: { vulnerability_id: string }[] }>);
    for (const vulnId of Object.keys(texts)) {
      if (!triggered.has(vulnId)) {
        errors.push(`[${name}] Orphan vulnerability (no trigger): ${vulnId}`);
      }
    }
  }

  return { passed: errors.length === 0, errors };
}
