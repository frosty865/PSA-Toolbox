#!/usr/bin/env node
/**
 * Guard: Verify No Promote to CORPUS
 * 
 * Prevents "Promote to CORPUS" functionality from being reintroduced.
 * Module uploads must remain module-scoped. CORPUS is read-only from modules.
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const FORBIDDEN = [
  "Promote to CORPUS",
  "promoteToCorpus",
  "PROMOTE_TO_CORPUS",
  "promote-to-corpus",
  "promote.*CORPUS",
];

function walk(dir) {
  let out = [];
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (["node_modules", ".next", ".git", "archive", "dist", "build"].includes(e.name)) continue;
        out = out.concat(walk(p));
      } else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
        out.push(p);
      }
    }
  } catch (err) {
    // Ignore permission errors
  }
  return out;
}

let hits = [];
const appDir = path.join(ROOT, "app");
if (fs.existsSync(appDir)) {
  for (const f of walk(appDir)) {
    // Skip seed files and migrations (they may contain legacy references)
    if (f.includes("db/seeds") || f.includes("db/migrations") || f.includes("archive")) continue;
    
    // Skip the disabled promotion route file (it's intentionally disabled with 410 Gone)
    if (f.includes("promote-to-corpus") && f.includes("route.ts")) {
      // Check if it's the disabled version (returns 410)
      try {
        const txt = fs.readFileSync(f, "utf8");
        if (txt.includes("410") && txt.includes("Disabled: module uploads cannot be promoted")) {
          continue; // This is the disabled route, skip it
        }
      } catch {
        // If we can't read it, skip it
        continue;
      }
    }
    
    try {
      const txt = fs.readFileSync(f, "utf8");
      for (const k of FORBIDDEN) {
        // Simple substring match (not regex for simplicity)
        if (txt.includes(k)) {
          hits.push({ file: path.relative(ROOT, f), key: k });
        }
      }
    } catch (err) {
      // Ignore read errors
    }
  }
}

if (hits.length) {
  console.error("[GUARD][NO_PROMOTE_TO_CORPUS] Forbidden promotion references found:");
  hits.forEach(h => console.error(`  - "${h.key}" in ${h.file}`));
  console.error("\n[ERROR] Module uploads cannot be promoted to CORPUS.");
  console.error("[ERROR] CORPUS is read-only from modules. Use module_corpus_links for read-only references.");
  process.exit(1);
}

console.log("[OK][NO_PROMOTE_TO_CORPUS] No promotion references detected in app/ directory.");
