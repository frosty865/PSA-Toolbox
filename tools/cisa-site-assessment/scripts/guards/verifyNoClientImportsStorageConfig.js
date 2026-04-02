const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TARGET = "app/lib/storage/config";

const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "archive",
  "dist",
  "build",
]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function isClientFile(p) {
  if (!p.endsWith(".ts") && !p.endsWith(".tsx") && !p.endsWith(".js") && !p.endsWith(".jsx")) return false;
  try {
    const txt = fs.readFileSync(p, "utf-8");
    return txt.includes('"use client"') || txt.includes("'use client'");
  } catch {
    return false;
  }
}

function hasBadImport(txt) {
  return (
    txt.includes(`from "${TARGET}"`) ||
    txt.includes(`from '${TARGET}'`) ||
    txt.includes(`require("${TARGET}")`) ||
    txt.includes(`require('${TARGET}')`)
  );
}

const files = walk(ROOT);
let violations = [];

for (const f of files) {
  if (!isClientFile(f)) continue;
  const txt = fs.readFileSync(f, "utf-8");
  if (hasBadImport(txt)) violations.push(f);
}

if (violations.length) {
  console.error("[GUARD] Client components must not import server-only storage config:");
  for (const v of violations) console.error("  -", v);
  process.exit(1);
}

console.log("[OK] No client components import server-only storage config.");
