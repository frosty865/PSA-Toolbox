import { describe, it, expect } from 'vitest';
import {
  COMMUNICATIONS_PURPOSE_BLOCK,
  COMMUNICATIONS_QUESTIONS,
  COMMS_SCOPE_GUARD,
  COMMS_VS_IT_EXAMPLES,
  getPaceQuestionDefs,
  getDefaultCommsAnswers,
  CommsAnswersSchema,
  deriveCommsSinglePointFromPace,
  clearLayerForSystemType,
  isPaceLayerRunner,
  type CommPaceLayer,
} from '../infrastructure/comms_spec';
import { mapLegacyCommsToNew } from '../comms_to_category_input';

const IT_TERMS = [
  { term: 'internet', wordBoundary: true },
  { term: 'data circuit', wordBoundary: false },
  { term: 'saas', wordBoundary: true },
  { term: 'cloud apps', wordBoundary: false },
  { term: 'wan', wordBoundary: true },
  { term: 'isp', wordBoundary: true },
  { term: 'broadband', wordBoundary: true },
  { term: 'sd-wan', wordBoundary: true },
];

describe('Communications spec QC', () => {
  it('has unique question IDs across COMMUNICATIONS_QUESTIONS and PACE defs', () => {
    const ids = new Set<string>();
    for (const q of COMMUNICATIONS_QUESTIONS) {
      expect(ids.has(q.id)).toBe(false);
      ids.add(q.id);
    }
    for (const layer of ['P', 'A', 'C', 'E'] as const) {
      for (const q of getPaceQuestionDefs(layer)) {
        const id = q.id;
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }
    }
  });

  it('does not use IT terms in Communications prompts or help except in OUT-OF-SCOPE content', () => {
    const allowedLower = [
      COMMUNICATIONS_PURPOSE_BLOCK.boundary_warning,
      COMMUNICATIONS_PURPOSE_BLOCK.excludes.join(' '),
      COMMS_SCOPE_GUARD.out_of_scope,
      COMMS_VS_IT_EXAMPLES.boundary,
      COMMS_VS_IT_EXAMPLES.it.join(' '),
    ].join(' ').toLowerCase();
    const contentTexts: string[] = [
      COMMUNICATIONS_PURPOSE_BLOCK.purpose,
      COMMUNICATIONS_PURPOSE_BLOCK.includes.join(' '),
      ...COMMUNICATIONS_QUESTIONS.flatMap((q) => [q.prompt, q.helpText].filter(Boolean)),
    ];
    for (const layer of ['P', 'A', 'C', 'E'] as const) {
      for (const q of getPaceQuestionDefs(layer)) {
        contentTexts.push(q.prompt, q.helpText ?? '');
      }
    }
    for (const text of contentTexts) {
      const lower = text.toLowerCase();
      const isNegativeContext = (t: string) =>
        /\bnot\b.*\b(internet|data|saas|cloud|wan|isp|broadband)\b/i.test(t) ||
        /\bdo not\b/i.test(t) ||
        /\bonly—not\b/i.test(t) ||
        /\bexcludes?\b/i.test(t);
      for (const { term, wordBoundary } of IT_TERMS) {
        const hasTerm = wordBoundary ? new RegExp(`\\b${term.replace(/\W/g, '\\$&')}\\b`, 'i').test(text) : lower.includes(term);
        if (hasTerm && !allowedLower.includes(term) && !isNegativeContext(text)) {
          throw new Error(`Communications content must not contain IT term "${term}" outside OUT-OF-SCOPE banner/modal: ${text.slice(0, 100)}`);
        }
      }
    }
  });

  it('getDefaultCommsAnswers returns valid schema', () => {
    const defaults = getDefaultCommsAnswers();
    const result = CommsAnswersSchema.safeParse(defaults);
    expect(result.success).toBe(true);
  });

  it('deriveCommsSinglePointFromPace returns boolean or null', () => {
    const empty = getDefaultCommsAnswers();
    expect(deriveCommsSinglePointFromPace(empty)).toBeNull();
    const single = getDefaultCommsAnswers();
    single.comm_pace_P = { system_type: 'CELLULAR_VOICE', cellular_diversity: 'SINGLE_CARRIER' };
    expect(typeof deriveCommsSinglePointFromPace(single)).toBe('boolean');
  });

  it('mapLegacyCommsToNew maps CO-8 and CO-11', () => {
    const legacy = {
      'CO-8_backup_available': true,
      'CO-11_restoration_coordination': false,
    };
    const mapped = mapLegacyCommsToNew(legacy);
    expect(mapped.curve_backup_available).toBe('yes');
    expect(mapped.comm_restoration_coordination).toBe('no');
  });

  it('MANUAL_RUNNER layer must not have power/carrier/provider/route fields', () => {
    const layer = {
      system_type: 'MANUAL_RUNNER' as const,
      power_dependency: 'GENERATOR_BACKED' as const,
      provider_name: 'X',
    };
    const cleaned = clearLayerForSystemType(layer as CommPaceLayer, 'MANUAL_RUNNER');
    expect(cleaned.system_type).toBe('MANUAL_RUNNER');
    expect(cleaned.power_dependency).toBeUndefined();
    expect(cleaned.provider_name).toBeUndefined();
    expect(isPaceLayerRunner(cleaned)).toBe(true);
  });

  it('cellular layer rejects route_diversity other than UNKNOWN in schema', () => {
    const answers = getDefaultCommsAnswers();
    answers.comm_pace_P = {
      system_type: 'CELLULAR_VOICE',
      cellular_diversity: 'MULTI_CARRIER',
      route_diversity: 'DISTINCT_ROUTES',
    };
    const result = CommsAnswersSchema.safeParse(answers);
    expect(result.success).toBe(false);
  });

  it('Communications prompts/help must not contain "tower generator"', () => {
    const contentTexts: string[] = [
      COMMUNICATIONS_PURPOSE_BLOCK.purpose,
      COMMUNICATIONS_PURPOSE_BLOCK.includes.join(' '),
      ...COMMUNICATIONS_QUESTIONS.flatMap((q) => [q.prompt, q.helpText].filter(Boolean)),
    ];
    for (const layer of ['P', 'A', 'C', 'E'] as const) {
      for (const q of getPaceQuestionDefs(layer)) {
        contentTexts.push(q.prompt, q.helpText ?? '');
      }
    }
    const forbidden = ['tower generator', 'tower power'];
    for (const text of contentTexts) {
      const lower = text.toLowerCase();
      for (const term of forbidden) {
        expect(lower).not.toContain(term);
      }
    }
  });
});
