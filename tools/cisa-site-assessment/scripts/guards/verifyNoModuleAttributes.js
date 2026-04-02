#!/usr/bin/env node
/**
 * Guard: Verify No Module Attributes
 * 
 * Prevents module attributes from being reintroduced.
 * Attributes have been removed from doctrine - criteria applicability
 * is determined by the Standard only, not by user-selected attributes.
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const FORBIDDEN = [
  "HAS_CHARGING",
  "DC_FAST",
  "INDOOR_GARAGE",
  "UNDERGROUND",
  "CAPACITY_LEVEL",
  "charging capacity",
  "EV charging (AC",
  "EV charging (DC",
  "Does the site include EV charging",
  "Is EV parking or charging in an enclosed",
  "Is EV parking or charging in an underground",
  "Is DC fast charging present",
  "Approximate EV parking/charging capacity",
];

function walk(dir) {
  let out = [];
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (["node_modules", ".next", ".git", "archive", "dist", "build"].includes(e.name)) continue;
        out = out.concat(walk(p));
      } else if (/\.(ts|tsx|js|jsx|md|json)$/.test(e.name)) {
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
    // Skip seed files and migrations (they may contain legacy attribute definitions)
    if (f.includes("db/seeds") || f.includes("db/migrations") || f.includes("archive")) continue;
    
    try {
      const txt = fs.readFileSync(f, "utf8");
      for (const k of FORBIDDEN) {
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
  console.error("[GUARD][NO_MODULE_ATTRIBUTES] Forbidden attribute references found:");
  hits.forEach(h => console.error(`  - "${h.key}" in ${h.file}`));
  console.error("\n[ERROR] Module attributes have been removed from doctrine.");
  console.error("[ERROR] Criteria applicability is determined by the Standard only, not by user-selected attributes.");
  process.exit(1);
}

console.log("[OK][NO_MODULE_ATTRIBUTES] No module attributes detected in app/ directory.");
