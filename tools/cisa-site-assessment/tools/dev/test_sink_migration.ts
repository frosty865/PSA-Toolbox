#!/usr/bin/env tsx
/**
 * Tiny test harness for migrateModuleSubfolderSink (no test framework).
 *
 * Creates a temp dir structure:
 *   incoming/MODULE_TEST/_processed/
 *     a.pdf
 *     b.pdf
 *     nested/   (subfolder to validate nonFileEntries logging)
 *   incoming/_processed/
 *     a.pdf     (pre-existing to force collision -> a-1.pdf)
 *
 * Runs migrateModuleSubfolderSink then prints resulting tree.
 *
 * Expected (single library, flat):
 *   - moved files appear in incoming/_processed/ (no per-module subdirs)
 *   - one file is suffix-renamed (a.pdf -> a-1.pdf) due to collision
 *   - empty nested/ is pruned; stray _processed becomes empty and is removed (self-healing)
 *
 * Usage:
 *   npx tsx tools/dev/test_sink_migration.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { migrateModuleSubfolderSink } from "../corpus/watch_module_ingestion";

async function listTree(dir: string, prefix = ""): Promise<string[]> {
  const lines: string[] = [];
  if (!fs.existsSync(dir)) return lines;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const name = e.name;
    const full = path.join(dir, name);
    lines.push(`${prefix}${name}${e.isDirectory() ? "/" : ""}`);
    if (e.isDirectory()) {
      lines.push(...(await listTree(full, prefix + "  ")));
    }
  }
  return lines;
}

async function main() {
  const tmpRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sink-migration-test-"));
  const incoming = path.join(tmpRoot, "incoming");
  const moduleDir = path.join(incoming, "MODULE_TEST");
  const strayProcessed = path.join(moduleDir, "_processed");
  const canonicalProcessed = path.join(incoming, "_processed");

  console.log("[TEST] Temp root:", tmpRoot);
  console.log("[TEST] Creating structure...");

  await fs.promises.mkdir(strayProcessed, { recursive: true });
  await fs.promises.mkdir(canonicalProcessed, { recursive: true });
  await fs.promises.mkdir(path.join(strayProcessed, "nested"), { recursive: true });

  await fs.promises.writeFile(path.join(strayProcessed, "a.pdf"), "content a");
  await fs.promises.writeFile(path.join(strayProcessed, "b.pdf"), "content b");
  await fs.promises.writeFile(path.join(canonicalProcessed, "a.pdf"), "pre-existing a");

  console.log("[TEST] Before migration:");
  for (const line of await listTree(incoming)) {
    console.log("  ", line);
  }
  console.log("");

  await migrateModuleSubfolderSink("MODULE_TEST", moduleDir, "_processed", canonicalProcessed);

  console.log("");
  console.log("[TEST] After migration:");
  for (const line of await listTree(incoming)) {
    console.log("  ", line);
  }

  const destFiles = fs.readdirSync(canonicalProcessed, { withFileTypes: true });
  const hasA = destFiles.some((e) => e.name === "a.pdf");
  const hasA1 = destFiles.some((e) => e.name === "a-1.pdf");
  const hasB = destFiles.some((e) => e.name === "b.pdf");
  const strayExists = fs.existsSync(strayProcessed);

  console.log("");
  console.log("[TEST] Expected outcomes (flat _processed/, single library):");
  console.log("  - incoming/_processed/ contains a.pdf (pre-existing), a-1.pdf (migrated), b.pdf:", hasA && hasA1 && hasB);
  console.log("  - one file suffix-renamed (a -> a-1):", hasA1);
  console.log("  - stray _processed removed after pruning empty nested/ (self-healing):", !strayExists);

  await fs.promises.rm(tmpRoot, { recursive: true, force: true });
  console.log("[TEST] Cleaned up temp dir.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
