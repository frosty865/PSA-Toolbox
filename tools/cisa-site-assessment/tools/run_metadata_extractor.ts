#!/usr/bin/env npx tsx
/**
 * CLI: Run PSA metadata extraction on a PDF file (or URL).
 * Extracts PDF metadata + first pages excerpt, loads taxonomy, calls psa-metadata:latest, prints JSON.
 *
 * Usage:
 *   npx tsx tools/run_metadata_extractor.ts --path "<file>"
 *   npx tsx tools/run_metadata_extractor.ts --path "<file>" [--url "<url>"]
 *   npx tsx tools/run_metadata_extractor.ts --url "<url>"
 *
 * Requires: OLLAMA with psa-metadata:latest, RUNTIME_DATABASE_URL for taxonomy (optional).
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

const projectRoot = path.resolve(__dirname, '..');

async function loadEnv(): Promise<void> {
  for (const name of ['.env.local', '.local.env', '.env']) {
    const p = path.join(projectRoot, name);
    try {
      const content = await fs.readFile(p, 'utf-8');
      for (const line of content.split('\n')) {
        const t = line.trim();
        if (t && !t.startsWith('#') && t.includes('=')) {
          const i = t.indexOf('=');
          const k = t.slice(0, i).trim();
          const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
          process.env[k] = v;
        }
      }
      return;
    } catch {
      continue;
    }
  }
}

async function extractPdfExcerpt(pdfPath: string): Promise<string> {
  const pythonScript = path.join(projectRoot, 'tools', 'get_pdf_excerpt.py');
  try {
    await fs.access(pythonScript);
  } catch {
    return '';
  }
  const pythonCmd = process.env.PYTHON_PATH || process.env.PYTHON || 'python';
  return new Promise((resolve) => {
    const proc = spawn(pythonCmd, [pythonScript, pdfPath, '3'], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    proc.stdout?.on('data', (d: Buffer) => { out += d.toString(); });
    proc.stderr?.on('data', () => {});
    proc.on('close', () => resolve(out.trim()));
    proc.on('error', () => resolve(''));
  });
}

async function downloadToTemp(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PSA-Metadata-CLI/1.0)' },
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  const tmp = path.join(os.tmpdir(), `psa-meta-${Date.now()}.pdf`);
  await fs.writeFile(tmp, Buffer.from(buf));
  return tmp;
}

async function main(): Promise<void> {
  await loadEnv();

  const args = process.argv.slice(2);
  let filePath: string | null = null;
  let url: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--path' && args[i + 1]) {
      filePath = args[++i];
    } else if (args[i] === '--url' && args[i + 1]) {
      url = args[++i];
    }
  }

  if (url && !filePath) {
    try {
      filePath = await downloadToTemp(url);
    } catch (e) {
      console.error(JSON.stringify({ error: (e as Error).message }));
      process.exit(1);
    }
  }

  if (!filePath) {
    console.error('Usage: npx tsx tools/run_metadata_extractor.ts --path "<file>" [--url "<url>"]');
    process.exit(1);
  }

  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  try {
    await fs.access(resolvedPath);
  } catch {
    console.error(JSON.stringify({ error: `File not found: ${resolvedPath}` }));
    process.exit(1);
  }

  const filename = path.basename(resolvedPath);

  let pdf_metadata: Record<string, unknown> = {};
  try {
    const { extractPdfMetadataFromPath } = await import('../app/lib/pdfExtractTitle');
    const meta = await extractPdfMetadataFromPath(resolvedPath);
    pdf_metadata = {
      title: meta.title ?? null,
      publisher: meta.publisher ?? null,
      citation_short: meta.citation_short ?? null,
      citation_full: meta.citation_full ?? null,
    };
  } catch {
    // leave pdf_metadata empty
  }

  const excerpt = await extractPdfExcerpt(resolvedPath);

  let taxonomy: { sectors: { code: string; name: string }[]; subsectors: { code: string; sector_code: string; name: string }[] } = { sectors: [], subsectors: [] };
  try {
    const { getSectorTaxonomy } = await import('../app/lib/taxonomy/get_sector_taxonomy');
    taxonomy = await getSectorTaxonomy();
  } catch {
    // optional; sector/subsector will be null if taxonomy missing
  }

  const { extractDocumentMetadata } = await import('../app/lib/metadata/extract_document_metadata');
  const result = await extractDocumentMetadata({
    pdf_metadata,
    excerpt: excerpt || undefined,
    filename,
    taxonomy,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(JSON.stringify({ error: (e as Error).message }));
  process.exit(1);
});
