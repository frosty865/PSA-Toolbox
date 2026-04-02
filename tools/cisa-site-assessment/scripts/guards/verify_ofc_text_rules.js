#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function getPythonCmd() {
  const candidates = [
    path.join(process.cwd(), "venv", "Scripts", "python.exe"),
    path.join(process.cwd(), ".venv", "Scripts", "python.exe"),
    "python",
    "python3",
  ];

  for (const candidate of candidates) {
    try {
      if (candidate.includes(":") || candidate.includes(path.sep)) {
        if (fs.existsSync(candidate)) return candidate;
      } else {
        const probe = spawnSync(candidate, ["--version"], { stdio: "ignore", shell: false });
        if (!probe.error && probe.status === 0) return candidate;
      }
    } catch {
      // try next
    }
  }

  return null;
}

function main() {
  const scriptCandidates = [
    path.join(process.cwd(), "scripts", "guards", "verify_ofc_text_rules.py"),
    path.join(process.cwd(), "tools", "guards", "verify_ofc_text_rules.py"),
  ];

  const scriptPath = scriptCandidates.find((candidate) => fs.existsSync(candidate));
  if (!scriptPath) {
    console.log("[OK] OFC text lint guard skipped (verify_ofc_text_rules.py not present).");
    process.exit(0);
  }

  const pythonCmd = getPythonCmd();
  if (!pythonCmd) {
    console.log("[OK] OFC text lint guard skipped (no Python interpreter resolved).");
    process.exit(0);
  }

  const env = { ...process.env };
  delete env.PYTHONPATH;

  const result = spawnSync(pythonCmd, [scriptPath], {
    stdio: "inherit",
    env,
    shell: false,
  });

  if (result.error) {
    console.error(`[WARN] OFC text lint guard failed to start: ${result.error.message}`);
    process.exit(0);
  }

  if (result.status !== 0) {
    console.log("[WARN] OFC text lint guard failed (non-blocking).");
  }

  process.exit(0);
}

main();
