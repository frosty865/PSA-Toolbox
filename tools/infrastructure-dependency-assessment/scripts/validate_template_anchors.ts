/**
 * CLI: Validate that the DOCX template contains all REQUIRED_TEMPLATE_ANCHORS exactly once.
 * Exit 0 on pass, 1 on fail. Run from repo root: pnpm template:check
 * Template path: ADA_TEMPLATE_PATH env if set, else ADA/report template.docx
 */
import path from 'path';
import fs from 'fs/promises';
import JSZip from 'jszip';
import { REQUIRED_TEMPLATE_ANCHORS } from '../packages/schema/src/template_anchors';
import { TEMPLATE_ANCHOR_GUIDANCE } from '../packages/schema/src/template_anchor_guidance';

const ANCHOR_REGEX = /\[\[([^\]]+)\]\]/g;

const DEFAULT_TEMPLATE_RELATIVE = path.join('ADA', 'report template.docx');

function getTemplatePath(): string {
  const envPath = process.env.ADA_TEMPLATE_PATH;
  if (envPath) return path.resolve(envPath);
  return path.join(process.cwd(), DEFAULT_TEMPLATE_RELATIVE);
}

async function extractAnchorCounts(templatePath: string): Promise<Map<string, number>> {
  const buf = await fs.readFile(templatePath);
  const zip = await JSZip.loadAsync(buf);
  const entry = zip.file('word/document.xml');
  if (!entry) {
    throw new Error('Template is not a valid DOCX: missing word/document.xml');
  }
  const xml = await entry.async('string');
  const matches = [...xml.matchAll(ANCHOR_REGEX)];
  const countByAnchor = new Map<string, number>();
  for (const m of matches) {
    const a = m[0];
    countByAnchor.set(a, (countByAnchor.get(a) ?? 0) + 1);
  }
  return countByAnchor;
}

const RULES = [
  'Each anchor must be on its own paragraph (line by itself).',
  'Anchors must not be in header/footer, text boxes, or shapes.',
  'Each anchor must appear exactly once.',
  'Save as .docx (do not convert formats).',
];

const NEXT_STEPS = [
  'Edit ADA/report template.docx and add/fix anchors.',
  'Run: pnpm template:check',
  'Run: pnpm release:gate',
];

async function main(): Promise<number> {
  const templatePath = process.argv[2] ?? getTemplatePath();
  const resolved = path.resolve(templatePath);

  console.log(`Template: ${resolved}`);
  if (!process.argv[2] && process.env.ADA_TEMPLATE_PATH) {
    console.log('(using ADA_TEMPLATE_PATH)');
  }

  try {
    await fs.access(resolved);
  } catch {
    console.error(`Template not found: ${resolved}`);
    return 1;
  }

  const counts = await extractAnchorCounts(resolved);
  const missing: string[] = [];
  const duplicates: { anchor: string; count: number }[] = [];

  for (const anchor of REQUIRED_TEMPLATE_ANCHORS) {
    const count = counts.get(anchor) ?? 0;
    if (count === 0) missing.push(anchor);
    else if (count > 1) duplicates.push({ anchor, count });
  }

  if (missing.length === 0 && duplicates.length === 0) {
    console.log('\nTEMPLATE ANCHOR CHECK — PASS');
    console.log(`All ${REQUIRED_TEMPLATE_ANCHORS.length} required anchors present exactly once.`);
    return 0;
  }

  console.error('\nTEMPLATE ANCHOR CHECK — FAIL');
  console.error(`Template: ${resolved}\n`);

  if (missing.length > 0) {
    console.error('Missing anchors:');
    missing.forEach((anchor, i) => {
      const guidance = TEMPLATE_ANCHOR_GUIDANCE[anchor] ?? 'Place where content should be inserted.';
      console.error(`  ${i + 1}) ${anchor} — ${guidance}`);
    });
    console.error('');
  }

  if (duplicates.length > 0) {
    console.error('Duplicates (keep only one instance each):');
    duplicates.forEach(({ anchor, count }) => {
      console.error(`  - ${anchor} found ${count}x — keep only one instance.`);
    });
    console.error('');
  }

  console.error('Rules:');
  RULES.forEach((r) => console.error(`  - ${r}`));
  console.error('');
  console.error('Next:');
  NEXT_STEPS.forEach((step, i) => console.error(`  ${i + 1}) ${step}`));

  return 1;
}

main().then((code) => process.exit(code));
