#!/usr/bin/env node
/**
 * Guard: no CORPUS canonical_sources references.
 *
 * canonical_sources lives in RUNTIME only. This guard fails if .py files:
 * - contain "insert into canonical_sources" (case-insensitive), or
 * - contain "from canonical_sources" (Python import), or
 * - contain "canonical_sources" AND "get_corpus_conn" AND do NOT contain "get_runtime_conn"
 *   (heuristic: likely using CORPUS for canonical_sources).
 *
 * Run from psa_rebuild: node scripts/guards/verifyNoCorpusCanonicalSourcesRef.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const EXCLUDE = new Set(["node_modules", ".next", ".git", "archive", "venv", "__pycache__"]);
// Files that correctly use RUNTIME for canonical_sources (read-only or diagnostics)
const ALLOWLIST = new Set([
  "tools/corpus_ingest_pdf.py",
  "tools/diagnostics/db_preflight.py",
]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(ROOT).filter((f) => f.endsWith(".py"));
const bad = [];

for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, "/");
  if (ALLOWLIST.has(rel)) continue;
  const txt = fs.readFileSync(f, "utf8");
  if (/insert\s+into\s+canonical_sources/i.test(txt)) bad.push(f);
  else if (/\bfrom\s+canonical_sources\b/i.test(txt)) bad.push(f);
  else if (
    txt.includes("canonical_sources") &&
    (txt.includes("get_corpus_conn") || txt.includes("get_corpus_db_connection")) &&
    !txt.includes("get_runtime_conn")
  )
    bad.push(f);
}

if (bad.length) {
  console.error("[GUARD] CORPUS canonical_sources references detected:");
  for (const f of bad) console.error(" -", path.relative(ROOT, f));
  process.exit(1);
}

console.log("[OK] No CORPUS canonical_sources references found.");
