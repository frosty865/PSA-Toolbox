const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const EXCLUDE_DIRS = new Set(["node_modules", ".next", ".git", "archive", "dist", "build"]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(p)) out.push(p);
  }
  return out;
}

const needles = [
  { name: "process.cwd()", re: /process\.cwd\(\)/g },
  { name: "spawnSync(", re: /\bspawnSync\s*\(/g },
  { name: "spawn(", re: /\bspawn\s*\(/g },
  { name: "fs\\.mkdir at top-level (heuristic)", re: /await\s+fs\.mkdir|fs\.mkdirSync/g },
  { name: "path.join(...raw)", re: /path\.join\([^\)]*raw[^\)]*\)/g },
  { name: "absolute Windows drive literal", re: /\b[A-Za-z]:[\\/]/g },
  { name: '"use client"', re: /["']use client["']/g },
];

const files = walk(ROOT);
const findings = [];

for (const f of files) {
  const txt = fs.readFileSync(f, "utf-8");
  for (const n of needles) {
    const m = txt.match(n.re);
    if (m && m.length) {
      findings.push({ file: path.relative(ROOT, f), needle: n.name, hits: m.length });
    }
  }
}

findings.sort((a, b) => b.hits - a.hits);

console.log("BUILD/LOAD AUDIT FINDINGS (sorted by hits):");
for (const row of findings) {
  console.log(`- ${row.hits.toString().padStart(4)}  ${row.needle}  ${row.file}`);
}

console.log("\nNEXT ACTIONS (manual):");
console.log("- Any fs/path/process usage imported by client components must be moved behind server-only fences.");
console.log("- Any spawn/spawnSync in hot API routes should be cached or moved to offline/precompute.");
