#!/usr/bin/env node
/**
 * Test database connections directly.
 *
 * REQUIREMENTS (enforced):
 * - Use ONLY RUNTIME_DATABASE_URL and CORPUS_DATABASE_URL
 * - DO NOT derive database URLs from SUPABASE_URL, SUPABASE_RUNTIME_URL,
 *   NEXT_PUBLIC_SUPABASE_URL, or any HTTP endpoint
 * - DO NOT override dbname or port
 */

const { loadEnvLocal } = require("./lib/load_env_local");
const { ensureNodePgTls, applyNodeTls } = require("./lib/pg_tls");

loadEnvLocal(process.cwd());

if (!process.env.RUNTIME_DATABASE_URL || !process.env.CORPUS_DATABASE_URL) {
  console.error(
    "Missing required DB URLs. Set RUNTIME_DATABASE_URL and CORPUS_DATABASE_URL in .env.local"
  );
  process.exit(1);
}

const { Pool } = require("pg");

async function testRuntime() {
  console.log("\n=== Testing RUNTIME Connection ===");
  const connectionString = ensureNodePgTls(process.env.RUNTIME_DATABASE_URL) ?? process.env.RUNTIME_DATABASE_URL;
  console.log("Using RUNTIME_DATABASE_URL (no derivation)");

  try {
    const pool = new Pool(
      applyNodeTls({
        connectionString,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
      })
    );

    const result = await pool.query("SELECT 1 FROM assessments LIMIT 1");
    console.log("✅ RUNTIME connection successful");
    await pool.end();
    return true;
  } catch (error) {
    console.error("❌ RUNTIME connection failed:", error.message);
    return false;
  }
}

async function testCorpus() {
  console.log("\n=== Testing CORPUS Connection ===");
  const connectionString = ensureNodePgTls(process.env.CORPUS_DATABASE_URL) ?? process.env.CORPUS_DATABASE_URL;
  console.log("Using CORPUS_DATABASE_URL (no derivation)");

  try {
    const pool = new Pool(
      applyNodeTls({
        connectionString,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
      })
    );

    await pool.query("SELECT 1");
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'canonical_sources'
      )
    `);

    if (tableCheck.rows[0]?.exists) {
      console.log("✅ CORPUS connection successful (table exists)");
    } else {
      console.log(
        "✅ CORPUS connection successful (table does not exist yet - need to apply schema)"
      );
    }
    await pool.end();
    return true;
  } catch (error) {
    console.error("❌ CORPUS connection failed:", error.message);
    return false;
  }
}

async function main() {
  console.log("Testing database connections...\n");
  const runtimeOk = await testRuntime();
  const corpusOk = await testCorpus();

  console.log("\n=== Summary ===");
  console.log("RUNTIME:", runtimeOk ? "✅ OK" : "❌ FAILED");
  console.log("CORPUS:", corpusOk ? "✅ OK" : "❌ FAILED");

  if (runtimeOk && corpusOk) {
    console.log("\n✅ Both connections working!");
    process.exit(0);
  } else {
    console.log("\n❌ Some connections failed");
    process.exit(1);
  }
}

main().catch(console.error);
