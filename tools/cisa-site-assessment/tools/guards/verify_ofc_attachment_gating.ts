/**
 * Guard: OFC attachment must be gated by discipline_subtype_id equality.
 * question.discipline_subtype_id === ofc.discipline_subtype_id.
 * If question has no subtype → zero OFCs.
 * Fails if any code path attaches or returns OFCs for a question without subtype equality.
 */

import * as fs from 'fs';
import * as path from 'path';

const CWD = process.cwd();
const ROOT = path.resolve(CWD, process.argv[2] || '.');

/** Files that attach or return OFCs for questions (must enforce subtype gating) */
const ATTACHMENT_FILES = [
  'app/api/runtime/assessments/[assessmentId]/ofcs/route.ts',
  'app/api/ofcs/for-question/route.ts',
  'app/api/ofcs/link/route.ts',
  'app/lib/ofc/guardrails.ts',
];

/** Patterns that indicate subtype gating is present */
const SUBTYPE_GATING_PATTERNS = [
  /discipline_subtype_id\s*===?\s*/,           // JS/TS equality
  /discipline_subtype_id\s*=\s*\$\d+/,          // SQL param
  /WHERE[^;]*discipline_subtype_id[^;]*=/,       // SQL WHERE
  /AND\s+.*discipline_subtype_id[^;]*=/,         // SQL AND
  /\.discipline_subtype_id\s*\)?\s*===?/,        // property compare
  /q\.discipline_subtype_id|question.*discipline_subtype_id/,
  /filter.*discipline_subtype_id|discipline_subtype_id.*filter/,
];

function fail(msg: string): never {
  console.error('[guard:ofc-attachment]', msg);
  process.exit(1);
}

function fileHasSubtypeGating(filePath: string): boolean {
  const fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    return true; // file missing => nothing to check
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  return SUBTYPE_GATING_PATTERNS.some((pat) => pat.test(content));
}

function main(): void {
  const violations: string[] = [];
  for (const rel of ATTACHMENT_FILES) {
    if (!fs.existsSync(path.join(ROOT, rel))) continue;
    if (!fileHasSubtypeGating(rel)) {
      violations.push(
        `${rel}: must enforce question.discipline_subtype_id === ofc.discipline_subtype_id (or zero OFCs when missing subtype)`
      );
    }
  }
  if (violations.length > 0) {
    fail(
      `OFC attachment without subtype gating.\n${violations.join('\n')}`
    );
  }
  console.log('[guard:ofc-attachment] OK: OFC attachment paths enforce subtype equality');
}

main();
