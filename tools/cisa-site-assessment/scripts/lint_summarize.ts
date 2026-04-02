#!/usr/bin/env npx tsx
/**
 * Summarize .lint/eslint.json: top rules, top files, dominant rules per file.
 * Run: npm run lint_summarize
 * Requires: .lint/eslint.json (from npm run lint -- --format json --output-file .lint/eslint.json)
 */

import { readFileSync } from "fs";
import { join } from "path";

const LINT_JSON = join(process.cwd(), ".lint", "eslint.json");

interface EslintMessage {
  ruleId: string;
  severity: number;
  message?: string;
  line?: number;
  column?: number;
}

interface EslintResult {
  filePath: string;
  messages: EslintMessage[];
}

function main(): void {
  let raw: string;
  try {
    raw = readFileSync(LINT_JSON, "utf-8");
  } catch (e) {
    console.error("Failed to read", LINT_JSON, e);
    process.exit(1);
  }

  let results: EslintResult[];
  try {
    results = JSON.parse(raw) as EslintResult[];
  } catch (e) {
    console.error("Failed to parse", LINT_JSON, e);
    process.exit(1);
  }

  const ruleCounts: Record<string, number> = {};
  const fileCounts: Record<string, { errors: number; warnings: number; rules: Record<string, number> }> = {};

  for (const r of results) {
    const shortPath = r.filePath.replace(/^.*[\\/]psa_rebuild[\\/]/, "");
    if (!fileCounts[shortPath]) {
      fileCounts[shortPath] = { errors: 0, warnings: 0, rules: {} };
    }
    const fc = fileCounts[shortPath];
    for (const m of r.messages) {
      ruleCounts[m.ruleId] = (ruleCounts[m.ruleId] ?? 0) + 1;
      if (m.severity === 2) fc.errors += 1;
      else fc.warnings += 1;
      fc.rules[m.ruleId] = (fc.rules[m.ruleId] ?? 0) + 1;
    }
  }

  const topRules = Object.entries(ruleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const topFiles = Object.entries(fileCounts)
    .sort((a, b) => b[1].errors - a[1].errors || b[1].warnings - a[1].warnings)
    .slice(0, 20);

  console.log("=== Top 10 rules by count ===\n");
  topRules.forEach(([rule, count]) => console.log(`${count}\t${rule}`));

  console.log("\n=== Top 20 files by error count (then warnings) ===\n");
  topFiles.forEach(([file, counts]) => {
    console.log(`${counts.errors}E ${counts.warnings}W\t${file}`);
  });

  console.log("\n=== Dominant rules per top-20 file ===\n");
  topFiles.forEach(([file, counts]) => {
    const byRule = Object.entries(counts.rules).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const ruleStr = byRule.map(([r, c]) => `${r}:${c}`).join(", ");
    console.log(`${file}`);
    console.log(`  ${ruleStr}`);
  });
}

main();
