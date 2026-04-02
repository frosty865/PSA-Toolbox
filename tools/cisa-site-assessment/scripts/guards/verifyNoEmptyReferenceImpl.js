#!/usr/bin/env node
/**
 * verifyNoEmptyReferenceImpl
 *
 * FAIL build if:
 *   help_enabled === true
 *   AND the subtype is "help empty" (no overview AND no Reference Implementation)
 *   AND that subtype is NOT in the allowlist
 *
 * Allowlist: help-empty subtypes we are not yet publishing yet. Add UUIDs here
 * when a subtype is intentionally left empty for now.
 *
 * Requires RUNTIME_DATABASE_URL (or .env.local). If unset or DB unavailable,
 * the guard is SKIPPED (exit 0) so CI without DB does not block.
 */

const fs = require("fs");
const path = require("path");
const { loadEnvLocal } = require("../lib/load_env_local");
const { ensureNodePgTls, applyNodeTls } = require("../lib/pg_tls");

loadEnvLocal(process.cwd());

const ALLOWLIST = new Set([
  // EAP subtypes not yet published in the EAP thin-slice
  "8c3e82d1-a7c9-40b2-8836-cfa3da36d40c", // EAP — Emergency Drills
  "1dbe7509-76a7-4cfc-bd97-d73de4a85cb0", // EAP — Emergency Guides / Flip Charts
  // Current help-empty subtypes intentionally left unpublished
  "49dc0a38-bed6-40fa-b196-ed2c2e7073b2", // System Architecture
  "7ac2d54b-cd7c-4fa3-83e1-8ee669e94fd4", // Pedestrian Access Control Points
  "e25cb583-3392-4eb8-9f32-92fa9f31f0cd", // External Reporting
  // Add other discipline_subtype_id UUIDs here when help_enabled but no RI yet.
]);

const connectionString = ensureNodePgTls(process.env.RUNTIME_DATABASE_URL) ?? process.env.RUNTIME_DATABASE_URL;

async function main() {
  if (!connectionString) {
    console.warn("[verifyNoEmptyReferenceImpl] SKIP: RUNTIME_DATABASE_URL not set. Guard not run.\n");
    process.exit(0);
  }

  let Pool;
  try {
    Pool = require("pg").Pool;
  } catch (e) {
    console.warn("[verifyNoEmptyReferenceImpl] SKIP: pg not available. Guard not run.\n");
    process.exit(0);
  }

  const pool = new Pool(
    applyNodeTls({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  );

  let rows = [];
  try {
    const res = await pool.query(`
      SELECT DISTINCT b.discipline_subtype_id::text AS id
      FROM public.baseline_spines_runtime b
      LEFT JOIN public.discipline_subtypes ds ON ds.id = b.discipline_subtype_id
      LEFT JOIN public.discipline_subtype_reference_impl r ON r.discipline_subtype_id = b.discipline_subtype_id
      WHERE b.active = true
        AND b.discipline_subtype_id IS NOT NULL
        AND COALESCE(NULLIF(TRIM(COALESCE(ds.overview, '')), ''), '') = ''
        AND r.discipline_subtype_id IS NULL
    `);
    rows = res.rows || [];
  } catch (e) {
    const msg = String(e?.message || "");
    if (
      msg.includes("does not exist") ||
      msg.includes("relation") ||
      /42P01|42P02/.test(String(e?.code || ""))
    ) {
      console.warn("[verifyNoEmptyReferenceImpl] SKIP: Required tables missing (baseline_spines_runtime or discipline_subtype_reference_impl). Guard not run.\n");
      await pool.end();
      process.exit(0);
    }
    console.error("[verifyNoEmptyReferenceImpl] DB query failed:", msg);
    await pool.end();
    process.exit(1);
  } finally {
    await pool.end();
  }

  const violations = rows
    .map((r) => r?.id)
    .filter(Boolean)
    .filter((id) => !ALLOWLIST.has(id));

  if (violations.length > 0) {
    console.error("[FAIL] verifyNoEmptyReferenceImpl: help_enabled but no Reference Implementation and not in allowlist:\n");
    violations.forEach((id) => console.error(`  discipline_subtype_id: ${id}`));
    console.error("\nFix: add a Reference Implementation for these subtypes, or add their UUIDs to the ALLOWLIST in scripts/guards/verifyNoEmptyReferenceImpl.js.\n");
    process.exit(1);
  }

  console.log("[OK] verifyNoEmptyReferenceImpl: no empty doctrine (help_enabled + no RI) for non-allowlisted subtypes.\n");
  process.exit(0);
}

main();
