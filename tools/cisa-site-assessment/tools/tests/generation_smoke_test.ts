#!/usr/bin/env npx tsx
/**
 * Regression test: minimum viable output for window-based generation.
 * Runs dryRun-style generation (Python pipeline only) for MODULE_EV_PARKING_CHARGING
 * with one Object key (PHYSICAL_SECURITY_MEASURES) and one Plan key (PHYSICAL_SECURITY_PLAN).
 * Asserts: selected packets >0, parse_ok true, kept items >0.
 * On failure prints stage_debug and exits non-zero.
 *
 * Usage: npx tsx tools/tests/generation_smoke_test.ts
 * Requires: data/module_chunks/MODULE_EV_PARKING_CHARGING.json (export chunks first via standard/generate or API).
 */

import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";

const MODULE_CODE = "MODULE_EV_PARKING_CHARGING";
const CHUNKS_DIR = path.join(process.cwd(), "data", "module_chunks");
const OUTPUT_DIR = path.join(process.cwd(), "tools", "outputs");
const SCRIPT_PATH = path.join(process.cwd(), "tools", "modules", "run_module_parser_from_db.py");

function runPipeline(moduleKind: "OBJECT" | "PLAN", standardKey: string): { ok: boolean; stage_debug?: unknown; items?: unknown[] } {
  const chunkPath = path.join(CHUNKS_DIR, `${MODULE_CODE}.json`);
  if (!fs.existsSync(chunkPath)) {
    console.error(`Chunk file not found: ${chunkPath}`);
    console.error("Export chunks first (e.g. run standard/generate once).");
    return { ok: false };
  }
  const payload = fs.readFileSync(chunkPath, "utf-8");
  const pythonCmd = process.env.PYTHON_PATH || process.env.PYTHON || "python";
  const result = spawnSync(
    pythonCmd,
    [
      SCRIPT_PATH,
      "--stdin",
      "--module-code",
      MODULE_CODE,
      "--use-packet-pipeline",
      "--module-kind",
      moduleKind,
      "--standard-key",
      standardKey,
    ],
    { cwd: process.cwd(), input: payload, encoding: "utf-8", stdio: ["pipe", "pipe", "inherit"], timeout: 300_000 }
  );
  if (result.error) {
    console.error("Python spawn error:", result.error.message);
    return { ok: false };
  }
  if (result.status !== 0) {
    console.error("Python exited", result.status, result.stdout?.slice(-500));
    return { ok: false };
  }
  const outPath = path.join(OUTPUT_DIR, `module_parser_test_${MODULE_CODE}.json`);
  if (!fs.existsSync(outPath)) {
    console.error("Output file not found:", outPath);
    return { ok: false };
  }
  const data = JSON.parse(fs.readFileSync(outPath, "utf-8"));
  const stage_debug = data.stage_debug as
    | {
        router?: { selected?: number };
        parser?: { parse_ok?: boolean };
        final?: { kept?: number; empty_reason?: string };
      }
    | undefined;
  const items = (data.items || []) as unknown[];
  return { ok: true, stage_debug, items };
}

function main(): number {
  console.log("Generation smoke test:", MODULE_CODE);
  console.log("  Object key: PHYSICAL_SECURITY_MEASURES");
  const objectResult = runPipeline("OBJECT", "PHYSICAL_SECURITY_MEASURES");
  if (!objectResult.ok) {
    console.error("Object run failed.");
    return 1;
  }
  const objDebug = objectResult.stage_debug as { router?: { selected?: number }; parser?: { parse_ok?: boolean }; final?: { kept?: number } } | undefined;
  const selectedOk = (objDebug?.router?.selected ?? 0) > 0;
  const parseOk = objDebug?.parser?.parse_ok !== false;
  const keptOk = (objectResult.items?.length ?? 0) > 0 || (objDebug?.final?.kept ?? 0) > 0;
  if (!selectedOk || !parseOk || !keptOk) {
    console.error("Object assertions failed:");
    console.error("  selected > 0:", selectedOk, "(", objDebug?.router?.selected, ")");
    console.error("  parse_ok:", parseOk);
    console.error("  kept > 0:", keptOk, "(", objectResult.items?.length ?? objDebug?.final?.kept, ")");
    console.error("stage_debug:", JSON.stringify(objectResult.stage_debug, null, 2));
    return 1;
  }
  console.log("  Object: selected=" + objDebug?.router?.selected + " kept=" + (objectResult.items?.length ?? objDebug?.final?.kept));

  console.log("  Plan key: PHYSICAL_SECURITY_PLAN");
  const planResult = runPipeline("PLAN", "PHYSICAL_SECURITY_PLAN");
  if (!planResult.ok) {
    console.error("Plan run failed.");
    return 1;
  }
  const planDebug = planResult.stage_debug as { router?: { selected?: number }; parser?: { parse_ok?: boolean }; final?: { kept?: number } } | undefined;
  const planSelectedOk = (planDebug?.router?.selected ?? 0) > 0;
  const planParseOk = planDebug?.parser?.parse_ok !== false;
  const planKeptOk = (planResult.items?.length ?? 0) > 0 || (planDebug?.final?.kept ?? 0) > 0;
  if (!planSelectedOk || !planParseOk || !planKeptOk) {
    console.error("Plan assertions failed:");
    console.error("  selected > 0:", planSelectedOk, "(", planDebug?.router?.selected, ")");
    console.error("  parse_ok:", planParseOk);
    console.error("  kept > 0:", planKeptOk, "(", planResult.items?.length ?? planDebug?.final?.kept, ")");
    console.error("stage_debug:", JSON.stringify(planResult.stage_debug, null, 2));
    return 1;
  }
  console.log("  Plan: selected=" + planDebug?.router?.selected + " kept=" + (planResult.items?.length ?? planDebug?.final?.kept));

  console.log("Smoke test passed.");
  return 0;
}

process.exit(main());
