/**
 * Writes apps/web/public/template-anchor-manifest.json for field static builds.
 * When a DOCX template is found, validates required anchors (exactly once) and records counts.
 * When no template is present (e.g. local dev), writes kind "unverified" so the UI skips strict checks.
 */
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import JSZip from 'jszip';
import { REQUIRED_TEMPLATE_ANCHORS } from '../packages/schema/src/template_anchors';

const ANCHOR_REGEX = /\[\[([^\]]+)\]\]/g;
const OUT_FILE = path.join(process.cwd(), 'apps', 'web', 'public', 'template-anchor-manifest.json');
const DEFAULT_ADA_TEMPLATE = path.join('ADA', 'report template.docx');
const BLANK_TEMPLATE = path.join('assets', 'templates', 'Asset Dependency Assessment Report_BLANK.docx');

function resolveTemplatePath(repoRoot: string): string | null {
  const envPath = process.env.ADA_TEMPLATE_PATH?.trim();
  if (envPath) return path.resolve(envPath);
  const ada = path.join(repoRoot, DEFAULT_ADA_TEMPLATE);
  if (fsSync.existsSync(ada)) return ada;
  const blank = path.join(repoRoot, BLANK_TEMPLATE);
  if (fsSync.existsSync(blank)) return blank;
  return null;
}

async function extractAnchorCounts(templatePath: string): Promise<Map<string, number>> {
  const buf = await fs.readFile(templatePath);
  const zip = await JSZip.loadAsync(buf);
  const entry = zip.file('word/document.xml');
  if (!entry) throw new Error('Template is not a valid DOCX: missing word/document.xml');
  const xml = await entry.async('string');
  const matches = [...xml.matchAll(ANCHOR_REGEX)];
  const countByAnchor = new Map<string, number>();
  for (const m of matches) {
    const a = m[0];
    countByAnchor.set(a, (countByAnchor.get(a) ?? 0) + 1);
  }
  return countByAnchor;
}

async function main() {
  const repoRoot = process.cwd();
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });

  const templatePath = resolveTemplatePath(repoRoot);
  const required = [...REQUIRED_TEMPLATE_ANCHORS];

  if (!templatePath) {
    const payload = {
      kind: 'unverified' as const,
      required,
      message:
        'No DOCX template found at build time (ADA/report template.docx or assets/templates BLANK). Field bundle will not enforce anchor checks until a verified manifest is built.',
    };
    await fs.writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf8');
    console.warn('[write-template-anchor-manifest]', payload.message);
    return;
  }

  const counts = await extractAnchorCounts(templatePath);
  const anchors: Record<string, number> = {};
  for (const [k, v] of counts) anchors[k] = v;

  const missing: string[] = [];
  const duplicates: Array<{ anchor: string; count: number }> = [];
  for (const anchor of required) {
    const c = counts.get(anchor) ?? 0;
    if (c === 0) missing.push(anchor);
    if (c > 1) duplicates.push({ anchor, count: c });
  }

  if (missing.length > 0 || duplicates.length > 0) {
    console.error('[write-template-anchor-manifest] Template anchor validation failed.');
    if (missing.length) console.error('Missing:', missing.join(', '));
    if (duplicates.length) console.error('Duplicates:', duplicates.map((d) => `${d.anchor} (${d.count})`).join(', '));
    process.exit(1);
  }

  const payload = {
    kind: 'verified' as const,
    templatePath: path.relative(repoRoot, templatePath).replace(/\\/g, '/'),
    required,
    anchors,
  };
  await fs.writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf8');
  console.log('[write-template-anchor-manifest] wrote', OUT_FILE, `(${required.length} anchors)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
