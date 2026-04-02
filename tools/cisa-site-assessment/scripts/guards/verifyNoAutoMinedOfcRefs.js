#!/usr/bin/env node
/**
 * Build-time guard: PSA OFC Doctrine V1
 *
 * OFCs must be authored, not mined from documents. Documents are evidence only.
 *
 * - FAIL: matches in runtime/product paths (app/, services/, model/, psa_engine/, src/, server/)
 *        or package.json scripts that invoke mining tooling (except explicit legacy)
 * - WARN: matches under tools/, analytics/, docs/ (allowed during deprecation)
 * - scripts/guards/ and migrations/ are never scanned (no self-trigger, no migration enforcement)
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

// ---- Scope definitions ----

const RUNTIME_PATH_PREFIXES = [
  "app/",
  "services/",
  "model/",
  "psa_engine/",
  "src/",
  "server/",
];

const ALLOWED_LEGACY_PREFIXES = ["tools/", "analytics/", "docs/"];

const ALWAYS_EXCLUDE_PREFIXES = [
  "node_modules/",
  ".next/",
  ".git/",
  "archive/",
  "dist/",
  "build/",
  "scripts/guards/",
  "migrations/",
];

const ALWAYS_EXCLUDE_SUFFIXES = [".md", ".pdf", ".xlsx"];

/** Allowed package.json script names that may reference mining (must NOT be invoked by build/test) */
const ALLOWED_LEGACY_PKG_SCRIPT_NAMES = new Set(["tools:legacy-mining"]);

/** Script names that are guards/verification (reference OFC/extraction in a "do not do" sense); skip in pkg check */
const PKG_SCRIPT_GUARD_NAMES = new Set(["guard:ofc-extraction", "guard:ofc_doctrine"]);

const BAD_PATTERNS = [
  /mine[_-]?ofc/i,
  /auto[_-]?ofc/i,
  /extract(ed)?[_-]?ofc/i,
  /OFC\s*extraction/i,
  /extract.*ofc.*from.*document/i,
];

const SCAN_EXT = /\.(ts|tsx|js|jsx|py|sql)$/i;

// ---- Helpers ----

function norm(rel) {
  return rel.replace(/\\/g, "/");
}

function isAlwaysExcluded(rel) {
  const n = norm(rel);
  if (ALWAYS_EXCLUDE_SUFFIXES.some((s) => n.endsWith(s))) return true;
  return ALWAYS_EXCLUDE_PREFIXES.some((p) => n.startsWith(p) || n.includes("/" + p));
}

function isRuntime(rel) {
  const n = norm(rel);
  return RUNTIME_PATH_PREFIXES.some((p) => n.startsWith(p));
}

function isAllowedLegacy(rel) {
  const n = norm(rel);
  return ALLOWED_LEGACY_PREFIXES.some((p) => n.startsWith(p));
}

function matchesBadPattern(text) {
  for (const rx of BAD_PATTERNS) {
    if (rx.test(text)) return rx.toString();
  }
  return null;
}

// ---- Walk ----

const EXCLUDE_DIRS = new Set(["node_modules", ".next", ".git", "archive", "dist", "build", "venv", "__pycache__", ".venv"]);

function walk(dir, files = []) {
  try {
    for (const entry of fs.readdirSync(dir)) {
      const p = path.join(dir, entry);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        if (EXCLUDE_DIRS.has(entry)) continue;
        walk(p, files);
      } else {
        if (!SCAN_EXT.test(entry)) continue;
        const rel = path.relative(ROOT, p);
        if (isAlwaysExcluded(rel)) continue;
        files.push(p);
      }
    }
  } catch (err) {
    // ignore
  }
  return files;
}

// ---- File scan ----

const failBucket = [];
const warnBucket = [];

for (const f of walk(ROOT)) {
  const rel = path.relative(ROOT, f).replace(/\\/g, "/");
  try {
    const text = fs.readFileSync(f, "utf8");
    const pat = matchesBadPattern(text);
    if (!pat) continue;

    if (isRuntime(rel)) {
      failBucket.push({ file: rel, pattern: pat });
    } else if (isAllowedLegacy(rel)) {
      warnBucket.push({ file: rel, pattern: pat });
    } else {
      warnBucket.push({ file: rel, pattern: pat });
    }
  } catch (err) {
    // skip read errors
  }
}

// ---- package.json script check (FAIL) ----

const pkgFail = [];
const pkgWarn = [];
let pkg;

try {
  const raw = fs.readFileSync(path.join(ROOT, "package.json"), "utf8");
  pkg = JSON.parse(raw);
} catch (e) {
  // no package.json or invalid: skip
  pkg = { scripts: {} };
}

const scripts = pkg.scripts || {};
const buildLikeScripts = ["build", "build:full", "build:branching", "test:contracts", "ci:intent", "ci:baseline", "quality", "lint", "typecheck"];

function scriptValueInvokesMining(val) {
  if (typeof val !== "string") return null;
  return matchesBadPattern(val);
}

// Scripts that are allowed to reference mining (legacy); they must NOT be invoked by build/test
const legacyPkgThatAreInvoked = [];

for (const [name, value] of Object.entries(scripts)) {
  if (PKG_SCRIPT_GUARD_NAMES.has(name)) continue;
  const pat = scriptValueInvokesMining(value);
  if (!pat) continue;

  if (ALLOWED_LEGACY_PKG_SCRIPT_NAMES.has(name)) {
    pkgWarn.push({ script: name, pattern: pat, allowed: true });
    // Check if any build-like script invokes this by name
    const invokedBy = buildLikeScripts.filter((b) => {
      const v = scripts[b];
      return typeof v === "string" && new RegExp("\\b" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(v);
    });
    if (invokedBy.length > 0) {
      pkgFail.push({ script: name, pattern: pat, invokedBy });
    }
  } else {
    pkgFail.push({ script: name, pattern: pat });
  }
}

// ---- Output and exit ----

const hasFail = failBucket.length > 0 || pkgFail.length > 0;

if (warnBucket.length > 0) {
  console.log("[GUARD] Legacy scripts with auto-mining patterns (WARN-only; allowed in /tools during deprecation):");
  for (const w of warnBucket) {
    console.log("  - " + w.file + " (matches " + w.pattern + ")");
  }
  console.log("");
}

if (failBucket.length > 0) {
  console.error("[GUARD] Doctrine violations in runtime/product paths (FAIL):");
  for (const b of failBucket) {
    console.error("  - " + b.file + " (matches " + b.pattern + ")");
  }
  console.error("");
}

if (pkgFail.length > 0) {
  console.error("[GUARD] Doctrine violations in package.json scripts (FAIL):");
  for (const p of pkgFail) {
    if (p.invokedBy) {
      console.error("  - " + p.script + " (matches " + p.pattern + ") [invoked by: " + p.invokedBy.join(", ") + "]");
    } else {
      console.error("  - " + p.script + " (matches " + p.pattern + ")");
    }
  }
  console.error("");
}

if (hasFail) {
  console.error("[GUARD] These patterns violate PSA OFC Doctrine V1:");
  console.error("  - OFCs must be authored, not mined from documents");
  console.error("  - Documents are evidence only, not OFC sources");
  process.exit(1);
}

console.log("[OK] No runtime/product auto-mining references detected.");
const hasToolsWarn = warnBucket.some((w) => norm(w.file).startsWith("tools/"));
if (hasToolsWarn) {
  console.log("[WARN] Legacy tooling still present under /tools (deprecate/remove when ready).");
}
process.exit(0);
