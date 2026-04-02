#!/usr/bin/env npx tsx
/**
 * Debug .env.local (and related env files) for psa_rebuild.
 *
 * Run from psa_rebuild: npx tsx tools/debug_env_local.ts
 *
 * - Reports which env files exist and are loaded
 * - Lists DB-related env vars (names only; values redacted)
 * - Checks for common issues (missing SSL in URLs, CORPUS vs RUNTIME)
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(process.cwd());
const ENV_FILES = [".env.local", "env.local", ".local.env", ".env"];

// Keys we care about for DB / Supabase (report present/missing; redact secrets)
const DB_KEYS = [
  "RUNTIME_DATABASE_URL",
  "CORPUS_DATABASE_URL",
  "DATABASE_URL",
  "DATABASE_USER",
  "DATABASE_PASSWORD",
  "SUPABASE_RUNTIME_URL",
  "SUPABASE_RUNTIME_DB_PASSWORD",
  "SUPABASE_CORPUS_URL",
  "SUPABASE_CORPUS_DB_PASSWORD",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NODE_TLS_REJECT_UNAUTHORIZED",
];

function loadEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return out;
  const raw = fs.readFileSync(filePath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    value = value.replace(/^["']|["']$/g, "").trim();
    out[key] = value;
  }
  return out;
}

function redact(value: string, maxVisible = 4): string {
  if (!value) return "(empty)";
  if (value.length <= maxVisible) return "***";
  return value.slice(0, maxVisible) + "…" + value.slice(-2) + " (" + value.length + " chars)";
}

function hasSslMode(url: string): boolean {
  return /[?&]sslmode=/i.test(url);
}

function main() {
  console.log("=== .env.local debug ===\n");
  console.log("Project root:", ROOT);
  console.log("");

  // 1. Which files exist
  console.log("Env files (later files override earlier when loading):");
  for (const name of ENV_FILES) {
    const full = path.join(ROOT, name);
    const exists = fs.existsSync(full);
    console.log("  ", exists ? "[OK]" : "[--]", name, full);
  }
  if (fs.existsSync(path.join(ROOT, ".env.local")) && fs.existsSync(path.join(ROOT, "env.local"))) {
    console.log("  (Tip: both .env.local and env.local exist; consider using one to avoid confusion.)");
  }
  console.log("");

  // 2. Load .env.local first (Next.js convention), then overlay others
  let env: Record<string, string> = {};
  for (const name of ENV_FILES) {
    const full = path.join(ROOT, name);
    if (fs.existsSync(full)) {
      const loaded = loadEnvFile(full);
      env = { ...env, ...loaded };
    }
  }

  // 3. Apply to process.env so we see what scripts would see
  for (const [k, v] of Object.entries(env)) {
    process.env[k] = v;
  }

  // 4. DB-related vars
  console.log("DB-related env vars (values redacted):");
  for (const key of DB_KEYS) {
    const value = process.env[key] ?? env[key];
    const set = value !== undefined && value !== "";
    if (!set) {
      console.log("  ", "[MISSING]", key);
      continue;
    }
    const redacted = redact(value);
    let extra = "";
    if (key.endsWith("_URL") && typeof value === "string") {
      if (value.startsWith("postgresql://") || value.startsWith("postgres://")) {
        extra = hasSslMode(value) ? " [has sslmode]" : " [NO sslmode - add ?sslmode=require for Supabase]";
      }
    }
    console.log("  ", "[SET]", key, "=", redacted, extra);
  }
  console.log("");

  // 5. Summary for PDF processing (process_module_pdfs_from_incoming)
  console.log("For process_module_pdfs_from_incoming.py:");
  const runtimeUrl = process.env.RUNTIME_DATABASE_URL ?? env.RUNTIME_DATABASE_URL;
  const corpusUrl =
    process.env.CORPUS_DATABASE_URL ??
    env.CORPUS_DATABASE_URL ??
    (process.env.SUPABASE_CORPUS_URL && process.env.SUPABASE_CORPUS_DB_PASSWORD ? "(built from SUPABASE_CORPUS_*)" : null);
  console.log("  RUNTIME:", runtimeUrl ? (hasSslMode(runtimeUrl) ? "OK (has SSL)" : "Missing sslmode in URL") : "MISSING (set RUNTIME_DATABASE_URL or SUPABASE_RUNTIME_*)");
  console.log("  CORPUS:", corpusUrl ? (typeof corpusUrl === "string" && hasSslMode(corpusUrl) ? "OK (has SSL)" : typeof corpusUrl === "string" ? "Missing sslmode in URL" : "OK (built with SSL)") : "MISSING (set CORPUS_DATABASE_URL or SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD)");
  console.log("");
}

main();
