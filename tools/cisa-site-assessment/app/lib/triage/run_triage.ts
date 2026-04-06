import fs from "node:fs";
import path from "node:path";
import triageConfig from "@/tools/triage/triage_config.json";
import { readLeadingBytes, scanForFiles, triageOne, safeMove } from "@/app/lib/triage/triage";
import { createOrGetSourceRegistryForLocalFile, ingestSourceRegistryId } from "@/app/lib/sourceRegistry/ingestion";
import { verifyPdfBuffer } from "@/app/lib/crawler/pdfVerify";

type RunResult = {
  processed_count: number;
  error_count: number;
  processed: unknown[];
  errors: unknown[];
};

function isSidecar(p: string) {
  return p.toLowerCase().endsWith(".triage.json");
}

function isTempFile(name: string) {
  const n = name.toLowerCase();
  return n.endsWith(".tmp") || n.endsWith(".part") || n.endsWith(".crdownload") || n.startsWith("~$");
}

function isPdfFile(filePath: string) {
  return filePath.toLowerCase().endsWith(".pdf");
}

// Prevent processing a file while it is still being written.
// Heuristic: size stable across 2 checks.
async function waitForStableSize(filePath: string, checks = 2, delayMs = 750): Promise<boolean> {
  let last = -1;
  for (let i = 0; i < checks; i++) {
    if (!fs.existsSync(filePath)) return false;
    const s = fs.statSync(filePath).size;
    if (s === last && s > 0) return true;
    last = s;
    await new Promise(r => setTimeout(r, delayMs));
  }
  // allow zero-byte files to be ignored
  return false;
}

export async function runTriage(params?: { roots?: string[] }): Promise<RunResult> {
  const incomingRoot = triageConfig.roots.incoming;
  const libraryRoot = triageConfig.roots.library;

  const allowedExts: string[] = triageConfig.allowed_extensions;
  const ignoreFolders: string[] = triageConfig.ignore_folders;
  const defaults = triageConfig.defaults;
  const moduleFolder: string = triageConfig.module_folder;

  const roots = params?.roots?.length ? params.roots : [incomingRoot];

  const candidates = new Set<string>();
  for (const r of roots) {
    scanForFiles(r, ignoreFolders, allowedExts).forEach(p => candidates.add(p));
  }

  const processed: unknown[] = [];
  const errors: unknown[] = [];

  for (const absPath of candidates) {
    try {
      const base = path.basename(absPath);
      if (isSidecar(absPath) || isTempFile(base)) continue;
      if (!fs.existsSync(absPath)) continue;

      const stable = await waitForStableSize(absPath);
      if (!stable) continue;

      if (isPdfFile(absPath)) {
        const buf = readLeadingBytes(absPath, 5);
        if (!verifyPdfBuffer(buf)) {
          errors.push({ file: absPath, error: "Not a valid PDF (missing %PDF- signature)" });
          continue;
        }
      }

      const item = triageOne({
        libraryRoot,
        incomingRoot,
        defaults,
        moduleFolder,
        absPath,
      });

      const sourceRegistryId = await createOrGetSourceRegistryForLocalFile(
        item.absolutePath,
        item.sha256,
        item.decision.kind === "MODULE"
          ? { module: item.decision.moduleCode }
          : { sector: item.decision.sector, subsector: item.decision.subsector },
        item.decision.rule
      );

      // Ingest with proper parameters
      const filename = path.basename(item.absolutePath);
      const ingestionResult = await ingestSourceRegistryId(
        sourceRegistryId,
        item.absolutePath,
        'Triage Import',
        path.parse(filename).name,
        null,
        'BASELINE_AUTHORITY'
      );

      if (!ingestionResult.success) {
        errors.push({ file: absPath, error: ingestionResult.error || 'Ingestion failed' });
        continue;
      }

      // Only move after ingestion trigger succeeds
      safeMove(item.absolutePath, item.destinationPath);

      processed.push({
        file: item.absolutePath,
        dest: item.destinationPath,
        sha256: item.sha256,
        decision: item.decision,
        source_registry_id: sourceRegistryId,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ file: absPath, error: msg });
    }
  }

  return {
    processed_count: processed.length,
    error_count: errors.length,
    processed,
    errors,
  };
}
