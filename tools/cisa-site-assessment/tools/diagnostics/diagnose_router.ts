#!/usr/bin/env npx tsx
/**
 * Standalone router diagnostic: run router + quota on a module's chunk export and print stats.
 *
 * Usage:
 *   npx tsx tools/diagnostics/diagnose_router.ts MODULE_EV_PARKING_CHARGING --standard-key PHYSICAL_SECURITY_MEASURES
 *
 * Requires: data/module_chunks/<module_code>.json (export chunks first via standard/generate or export).
 * Prints: chunks_usable, router counts (keep/maybe/ignore), up to 10 IGNORE examples with reasons,
 * selected packet handles after quota fallback.
 */

import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";

const CHUNKS_DIR = path.join(process.cwd(), "data", "module_chunks");
const SCRIPT_PATH = path.join(process.cwd(), "tools", "modules", "run_module_parser_from_db.py");

function main(): number {
  const argv = process.argv.slice(2);
  const moduleCode = argv.find((a) => !a.startsWith("--"));
  const standardKeyIdx = argv.indexOf("--standard-key");
  const standardKey =
    standardKeyIdx >= 0 && argv[standardKeyIdx + 1]
      ? argv[standardKeyIdx + 1]
      : "PHYSICAL_SECURITY_MEASURES";

  if (!moduleCode) {
    console.error("Usage: npx tsx tools/diagnostics/diagnose_router.ts <module_code> [--standard-key PHYSICAL_SECURITY_MEASURES]");
    return 1;
  }

  const chunkPath = path.join(CHUNKS_DIR, `${moduleCode}.json`);
  if (!fs.existsSync(chunkPath)) {
    console.error(`Chunk file not found: ${chunkPath}`);
    console.error("Export chunks first (e.g. run standard/generate once or use the API export).");
    return 1;
  }

  const payload = fs.readFileSync(chunkPath, "utf-8");
  const pythonCmd = process.env.PYTHON_PATH || process.env.PYTHON || "python";
  const result = spawnSync(pythonCmd, [SCRIPT_PATH, "--stdin", "--module-code", moduleCode, "--diagnose-router", "--standard-key", standardKey], {
    cwd: process.cwd(),
    input: payload,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "inherit"],
  });

  if (result.error) {
    console.error("Failed to run Python:", result.error.message);
    return 1;
  }
  if (result.status !== 0) {
    console.error("Python script exited with code", result.status);
    return 1;
  }

  let diag: {
    chunks_usable?: number;
    router?: {
      total?: number;
      keep?: number;
      maybe?: number;
      ignore?: number;
      selected_count?: number;
      forced_count?: number;
      used_maybe_fallback?: boolean;
      examples?: {
        ignore?: Array<{ handle: string; reason: string }>;
        maybe?: Array<{ handle: string; reason: string }>;
        keep?: Array<{ handle: string; reason: string }>;
      };
    };
    selected_handles?: string[];
  };
  try {
    diag = JSON.parse(result.stdout || "{}");
  } catch {
    console.error("Python did not output valid JSON.");
    console.error(result.stdout?.slice(0, 500));
    return 1;
  }

  const N = diag.chunks_usable ?? 0;
  const windowsCount = (diag as { windows_count?: number }).windows_count ?? 0;
  const r = diag.router ?? {};
  console.log("Router diagnostic (doc + proximity windows)");
  console.log("================");
  console.log("Module:", moduleCode);
  console.log("Standard key:", standardKey);
  console.log("Chunks usable (text >= 200):", N);
  console.log("Windows (3 chunks, overlap 1):", windowsCount);
  console.log("");
  console.log("Router counts (per window):");
  console.log("  total:", r.total ?? 0);
  console.log("  keep:", r.keep ?? 0);
  console.log("  maybe:", r.maybe ?? 0);
  console.log("  ignore:", r.ignore ?? 0);
  console.log("  selected_count:", r.selected_count ?? 0);
  console.log("  forced_count:", r.forced_count ?? 0);
  console.log("  used_maybe_fallback:", r.used_maybe_fallback ?? false);
  console.log("");

  const ignoreExamples = r.examples?.ignore ?? [];
  if (ignoreExamples.length > 0) {
    console.log("IGNORE examples (up to 10):");
    for (const ex of ignoreExamples.slice(0, 10)) {
      console.log(`  ${ex.handle}: ${(ex.reason || "").slice(0, 80)}`);
    }
    console.log("");
  }

  const selected = diag.selected_handles ?? [];
  console.log("Selected packet handles after quota:", selected.length);
  if (selected.length > 0) {
    console.log(selected.join(", "));
  }

  return 0;
}

process.exit(main());
