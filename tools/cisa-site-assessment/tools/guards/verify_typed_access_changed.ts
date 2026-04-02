import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

type Rule = { name: string; pattern: RegExp };

const RULES: Rule[] = [
  { name: "no-explicit-any", pattern: /(\bas\s+any\b|:\s*any\b|<any>)/ },
  { name: "no-record-string-unknown", pattern: /\bRecord<string,\s*unknown>\b/ },
];
const EXCLUDED_PREFIXES = ["tools/_archive/", "archive/", "app_broken/"] as const;

function isExcluded(file: string): boolean {
  const normalized = file.replace(/\\/g, "/");
  return EXCLUDED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function changedSourceFiles(): string[] {
  const raw = execSync("git status --porcelain 2>nul", { encoding: "utf8" });
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const files = new Set<string>();
  for (const line of lines) {
    const file = line.slice(3).trim();
    if (!file) continue;
    if (/\.(ts|tsx|js|jsx)$/.test(file) && !isExcluded(file)) files.add(file);
  }
  return [...files];
}

function allTrackedSourceFiles(): string[] {
  const raw = execSync("git ls-files", { encoding: "utf8" });
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /\.(ts|tsx|js|jsx)$/.test(line))
    .filter((line) => !isExcluded(line));
}

function getRepoPrefix(): string {
  const raw = execSync("git rev-parse --show-prefix", { encoding: "utf8" }).trim();
  return raw;
}

function toWorkspacePath(file: string): string {
  const prefix = getRepoPrefix();
  if (prefix && file.startsWith(prefix)) {
    return file.slice(prefix.length);
  }
  return file;
}

function addedLinesForFile(file: string): Array<{ line: number; text: string }> {
  const diff = execSync(`git diff --unified=0 HEAD -- "${file}"`, { encoding: "utf8" });
  const out: Array<{ line: number; text: string }> = [];
  let currentLine = 0;
  for (const line of diff.split(/\r?\n/)) {
    const hunkMatch = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunkMatch) {
      currentLine = Number(hunkMatch[1]);
      continue;
    }
    if (line.startsWith("+++")) continue;
    if (line.startsWith("+")) {
      out.push({ line: currentLine, text: line.slice(1) });
      currentLine += 1;
      continue;
    }
    if (!line.startsWith("-")) currentLine += 1;
  }
  return out;
}

function main(): void {
  const runAll = process.argv.includes("--all");
  const files = runAll ? allTrackedSourceFiles() : changedSourceFiles();
  if (files.length === 0) {
    console.log("[guard:typed-diff] No changed TS/JS files.");
    return;
  }

  const violations: string[] = [];

  for (const file of files) {
    const entries = runAll
      ? readFileSync(path.resolve(process.cwd(), toWorkspacePath(file)), "utf8")
          .split(/\r?\n/)
          .map((text, idx) => ({ line: idx + 1, text }))
      : addedLinesForFile(file);
    for (const entry of entries) {
      for (const rule of RULES) {
        if (rule.pattern.test(entry.text)) {
          violations.push(`${file}:${entry.line} ${rule.name} -> ${entry.text.trim()}`);
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error(runAll ? "[guard:typed-diff] Found violations repo-wide:" : "[guard:typed-diff] Found violations in added lines:");
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }

  console.log(runAll
    ? `[guard:typed-diff] Passed repo-wide on ${files.length} file(s).`
    : `[guard:typed-diff] Passed on ${files.length} changed file(s).`);
}

main();
