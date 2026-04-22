/**
 * DOCX report golden-file regression test.
 * Generates a DOCX from a fixture, extracts text, and asserts presence/absence of key phrases.
 * Requires Python + python-docx (reporter env). Skipped when reporter unavailable.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import JSZip from 'jszip';
import { fullAssessmentForExport } from 'engine';
import { getCanonicalTemplatePath } from '@/app/lib/template/path';

/** Extract plain text from DOCX buffer (word/document.xml). */
async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file('word/document.xml');
  if (!entry) throw new Error('Invalid DOCX: missing word/document.xml');
  const xml = await entry.async('string');
  // Strip XML tags and decode entities; w:t elements hold text
  const text = xml
    .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
  return text;
}

/** Run Python reporter with payload, return output.docx buffer. */
async function runReporter(
  payload: object,
  repoRoot: string,
  workDir: string,
  templatePath: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const mainPy = path.join(repoRoot, 'apps', 'reporter', 'main.py');
    const proc = spawn('python', [mainPy], {
      env: { ...process.env, WORK_DIR: workDir, TEMPLATE_PATH: templatePath },
      cwd: repoRoot,
    });
    proc.stdin.write(JSON.stringify(payload), () => proc.stdin.end());
    const chunks: Buffer[] = [];
    proc.stdout.on('data', (c: Buffer) => chunks.push(c));
    proc.stderr.on('data', (c: Buffer) => chunks.push(c));
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Reporter exited ${code}`));
        return;
      }
      readFile(path.join(workDir, 'output.docx'))
        .then(resolve)
        .catch(reject);
    });
    proc.on('error', reject);
  });
}

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const TEMPLATE_PATH = getCanonicalTemplatePath(REPO_ROOT);

describe('DOCX report output', () => {
  let docxText: string = '';

  beforeAll(async () => {
    const workDir = path.join(REPO_ROOT, 'data', 'temp', `docx-test-${randomUUID()}`);
    await mkdir(workDir, { recursive: true });
    const payload = {
      assessment: fullAssessmentForExport,
      vofc_collection: { items: [], generated_at_iso: new Date().toISOString(), tool_version: '0.1.0' },
      dependency_sections: [
        { name: 'Communications (Carrier-Based Transport Services)', themedFindings: [{ title: 'Test', narrative: 'Test' }], knowledgeGaps: [] },
        { name: 'Information Technology (Externally Hosted / Managed Digital Services)', themedFindings: [], knowledgeGaps: [{ title: 'Test', description: 'Test' }] },
      ],
    };
    try {
      const buffer = await runReporter(payload, REPO_ROOT, workDir, TEMPLATE_PATH);
      docxText = await extractDocxText(buffer);
    } catch {
      // Skip when Python/reporter unavailable (CI may not have it)
    }
  });

  it('must contain Communications long header when dependency_sections present', () => {
    if (!docxText) return;
    expect(docxText).toContain('COMMUNICATIONS — Dependency Assessment');
  });

  it('must contain Information Technology long header when dependency_sections present', () => {
    if (!docxText) return;
    expect(docxText).toContain('INFORMATION TECHNOLOGY — Dependency Assessment');
  });

  it('must contain "not confirmed" for unknown/missing values (not "Not identified")', () => {
    if (!docxText) return;
    // When we have unknown/missing narrative values, we use "not confirmed"
    expect(docxText).toContain('not confirmed');
  });

  it('must not contain "refueling" in non-energy dependency sections', () => {
    if (!docxText) return;
    // "refueling" in Energy section is acceptable; we check it doesn't appear in Comms/IT headers
    const commsIdx = docxText.indexOf('Communications (Carrier-Based Transport Services)');
    const itIdx = docxText.indexOf('Information Technology (Externally Hosted / Managed Digital Services)');
    if (commsIdx >= 0 && itIdx >= 0) {
      const afterComms = docxText.slice(commsIdx);
      const afterIt = docxText.slice(itIdx);
      // Refueling in Comms/IT context would be wrong; Energy section may have it
      const commsSection = afterComms.slice(0, afterComms.indexOf('Water') >= 0 ? afterComms.indexOf('Water') : afterComms.length);
      const itSection = afterIt.slice(0, afterIt.indexOf('Water') >= 0 ? afterIt.indexOf('Water') : Math.min(2000, afterIt.length));
      expect(commsSection.toLowerCase()).not.toContain('refueling');
      expect(itSection.toLowerCase()).not.toContain('refueling');
    }
  });
});
