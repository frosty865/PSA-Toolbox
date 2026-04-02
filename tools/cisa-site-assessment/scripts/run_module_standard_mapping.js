#!/usr/bin/env node
/**
 * Run module → standard mapping: INSPECT, FLAG, optionally FIX, VERIFY.
 * Uses RUNTIME_DATABASE_URL. See docs/MODULE_STANDARD_MAPPING.md.
 *
 * Usage: node scripts/run_module_standard_mapping.js [--apply]
 *   --apply  Run the FIX (UPDATE) when FLAG returns rows; otherwise only INSPECT, FLAG, VERIFY.
 */

const { loadEnvLocal } = require("./lib/load_env_local");
const { ensureNodePgTls, applyNodeTls } = require("./lib/pg_tls");
const { Pool } = require("pg");

loadEnvLocal(process.cwd());

const apply = process.argv.includes("--apply");

const OBJECT_MODULES = [
  "MODULE_EV_PARKING",
  "MODULE_EV_CHARGING",
  "MODULE_EV_PARKING_CHARGING",
];

const INSPECT_SQL = `
SELECT
  am.module_code,
  am.module_name,
  am.standard_class,
  mi.standard_key,
  mi.standard_version,
  mi.generated_at
FROM assessment_modules am
LEFT JOIN module_instances mi ON mi.module_code = am.module_code
ORDER BY am.module_code
`;

const FLAG_SQL = `
SELECT
  am.module_code,
  am.standard_class AS module_standard_class,
  mi.standard_key AS instance_standard_key,
  mi.standard_version
FROM assessment_modules am
JOIN module_instances mi ON mi.module_code = am.module_code
WHERE mi.standard_key IN ('PHYSICAL_SECURITY_PLAN', 'EAP')
  AND am.module_code = ANY($1::text[])
`;

const FIX_INSTANCES_SQL = `
UPDATE module_instances mi
SET standard_key = 'PHYSICAL_SECURITY_MEASURES',
    standard_version = 'v1'
WHERE mi.module_code = ANY($1::text[])
  AND mi.standard_key IN ('PHYSICAL_SECURITY_PLAN', 'EAP')
`;

const FIX_ASSESSMENT_MODULES_SQL = `
UPDATE assessment_modules
SET standard_class = 'PHYSICAL_SECURITY_MEASURES'
WHERE module_code = ANY($1::text[])
  AND (standard_class IS NULL OR standard_class = 'PHYSICAL_SECURITY_PLAN')
`;

const VERIFY_SQL = `
SELECT
  am.module_code,
  am.standard_class,
  mi.standard_key,
  mi.standard_version
FROM assessment_modules am
LEFT JOIN module_instances mi ON mi.module_code = am.module_code
WHERE am.module_code = ANY($1::text[])
`;

function table(rows, columns) {
  if (rows.length === 0) {
    return "(no rows)";
  }
  const colWidths = columns.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)));
  const line = (r) => columns.map((c, i) => String(r[c] ?? "").padEnd(colWidths[i])).join("  ");
  return [columns.map((c, i) => c.padEnd(colWidths[i])).join("  "), ...rows.map(line)].join("\n");
}

async function main() {
  const connectionString =
    ensureNodePgTls(process.env.RUNTIME_DATABASE_URL) ?? process.env.RUNTIME_DATABASE_URL;
  if (!connectionString) {
    console.error("RUNTIME_DATABASE_URL is required (e.g. in .env.local)");
    process.exit(1);
  }

  const pool = new Pool(
    applyNodeTls({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    })
  );

  try {
    console.log("=== 1) INSPECT: Current mapping ===\n");
    const inspect = await pool.query(INSPECT_SQL);
    const cols = inspect.fields.map((f) => f.name);
    console.log(table(inspect.rows, cols));
    console.log("");

    console.log("=== 2) FLAG: OBJECT modules incorrectly mapped to PLAN ===\n");
    const flag = await pool.query(FLAG_SQL, [OBJECT_MODULES]);
    const needInstanceFix = flag.rows.length > 0;
    // Also flag OBJECT modules that have standard_class = PLAN (even with no instance)
    const classCheck = await pool.query(
      `SELECT module_code, standard_class FROM assessment_modules WHERE module_code = ANY($1::text[]) AND (standard_class IS NULL OR standard_class = 'PHYSICAL_SECURITY_PLAN')`,
      [OBJECT_MODULES]
    );
    const needClassFix = classCheck.rows.length > 0;
    console.log(table(flag.rows, flag.fields.map((f) => f.name)));
    if (needInstanceFix) {
      console.log("\n⚠️  " + flag.rows.length + " module(s) have doctrine instance on PLAN; need remap.");
    }
    if (needClassFix) {
      console.log("\n⚠️  " + classCheck.rows.length + " module(s) have standard_class PLAN or NULL; will set to PHYSICAL_SECURITY_MEASURES.");
    }
    if (apply && (needInstanceFix || needClassFix)) {
      console.log("\n=== 3) FIX: Applying remap (--apply) ===\n");
      const u1 = await pool.query(FIX_INSTANCES_SQL, [OBJECT_MODULES]);
      const u2 = await pool.query(FIX_ASSESSMENT_MODULES_SQL, [OBJECT_MODULES]);
      console.log("  module_instances updated:", u1.rowCount ?? 0);
      console.log("  assessment_modules updated:", u2.rowCount ?? 0);
      console.log("\nRe-run Standard → Generate for each affected module with standard_key = PHYSICAL_SECURITY_MEASURES.");
    } else if (needInstanceFix || needClassFix) {
      console.log("\nRun with --apply to remap these modules to PHYSICAL_SECURITY_MEASURES.");
    } else if (!needInstanceFix && !needClassFix) {
      console.log("(none)");
    }

    console.log("\n=== 4) VERIFY ===\n");
    const verify = await pool.query(VERIFY_SQL, [OBJECT_MODULES]);
    console.log(table(verify.rows, verify.fields.map((f) => f.name)));
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
