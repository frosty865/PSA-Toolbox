const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TARGET = "Scenario Context";

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (["node_modules", ".next", ".git", "archive"].includes(ent.name)) continue;
      out.push(...walk(p));
    } else {
      if (!/\.(ts|tsx|js|jsx|md)$/.test(ent.name)) continue;
      out.push(p);
    }
  }
  return out;
}

let found = [];
for (const f of walk(path.join(ROOT, "app"))) {
  const txt = fs.readFileSync(f, "utf8");
  if (txt.includes(TARGET)) found.push(f);
}

if (found.length) {
  console.error(`[GUARD][NO_SCENARIO_CONTEXT_UI] Found "${TARGET}" in:`);
  for (const f of found) console.error(` - ${f}`);
  process.exit(1);
}

console.log("[OK][NO_SCENARIO_CONTEXT_UI] No Scenario Context UI strings found.");
