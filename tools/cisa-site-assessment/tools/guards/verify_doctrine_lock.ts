/**
 * Doctrine lock guard: enforces PSA OFC doctrine version header, LOCKED status,
 * forbidden terms, and change-control (doctrine change => changelog + version bump).
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const CWD = process.cwd();
const DOCTRINE_PATH = path.join(CWD, 'docs', 'doctrine', 'PSA_OFC_DOCTRINE_V1.md');
const CHANGELOG_PATH = path.join(CWD, 'docs', 'doctrine', 'DOCTRINE_CHANGELOG.md');

const FORBIDDEN_TERMS = [
  'SAFE v2',
  'SAFE v3',
  'SAFE-style',
  'SAFE',
];
const FORBIDDEN_TERM_CI = /safeguard/i;

const SEMVER = /^\d+\.\d+\.\d+$/;

function fail(msg: string): never {
  console.error('[guard:doctrine-lock]', msg);
  process.exit(1);
}

function getRepoRoot(): string {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8', cwd: CWD }).trim();
  } catch {
    fail('Not a git repository');
  }
}

function getChangedFiles(): string[] {
  try {
    const out = execSync('git diff --name-only HEAD', { encoding: 'utf-8', cwd: CWD }).trim();
    return out ? out.split(/\n/).map((p) => p.replace(/\\/g, '/')) : [];
  } catch {
    return [];
  }
}

function parseDoctrineVersion(content: string): string | null {
  const m = content.match(/doctrine_version:\s*(\S+)/);
  return m ? m[1].trim() : null;
}

function parseDoctrineStatus(content: string): string | null {
  const m = content.match(/status:\s*(\S+)/);
  return m ? m[1].trim() : null;
}

function main(): void {
  if (!fs.existsSync(DOCTRINE_PATH)) {
    fail(`Doctrine file not found: ${DOCTRINE_PATH}`);
  }
  if (!fs.existsSync(CHANGELOG_PATH)) {
    fail(`Changelog file not found: ${CHANGELOG_PATH}`);
  }

  const doctrineContent = fs.readFileSync(DOCTRINE_PATH, 'utf-8');
  const changelogContent = fs.readFileSync(CHANGELOG_PATH, 'utf-8');

  // 1) Version header and SemVer
  const version = parseDoctrineVersion(doctrineContent);
  if (!version) {
    fail('Doctrine must include doctrine_version in the version header block');
  }
  if (!SEMVER.test(version)) {
    fail(`doctrine_version must be SemVer (x.y.z): got "${version}"`);
  }

  // 2) status is LOCKED
  const status = parseDoctrineStatus(doctrineContent);
  if (status !== 'LOCKED') {
    fail(`Doctrine status must be LOCKED; got "${status ?? 'missing'}"`);
  }

  // 3) Forbidden terms in doctrine body
  for (const term of FORBIDDEN_TERMS) {
    if (doctrineContent.includes(term)) {
      fail(`Forbidden term in doctrine: "${term}"`);
    }
  }
  if (FORBIDDEN_TERM_CI.test(doctrineContent)) {
    fail('Forbidden term in doctrine: "safeguard" (case-insensitive)');
  }

  // 4) If doctrine changed vs HEAD, require changelog changed and version bumped
  const repoRoot = getRepoRoot();
  const doctrineRel = path.relative(repoRoot, DOCTRINE_PATH).replace(/\\/g, '/');
  const changelogRel = path.relative(repoRoot, CHANGELOG_PATH).replace(/\\/g, '/');
  const changed = getChangedFiles();

  const doctrineChanged = changed.some((p) => p === doctrineRel || p.endsWith('/PSA_OFC_DOCTRINE_V1.md'));
  if (!doctrineChanged) {
    return;
  }

  const changelogChanged = changed.some((p) => p === changelogRel || p.endsWith('/DOCTRINE_CHANGELOG.md'));
  let changelogIsNew = false;
  try {
    execSync(`git ls-files --error-unmatch "${changelogRel}"`, { encoding: 'utf-8', cwd: CWD, stdio: 'pipe' });
  } catch {
    changelogIsNew = true;
  }
  if (!changelogChanged && !changelogIsNew) {
    fail('PSA_OFC_DOCTRINE_V1.md changed; DOCTRINE_CHANGELOG.md must also change');
  }

  let headVersion: string | null = null;
  try {
    const headDoctrine = execSync(`git show HEAD:${doctrineRel}`, { encoding: 'utf-8', cwd: CWD });
    headVersion = parseDoctrineVersion(headDoctrine);
  } catch {
    // New file or path different on this OS
  }
  if (headVersion !== null && version === headVersion) {
    fail(`Doctrine changed but doctrine_version not bumped (still ${version}); bump and add changelog entry`);
  }
}

main();
