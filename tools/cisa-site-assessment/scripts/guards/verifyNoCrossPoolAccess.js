#!/usr/bin/env node
/**
 * Guard: No cross-pool table access
 *
 * - app/api/admin/modules (and subpaths) MUST NOT use getCorpusPool/corpus_client
 *   EXCEPT in: attach-corpus, promote-to-corpus, and sources/route.ts (read-only).
 * - tools/corpus MUST NOT use getRuntimePool/runtime_client or query module_sources.
 *
 * Usage: node scripts/guards/verifyNoCrossPoolAccess.js
 */

const fs = require("fs");
const path = require("path");

const MODULES_API = "app/api/admin/modules";
const CORPUS_TOOLS = "tools/corpus";

const CORPUS_IMPORT = /from\s+['"]@\/app\/lib\/db\/corpus_client['"]|require\s*\(\s*['"].*corpus_client['"]\s*\)/;
const RUNTIME_IMPORT = /from\s+['"]@\/app\/lib\/db\/runtime_client['"]|require\s*\(\s*['"].*runtime_client['"]\s*\)/;
const MODULE_SOURCES_TABLE = /module_sources|module_source_documents/;

const ALLOWLIST_CORPUS_IN_MODULES = [
  "sources/route.ts",
  "sources/attach-corpus/route.ts",
  "sources/[moduleSourceId]/promote-to-corpus/route.ts",
  "ofcs/registrations/route.ts", // bridge: read registrations
  "ofcs/[moduleOfcId]/register/route.ts", // bridge: register module OFC -> ofc_candidate_queue
];

function isAllowlisted(relativePath) {
  const n = relativePath.replace(/\\/g, "/");
  return ALLOWLIST_CORPUS_IN_MODULES.some((a) => n.includes(a));
}

function scanModulesApi() {
  const violations = [];
  const dir = path.join(process.cwd(), MODULES_API);
  if (!fs.existsSync(dir)) return violations;

  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      const rel = path.relative(process.cwd(), full).replace(/\\/g, "/");
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && (e.name.endsWith(".ts") || e.name.endsWith(".tsx"))) {
        const content = fs.readFileSync(full, "utf8");
        if (CORPUS_IMPORT.test(content) && !isAllowlisted(rel)) {
          violations.push({ file: rel, rule: "modules must not use corpus_client except in attach-corpus or promote-to-corpus" });
        }
      }
    }
  }
  walk(dir);
  return violations;
}

function scanToolsCorpus() {
  const violations = [];
  const dir = path.join(process.cwd(), CORPUS_TOOLS);
  if (!fs.existsSync(dir)) return violations;

  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      const rel = path.relative(process.cwd(), full).replace(/\\/g, "/");
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && (e.name.endsWith(".py") || e.name.endsWith(".js"))) {
        const content = fs.readFileSync(full, "utf8");
        if (RUNTIME_IMPORT.test(content)) {
          violations.push({ file: rel, rule: "tools/corpus must not use runtime_client" });
        }
        if (content.includes("module_sources") && /(SELECT|INSERT|UPDATE|DELETE|FROM|INTO)\s+.*module_sources/.test(content)) {
          violations.push({ file: rel, rule: "tools/corpus must not query module_sources (RUNTIME)" });
        }
      }
    }
  }
  walk(dir);
  return violations;
}

function main() {
  console.log("[GUARD] verifyNoCrossPoolAccess: scanning ...\n");

  const v1 = scanModulesApi();
  const v2 = scanToolsCorpus();

  if (v1.length === 0 && v2.length === 0) {
    console.log("✓ No cross-pool violations found.\n");
    process.exit(0);
  }

  console.error("✗ VIOLATIONS:\n");
  [...v1, ...v2].forEach(({ file, rule }) => {
    console.error(`  ${file}`);
    console.error(`    ${rule}\n`);
  });
  console.error("Fix: restrict corpus_client to attach-corpus and promote-to-corpus in modules; do not use runtime_client or module_sources in tools/corpus.\n");
  process.exit(1);
}

main();
