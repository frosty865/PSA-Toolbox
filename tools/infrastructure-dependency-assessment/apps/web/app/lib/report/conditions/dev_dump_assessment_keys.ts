/**
 * One-time dev script: print all keys per sector from a fixture JSON.
 * Run: npx tsx apps/web/app/lib/report/conditions/dev_dump_assessment_keys.ts
 * Use output to build QUESTION_CONDITION_MAP.
 */
import { fullAssessmentForExport } from 'engine';
import type { Assessment } from 'schema';

const SECTORS = [
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
  'CRITICAL_PRODUCTS',
] as const;

function getAllKeys(obj: unknown, prefix = ''): string[] {
  if (obj == null || typeof obj !== 'object') return [];
  const keys: string[] = [];
  for (const k of Object.keys(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    keys.push(fullKey);
    const v = (obj as Record<string, unknown>)[k];
    if (v != null && typeof v === 'object' && !Array.isArray(v) && typeof (v as Record<string, unknown>)[0] !== 'string') {
      const nested = getAllKeys(v, fullKey);
      keys.push(...nested);
    }
  }
  return keys;
}

function getTopLevelKeys(obj: unknown): string[] {
  if (obj == null || typeof obj !== 'object') return [];
  return Object.keys(obj as Record<string, unknown>);
}

function main(): void {
  const assessment = fullAssessmentForExport as Assessment;
  const categories = assessment.categories ?? {};

  console.log('=== Assessment keys by sector (from fullAssessmentForExport) ===\n');

  for (const sector of SECTORS) {
    const cat = categories[sector as keyof typeof categories];
    if (!cat) {
      console.log(`${sector}: (no data)`);
      continue;
    }

    const data = cat as Record<string, unknown>;
    const topKeys = getTopLevelKeys(data);
    const answers = data.answers as Record<string, unknown> | undefined;
    const answerKeys = answers ? getTopLevelKeys(answers) : [];

    const allKeys = [...new Set([...topKeys, ...answerKeys])].filter((k) => k !== 'answers').sort();

    console.log(`${sector}:`);
    console.log('  Top-level:', topKeys.filter((k) => k !== 'answers').join(', ') || '(none)');
    if (answerKeys.length > 0) {
      console.log('  answers.*:', answerKeys.join(', '));
    }
    console.log('  All unique:', allKeys.join(', '));
    console.log('');
  }

  console.log('=== Keys suitable for QUESTION_CONDITION_MAP ===');
  for (const sector of SECTORS) {
    const cat = categories[sector as keyof typeof categories];
    if (!cat || sector === 'CRITICAL_PRODUCTS') continue;
    const data = cat as Record<string, unknown>;
    const answers = data.answers as Record<string, unknown> | undefined;
    const combined = { ...data, ...answers };
    delete (combined as Record<string, unknown>).answers;
    const keys = Object.keys(combined).sort();
    console.log(`\n${sector}: ${keys.join(', ')}`);
  }
}

main();
