#!/usr/bin/env npx tsx
/**
 * Module pipeline report — counts by module (incoming and normalized).
 * Used by Source Data Crawler Modules tab. Output: plain text for CLI.
 */

import * as fs from "fs/promises";
import * as path from "path";

const cwd = process.cwd();
const moduleRoot =
  process.env.MODULE_SOURCES_ROOT ?? path.join(cwd, "storage", "module_sources");
const incomingDir = path.join(moduleRoot, "incoming");
const normalizedDir = path.join(moduleRoot, "normalized");

async function countFilesInDir(dirPath: string): Promise<number> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).length;
  } catch {
    return 0;
  }
}

async function listSubdirs(parentPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(parentPath, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  console.log("Module Pipeline Report\n");
  console.log(`Module root: ${path.resolve(moduleRoot)}`);
  console.log("");

  const incomingModules = await listSubdirs(incomingDir);
  const normalizedModules = await listSubdirs(normalizedDir);
  const allModules = [...new Set([...incomingModules, ...normalizedModules])].sort();

  if (allModules.length === 0) {
    console.log("By module: (none)");
    console.log("No module incoming or normalized directories found.");
    return;
  }

  console.log("By module (incoming → normalized):");
  let totalIncoming = 0;
  let totalNormalized = 0;
  for (const moduleCode of allModules) {
    const incPath = path.join(incomingDir, moduleCode);
    const normPath = path.join(normalizedDir, moduleCode);
    const inc = await countFilesInDir(incPath);
    const norm = await countFilesInDir(normPath);
    totalIncoming += inc;
    totalNormalized += norm;
    console.log(`  ${moduleCode}: incoming=${inc}, normalized=${norm}`);
  }
  console.log("");
  console.log(`Total incoming: ${totalIncoming}`);
  console.log(`Total normalized: ${totalNormalized}`);
  console.log("");
  console.log("Pipeline: Drop PDFs in storage/module_sources/incoming/ (single library) then run module:watch or process via PSA admin. Categorize when choosing sources for a module (1-to-many).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
