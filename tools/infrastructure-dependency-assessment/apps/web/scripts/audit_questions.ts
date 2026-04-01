/**
 * Duplicate / Rogue Question Audit (Baby Step 1).
 * Lists every question per tab, flags duplicates and prefix mismatches.
 * Fails (exit 1) ONLY when duplicate IDs exist.
 *
 * Usage: pnpm audit:questions (from asset-dependency-tool/apps/web)
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ENERGY_CURVE_QUESTIONS,
  ENERGY_QUESTIONS,
} from '@/app/lib/dependencies/infrastructure/energy_spec';
import {
  COMMS_CURVE_QUESTIONS,
  COMMS_QUESTIONS,
} from '@/app/lib/dependencies/infrastructure/comms_spec';
import {
  IT_CURVE_QUESTIONS,
  IT_QUESTIONS,
} from '@/app/lib/dependencies/infrastructure/it_spec';
import {
  WATER_CURVE_QUESTIONS,
  WATER_QUESTIONS,
} from '@/app/lib/dependencies/infrastructure/water_spec';
import {
  WASTEWATER_CURVE_QUESTIONS,
  WASTEWATER_QUESTIONS,
} from '@/app/lib/dependencies/infrastructure/wastewater_spec';

type QuestionLike = { id?: string; prompt?: string };
type GlobalIdOccurrence = { tab: string; index: number; source?: string; prompt: string };
type GlobalIdCollision = { id: string; count: number; occurrences: GlobalIdOccurrence[] };

function normPrompt(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

function groupBy<T>(arr: T[], keyFn: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of arr) {
    const k = keyFn(t);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(t);
  }
  return m;
}

/** Tab ID -> questions (curve first, then main). Same as UI and verify_question_integrity. */
function getQuestionsForTab(tabId: string): { id?: string; prompt?: string; source?: string }[] {
  const toItems = (q: QuestionLike, source: string) => ({
    id: (q as { id?: string }).id,
    prompt: (q as { prompt?: string }).prompt,
    source,
  });
  switch (tabId) {
    case 'ELECTRIC_POWER':
      return [
        ...ENERGY_CURVE_QUESTIONS.map((q) => toItems(q, 'infrastructure/energy_spec.ts')),
        ...ENERGY_QUESTIONS.map((q) => toItems(q, 'infrastructure/energy_spec.ts')),
      ];
    case 'COMMUNICATIONS':
      return [
        ...COMMS_CURVE_QUESTIONS.map((q) => toItems(q, 'infrastructure/comms_spec.ts')),
        ...COMMS_QUESTIONS.map((q) => toItems(q, 'infrastructure/comms_spec.ts')),
      ];
    case 'INFORMATION_TECHNOLOGY':
      return [
        ...IT_CURVE_QUESTIONS.map((q) => toItems(q, 'infrastructure/it_spec.ts')),
        ...IT_QUESTIONS.map((q) => toItems(q, 'infrastructure/it_spec.ts')),
      ];
    case 'WATER':
      return [
        ...WATER_CURVE_QUESTIONS.map((q) => toItems(q, 'infrastructure/water_spec.ts')),
        ...WATER_QUESTIONS.map((q) => toItems(q, 'infrastructure/water_spec.ts')),
      ];
    case 'WASTEWATER':
      return [
        ...WASTEWATER_CURVE_QUESTIONS.map((q) => toItems(q, 'infrastructure/wastewater_spec.ts')),
        ...WASTEWATER_QUESTIONS.map((q) => toItems(q, 'infrastructure/wastewater_spec.ts')),
      ];
    default:
      return [];
  }
}

async function main(): Promise<void> {
  const expectedPrefixes: Record<string, string[]> = {
    ELECTRIC_POWER: ['E-', 'E_', 'curve_', 'ELECTRIC_'],
    COMMUNICATIONS: ['CO-', 'CO_', 'curve_', 'COM_', 'COMM_'],
    INFORMATION_TECHNOLOGY: ['IT-', 'IT_', 'it_', 'curve_', 'INFO_'],
    WATER: ['W_', 'WATER_', 'curve_'],
    WASTEWATER: ['WW_', 'WASTEWATER_', 'curve_'],
  };

  const report: {
    generated_at: string;
    tabs: Record<
      string,
      {
        count: number;
        ids_missing: Array<{ index: number; prompt?: string }>;
        id_dupes: Array<{
          id: string;
          count: number;
          indices: number[];
          prompts: string[];
        }>;
        prompt_dupes: Array<{
          prompt_norm: string;
          count: number;
          indices: number[];
          prompts: string[];
        }>;
        prefix_mismatches: Array<{ index: number; id: string; prompt?: string }>;
        items: Array<{
          index: number;
          id: string;
          prompt: string;
          prompt_norm: string;
          source?: string;
        }>;
        intent_dupes: Array<{ reason: string; ids: string[]; prompts: string[] }>;
      }
    >;
    global_id_collisions: GlobalIdCollision[];
    summary: { total_questions: number; tabs: number; hard_fail: boolean };
  } = {
    generated_at: new Date().toISOString(),
    tabs: {},
    global_id_collisions: [],
    summary: { total_questions: 0, tabs: 0, hard_fail: false },
  };

  const tabIds = Object.keys(expectedPrefixes);
  let hardFail = false;
  const globalIdMap = new Map<string, GlobalIdOccurrence[]>();
  const curveCollisionWarnings: string[] = [];

  for (const tab of tabIds) {
    const questions = getQuestionsForTab(tab);

    const idsMissing: Array<{ index: number; prompt?: string }> = [];
    const items = questions.map((q, idx) => {
      const id = (q.id ?? '').trim();
      const prompt = (q.prompt ?? '').trim();
      if (!id) idsMissing.push({ index: idx, prompt });
      return {
        index: idx,
        id,
        prompt,
        prompt_norm: normPrompt(prompt),
        source: q.source,
      };
    });

    for (const item of items) {
      if (!item.id) continue;
      if (!globalIdMap.has(item.id)) globalIdMap.set(item.id, []);
      globalIdMap.get(item.id)!.push({
        tab,
        index: item.index,
        source: item.source,
        prompt: item.prompt,
      });
    }

    const idGroups = groupBy(items.filter((x) => x.id), (x) => x.id);
    const idDupes = Array.from(idGroups.entries())
      .filter(([, arr]) => arr.length > 1)
      .map(([id, arr]) => ({
        id,
        count: arr.length,
        indices: arr.map((a) => a.index),
        prompts: arr.map((a) => a.prompt),
      }));

    if (idDupes.length > 0) hardFail = true;

    const promptGroups = groupBy(items.filter((x) => x.prompt_norm), (x) => x.prompt_norm);
    const promptDupes = Array.from(promptGroups.entries())
      .filter(([, arr]) => arr.length > 1)
      .map(([k, arr]) => ({
        prompt_norm: k,
        count: arr.length,
        indices: arr.map((a) => a.index),
        prompts: arr.map((a) => a.prompt),
      }));

    const prefixes = expectedPrefixes[tab] ?? [];
    const prefixMismatches = items
      .filter((x) => x.id)
      .filter((x) => prefixes.length > 0 && !prefixes.some((p) => x.id.startsWith(p)))
      .map((x) => ({ index: x.index, id: x.id, prompt: x.prompt }));

    const intentDupes: Array<{ reason: string; ids: string[]; prompts: string[] }> = [];
    const intentPatterns: Array<{ reason: string; regex: RegExp }> = [
      { reason: 'pattern:_backup_adequacy', regex: /_backup_adequacy$/i },
      { reason: 'pattern:_backup_tested', regex: /_backup_tested$/i },
      { reason: 'pattern:_restoration_coordination', regex: /_restoration_coordination$/i },
    ];

    for (const { reason, regex } of intentPatterns) {
      const matches = items.filter((item) => item.id && regex.test(item.id));
      if (matches.length > 0) {
        intentDupes.push({
          reason,
          ids: matches.map((m) => m.id),
          prompts: matches.map((m) => m.prompt),
        });
      }
    }

    const comboChecks: Record<string, Array<{ reason: string; ids: string[] }>> = {
      ELECTRIC_POWER: [
        {
          reason: 'E-11 and E-restoration_coordination present',
          ids: ['E-11', 'E-restoration_coordination'],
        },
      ],
      COMMUNICATIONS: [
        {
          reason: 'CO-11 and CO-restoration_coordination present',
          ids: ['CO-11', 'CO-restoration_coordination'],
        },
      ],
      INFORMATION_TECHNOLOGY: [
        {
          reason: 'IT-11 and IT-restoration_coordination present',
          ids: ['IT-11', 'IT-restoration_coordination'],
        },
      ],
    };

    const combos = comboChecks[tab] ?? [];
    for (const combo of combos) {
      const matches = combo.ids
        .map((id) => items.find((item) => item.id === id))
        .filter((x): x is typeof items[number] => Boolean(x));
      if (matches.length === combo.ids.length) {
        intentDupes.push({
          reason: combo.reason,
          ids: matches.map((m) => m.id),
          prompts: matches.map((m) => m.prompt),
        });
      }
    }

    report.tabs[tab] = {
      count: items.length,
      ids_missing: idsMissing,
      id_dupes: idDupes,
      prompt_dupes: promptDupes,
      prefix_mismatches: prefixMismatches,
      items,
      intent_dupes: intentDupes,
    };

    report.summary.total_questions += items.length;
    report.summary.tabs += 1;
  }

  const globalCollisions: GlobalIdCollision[] = [];
  for (const [id, occurrences] of globalIdMap.entries()) {
    if (occurrences.length <= 1) continue;
    const collision: GlobalIdCollision = {
      id,
      count: occurrences.length,
      occurrences,
    };
    globalCollisions.push(collision);

    if (id.startsWith('curve_')) {
      curveCollisionWarnings.push(
        `[WARN] curve_* id collision detected across tabs for ${id} (${occurrences.length} occurrences).`,
      );
    } else {
      hardFail = true;
      console.error(
        `[ERROR] Cross-tab question id collision detected for ${id} (${occurrences.length} occurrences). This must be unique.`,
      );
    }
  }

  report.global_id_collisions = globalCollisions;

  for (const warn of curveCollisionWarnings) {
    console.warn(warn);
  }

  report.summary.hard_fail = hardFail;

  const outPath = path.resolve(process.cwd(), '..', '..', 'audit', 'question_audit_report.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  if (hardFail) {
    console.error(
      'Question audit FAILED: duplicate question IDs detected. See audit/question_audit_report.json',
    );
    process.exit(1);
  } else {
    if (curveCollisionWarnings.length > 0) {
      console.warn(
        'Question audit OK with curve_* collision warnings. See audit/question_audit_report.json',
      );
    } else {
      console.log(
        'Question audit OK (no duplicate IDs). Report: audit/question_audit_report.json',
      );
    }
  }
}

main().catch((err) => {
  console.error(err?.stack ?? String(err));
  process.exit(1);
});
