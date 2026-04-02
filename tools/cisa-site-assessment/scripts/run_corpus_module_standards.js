/**
 * Run CORPUS migrations and seeds for module_standards.
 * Use when you see: "Module standards not available. Run CORPUS migration for module_standards."
 *
 * Requires: CORPUS_DATABASE_URL in .env.local
 *
 * Usage: node scripts/run_corpus_module_standards.js
 */

const { loadEnvLocal } = require('./lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('./lib/pg_tls');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
loadEnvLocal(root);

const connectionString = ensureNodePgTls(process.env.CORPUS_DATABASE_URL) ?? process.env.CORPUS_DATABASE_URL;
if (!connectionString) {
  console.error('CORPUS_DATABASE_URL must be set (e.g. in .env.local)');
  process.exit(1);
}

const connectionInfo = connectionString.replace(/:[^:@]+@/, ':****@');
console.log('Connecting to CORPUS:', connectionInfo);

const pool = new Pool(
  applyNodeTls({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  })
);

const FILES = [
  { path: path.join(root, 'db', 'migrations', 'corpus', '20260126_1200_module_standards.sql'), label: 'Migration: module_standards tables' },
  { path: path.join(root, 'db', 'migrations', 'corpus', '20260128_1500_module_standards_type.sql'), label: 'Migration: module_standards standard_type' },
  { path: path.join(root, 'db', 'migrations', 'corpus', '20260128_1800_module_standard_citations.sql'), label: 'Migration: module_standard_citations' },
  { path: path.join(root, 'db', 'migrations', 'corpus', '20260128_1920_auto_ofc_citation_on_insert.sql'), label: 'Migration: auto placeholder citation on OFC insert' },
  { path: path.join(root, 'db', 'seeds', 'corpus', 'EV_PARKING_standard_seed.sql'), label: 'Seed: EV_PARKING standard' },
  { path: path.join(root, 'db', 'seeds', 'corpus', 'EAP_standard_seed.sql'), label: 'Seed: EAP standard' },
  { path: path.join(root, 'db', 'seeds', 'corpus', 'LLM_WIZARD_standard_seed.sql'), label: 'Seed: LLM_WIZARD standard (chunk-generated instances)' },
  { path: path.join(root, 'db', 'seeds', 'corpus', 'PHYSICAL_SECURITY_MEASURES_standard_seed.sql'), label: 'Seed: PHYSICAL_SECURITY_MEASURES (structural OBJECT)' },
  { path: path.join(root, 'db', 'seeds', 'corpus', 'PHYSICAL_SECURITY_PLAN_standard_seed.sql'), label: 'Seed: PHYSICAL_SECURITY_PLAN (structural PLAN)' },
  { path: path.join(root, 'db', 'seeds', 'corpus', '20260128_seed_ofc_citations_placeholder.sql'), label: 'Seed: OFC placeholder citations (existing OFCs)' },
];

async function runFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    throw new Error(`Missing: ${filePath}`);
  }
  const sql = fs.readFileSync(filePath, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`  ✓ ${label}`);
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`  ✗ ${label}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  console.log('\nRunning CORPUS module_standards migrations and seeds...\n');
  try {
    for (const { path: filePath, label } of FILES) {
      await runFile(filePath, label);
    }
    console.log('\n✅ Module standards setup complete. Standards should now load in the admin UI.\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
