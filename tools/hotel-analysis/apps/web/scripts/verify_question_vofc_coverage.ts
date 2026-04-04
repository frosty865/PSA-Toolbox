import fs from 'node:fs/promises';
import path from 'node:path';
import { ENERGY_QUESTIONS } from '@/app/lib/dependencies/infrastructure/energy_spec';
import { COMMS_QUESTIONS } from '@/app/lib/dependencies/infrastructure/comms_spec';
import { IT_QUESTIONS } from '@/app/lib/dependencies/infrastructure/it_spec';
import { WATER_QUESTIONS } from '@/app/lib/dependencies/infrastructure/water_spec';
import { WASTEWATER_QUESTIONS } from '@/app/lib/dependencies/infrastructure/wastewater_spec';
import { QUESTION_ID_TO_ANSWER_KEYS, QUESTION_VULN_MAP } from '@/app/lib/vuln/question_vuln_map';

type Sector =
  | 'ELECTRIC_POWER'
  | 'COMMUNICATIONS'
  | 'INFORMATION_TECHNOLOGY'
  | 'WATER'
  | 'WASTEWATER';

type QuestionDef = {
  id?: string;
  prompt?: string;
  deprecated?: boolean;
};

type GapRow = {
  sector: Sector;
  questionId: string;
  prompt: string;
  reason: 'UNMAPPED_QUESTION' | 'VULN_OFC_LT3';
  details: string;
};

function collectTemplatesForQuestion(questionId: string) {
  const keys = new Set<string>([questionId, ...(QUESTION_ID_TO_ANSWER_KEYS[questionId] ?? [])]);
  const templates = new Map<string, { id: string; ofcCount: number }>();
  for (const key of keys) {
    const list = QUESTION_VULN_MAP[key];
    if (!Array.isArray(list) || list.length === 0) continue;
    for (const v of list) {
      if (!templates.has(v.id)) {
        templates.set(v.id, { id: v.id, ofcCount: Array.isArray(v.ofcs) ? v.ofcs.length : 0 });
      }
    }
  }
  return [...templates.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function collectGaps(sector: Sector, questions: QuestionDef[]): GapRow[] {
  const gaps: GapRow[] = [];
  for (const q of questions) {
    const id = (q.id ?? '').trim();
    if (!id || q.deprecated) continue;
    const templates = collectTemplatesForQuestion(id);
    const prompt = (q.prompt ?? '').trim();
    if (templates.length === 0) {
      gaps.push({
        sector,
        questionId: id,
        prompt,
        reason: 'UNMAPPED_QUESTION',
        details: 'No vulnerability templates resolved for question id/aliases.',
      });
      continue;
    }
    const underfilled = templates.filter((t) => t.ofcCount < 3);
    for (const t of underfilled) {
      gaps.push({
        sector,
        questionId: id,
        prompt,
        reason: 'VULN_OFC_LT3',
        details: `${t.id} has ${t.ofcCount} OFC(s), minimum required is 3.`,
      });
    }
  }
  return gaps;
}

async function main() {
  const gaps: GapRow[] = [
    ...collectGaps('ELECTRIC_POWER', ENERGY_QUESTIONS as QuestionDef[]),
    ...collectGaps('COMMUNICATIONS', COMMS_QUESTIONS as QuestionDef[]),
    ...collectGaps('INFORMATION_TECHNOLOGY', IT_QUESTIONS as QuestionDef[]),
    ...collectGaps('WATER', WATER_QUESTIONS as QuestionDef[]),
    ...collectGaps('WASTEWATER', WASTEWATER_QUESTIONS as QuestionDef[]),
  ];

  const bySector = new Map<Sector, GapRow[]>();
  for (const gap of gaps) {
    const list = bySector.get(gap.sector) ?? [];
    list.push(gap);
    bySector.set(gap.sector, list);
  }

  const sectors: Sector[] = [
    'ELECTRIC_POWER',
    'COMMUNICATIONS',
    'INFORMATION_TECHNOLOGY',
    'WATER',
    'WASTEWATER',
  ];

  const out: string[] = [];
  out.push('# Question VOFC Coverage Report');
  out.push('');
  out.push('Checks enforced by this report:');
  out.push('- Every non-deprecated assessment question resolves to at least one vulnerability template.');
  out.push('- Every mapped vulnerability template has at least 3 OFCs.');
  out.push('');
  out.push(`Total gaps: ${gaps.length}`);
  out.push(`- Unmapped questions: ${gaps.filter((g) => g.reason === 'UNMAPPED_QUESTION').length}`);
  out.push(`- Mapped vulnerabilities with <3 OFCs: ${gaps.filter((g) => g.reason === 'VULN_OFC_LT3').length}`);
  out.push('');

  for (const sector of sectors) {
    const list = (bySector.get(sector) ?? []).sort((a, b) => a.questionId.localeCompare(b.questionId));
    out.push(`## ${sector} (${list.length})`);
    out.push('');
    if (list.length === 0) {
      out.push('- None');
      out.push('');
      continue;
    }
    for (const row of list) {
      out.push(`- Question: \`${row.questionId}\``);
      out.push(`- Prompt: ${row.prompt}`);
      out.push(`- Issue: ${row.reason}`);
      out.push(`- Details: ${row.details}`);
      out.push('');
    }
  }

  const outPath = path.resolve(process.cwd(), '..', '..', 'data', 'QUESTION_VOFC_COVERAGE.md');
  await fs.writeFile(outPath, `${out.join('\n')}\n`, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Wrote ${outPath}`);

  if (gaps.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`VOFC coverage gaps remain: ${gaps.length}`);
    process.exit(1);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

