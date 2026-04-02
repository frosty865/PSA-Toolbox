#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT = process.argv[2] || ".";
const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".venv",
  "venv",
  "archive",
  "analytics",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
]);
const EXCLUDE_EXT = new Set([".md", ".log", ".json", ".sql"]);
const EXCLUDE_FILES = new Set(["package-lock.json", "yarn.lock"]);

const patterns = [
  /\.from\(["']documents["']\)\.(insert|update|upsert)\(/,
  /\bINSERT\s+INTO\s+documents\b/i,
  /\bUPDATE\s+documents\b/i,
];

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else {
      const fileName = e.name;
      const ext = path.extname(fileName).toLowerCase();
      if (EXCLUDE_EXT.has(ext)) continue;
      if (EXCLUDE_FILES.has(fileName)) continue;
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

function scanFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const re of patterns) {
      if (re.test(line)) {
        hits.push({ line: i + 1, snippet: line.trim(), re: re.toString() });
      }
    }
  }
  return hits;
}

function main() {
  const files = walk(ROOT);
  const findings = [];
  for (const f of files) {
    const hits = scanFile(f);
    if (hits.length) findings.push({ file: f, hits });
  }

  if (findings.length) {
    console.error("[GUARD] Legacy document writes detected (documents table).");
    for (const f of findings) {
      for (const h of f.hits) {
        console.error(`- ${f.file}:${h.line} :: ${h.snippet}`);
      }
    }
    process.exit(1);
  }

  console.log("[OK] No legacy document writes detected.");
}

main();
