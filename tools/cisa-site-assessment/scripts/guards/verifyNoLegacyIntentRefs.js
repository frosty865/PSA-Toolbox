#!/usr/bin/env node
/**
 * No Legacy Intent References Guard (Meaning Layer Reset)
 *
 * Fails build if the repo contains:
 * - intent_object, what_counts_as_yes, what-counts-as-yes, evidence_tips, field_tips, enforcement
 * - "what counts as yes" (case-insensitive)
 * - subtype_code used as the gating condition for Help (instead of discipline_subtype_id)
 *
 * Excludes: node_modules, .next, .git, archive/, dist/, build/, *.md, fixtures
 * Allowlist for subtype_code: model/taxonomy_loader*, scripts/taxonomy/*, migrations/*, app/lib/taxonomy/*
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(process.argv[2] || process.cwd());

const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.next/,
  /\.git/,
  /venv\//,
  /archive\//,
  /dist\//,
  /build\//,
  /\.md$/,
  /fixtures?\//,
  /__tests__\//,
  /\.test\.(ts|tsx|js|jsx)$/,
  /verifyNoLegacyIntentRefs\.js/,
  /app_broken\//,
];

const ALLOWLIST_SUBTYPE_CODE = [
  /model\/taxonomy_loader/i,
  /scripts\/taxonomy\//i,
  /migrations?\//i,
  /app\/lib\/taxonomy\//i,
];

const FORBIDDEN = [
  { re: /\bintent_object\b/, msg: "intent_object" },
  { re: /\bwhat_counts_as_yes\b/, msg: "what_counts_as_yes" },
  { re: /what-counts-as-yes/, msg: "what-counts-as-yes" },
  { re: /\bevidence_tips\b/, msg: "evidence_tips" },
  { re: /\bfield_tips\b/, msg: "field_tips" },
  { re: /enforcement\s*[:=]|\.enforcement\b|["']enforcement["']/, msg: "enforcement (as key/identifier)" },
  { re: /what\s+counts\s+as\s+yes/i, msg: '"what counts as yes" (phrase)' },
];

function isAllowlistedSubtypeCode(rel) {
  return ALLOWLIST_SUBTYPE_CODE.some((p) => p.test(rel));
}

function shouldExclude(filePath) {
  const rel = path.relative(ROOT, filePath);
  return EXCLUDE_PATTERNS.some((p) => p.test(rel));
}

function shouldScan(filePath) {
  if (shouldExclude(filePath)) return false;
  const ext = path.extname(filePath);
  return [".ts", ".tsx", ".js", ".jsx"].includes(ext);
}

function walk(dir, out = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (!shouldExclude(full)) walk(full, out);
      } else if (ent.isFile() && shouldScan(full)) {
        out.push(full);
      }
    }
  } catch (e) {
    if (e.code !== "EACCES" && e.code !== "ENOENT") console.warn(`Warning: ${e.message}`);
  }
  return out;
}

function isAllowlistedForForbidden(rel) {
  const n = rel.replace(/\\/g, "/");
  return (
    /app\/lib\/(contracts|invariants)\//.test(n) ||
    /scripts\/guards\//.test(n) ||
    /app\/lib\/types\/intent\.ts$/.test(n) ||
    /app\/reference\//.test(n) ||
    /tools\/(generate_intent_objects|validate_intent_objects|validate_subtype_guidance)\.ts$/.test(n)
  );
}

function checkForbidden(content, filePath) {
  const rel = path.relative(ROOT, filePath);
  if (isAllowlistedForForbidden(rel)) return [];
  const hits = [];
  const lines = content.split("\n");

  for (const { re, msg } of FORBIDDEN) {
    lines.forEach((line, i) => {
      if (re.test(line)) {
        const t = line.trim();
        if (
          t.startsWith("//") ||
          t.startsWith("/*") ||
          t.startsWith("*") ||
          t.startsWith("/**") ||
          /REMOVED|deprecated|@deprecated|legacy intent|Legacy intent|forbidden|Must not/i.test(line)
        ) {
          return;
        }
        hits.push({ file: rel, line: i + 1, msg, snippet: line.trim().slice(0, 100) });
      }
    });
  }

  return hits;
}

function checkSubtypeCodeForHelpGate(content, filePath) {
  const rel = path.relative(ROOT, filePath);
  if (isAllowlistedSubtypeCode(rel)) return [];

  const uiDir = /(^|\/)app\/(components|admin|assessments)(\/|$)/.test(rel);
  if (!uiDir) return [];

  const hits = [];
  const lines = content.split("\n");

  lines.forEach((line, i) => {
    if (/Boolean\s*\(\s*[^)]*\bsubtype_code\b[^)]*\)/.test(line) && !/\bdiscipline_subtype_id\b/.test(line)) {
      const t = line.trim();
      if (t.startsWith("//") || t.startsWith("/*") || t.startsWith("*")) return;
      hits.push({
        file: rel,
        line: i + 1,
        msg: "subtype_code used as Help/visibility gate; use discipline_subtype_id only",
        snippet: line.trim().slice(0, 120),
      });
    }
  });

  return hits;
}

function main() {
  console.log("[GUARD] verifyNoLegacyIntentRefs: scanning for legacy intent and subtype_code help-gating...\n");
  console.log("[GUARD] Excluding: node_modules, .next, .git, archive/, dist/, build/, *.md, fixtures\n");

  const files = walk(ROOT);
  console.log(`[GUARD] Scanned ${files.length} files\n`);

  let all = [];
  for (const f of files) {
    try {
      const content = fs.readFileSync(f, "utf8");
      const rel = path.relative(ROOT, f);
      all = all.concat(checkForbidden(content, f));
      if (!isAllowlistedForForbidden(rel)) {
        all = all.concat(checkSubtypeCodeForHelpGate(content, f));
      }
    } catch (e) {
      if (e.code !== "EACCES") console.warn(`Warning: ${f} ${e.message}`);
    }
  }

  if (all.length > 0) {
    console.error("[FAIL] verifyNoLegacyIntentRefs: legacy intent or invalid Help gating detected:\n");
    const byFile = new Map();
    for (const h of all) {
      if (!byFile.has(h.file)) byFile.set(h.file, []);
      byFile.get(h.file).push(h);
    }
    for (const [file, hits] of byFile) {
      console.error(`  ${file}:`);
      for (const h of hits) {
        console.error(`    L${h.line}: ${h.msg}`);
        console.error(`      ${h.snippet}`);
      }
    }
    console.error("\n[FAIL] Build blocked. Remove legacy intent refs and use discipline_subtype_id for Help gating.");
    process.exit(1);
  }

  console.log("[OK] No legacy intent references or subtype_code Help gating found.\n");
  process.exit(0);
}

main();
