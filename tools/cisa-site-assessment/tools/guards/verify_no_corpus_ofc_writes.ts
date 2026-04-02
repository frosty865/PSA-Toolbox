/**
 * Guard: no INSERT/UPDATE to ofc_library (or ofc_candidate_queue) from corpus/ingestion/mining/processor.
 * OFC creation is evidence-only blocked: only ADMIN_AUTHORING | MODULE_ADMIN may write.
 * This script fails if forbidden paths contain writes to ofc_library.
 */

import * as fs from 'fs';
import * as path from 'path';

const CWD = process.cwd();
const ROOT = path.resolve(CWD, process.argv[2] || '.');

const FORBIDDEN_DIRS = ['corpus', 'ingestion', 'mining', 'processor'];
const WRITE_PATTERNS = [
  /INSERT\s+INTO\s+(?:public\.)?ofc_library\b/i,
  /UPDATE\s+(?:public\.)?ofc_library\b/i,
];

function fail(msg: string): never {
  console.error('[guard:ofc-write-origin]', msg);
  process.exit(1);
}

function isForbiddenDir(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  return FORBIDDEN_DIRS.some(
    (d) => normalized.includes(`/${d}/`) || normalized.startsWith(`${d}/`)
  );
}

function checkFile(filePath: string, relPath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const violations: string[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pat of WRITE_PATTERNS) {
      if (pat.test(line)) {
        violations.push(`${relPath}:${i + 1}: ${line.trim().slice(0, 80)}`);
      }
    }
  }
  return violations;
}

function walkDir(dir: string, base: string): string[] {
  let all: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      all = all.concat(walkDir(full, base));
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (!['.ts', '.tsx', '.js', '.jsx', '.py', '.sql'].includes(ext)) continue;
      if (!isForbiddenDir(rel)) continue;
      const violations = checkFile(full, rel);
      all = all.concat(violations);
    }
  }
  return all;
}

function main(): void {
  const violations = walkDir(ROOT, ROOT);
  if (violations.length > 0) {
    fail(
      `ofc_library writes found in corpus/ingestion/mining/processor. Corpus pipeline is evidence-only.\n${violations.join('\n')}`
    );
  }
  console.log('[guard:ofc-write-origin] OK: no ofc_library writes in corpus/ingestion/mining/processor');
}

main();
