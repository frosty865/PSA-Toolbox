const { loadEnvLocal } = require('./lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('./lib/pg_tls');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

loadEnvLocal(process.cwd());

const rawUrl = (process.env.DATABASE_USER && process.env.DATABASE_PASSWORD && process.env.DATABASE_HOST)
  ? `postgresql://${process.env.DATABASE_USER}:${encodeURIComponent(process.env.DATABASE_PASSWORD)}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT || '5432'}/${process.env.DATABASE_NAME || 'postgres'}`
  : process.env.DATABASE_URL || null;

if (!rawUrl) {
  console.error('DATABASE_URL or DATABASE_USER/DATABASE_PASSWORD must be set');
  process.exit(1);
}

const connectionString = ensureNodePgTls(rawUrl) ?? rawUrl;
const connectionInfo = connectionString.replace(/:[^:@]+@/, ':****@');
console.log(`Connecting to: ${connectionInfo}`);

const pool = new Pool(
  applyNodeTls({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  })
);

async function runMigration(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`✓ Successfully ran ${filePath}`);
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`✗ Error running ${filePath}:`, error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const migrationFile = process.argv[2];
  if (!migrationFile) {
    console.error('Usage: node scripts/run_migration.js <migration_file.sql>');
    process.exit(1);
  }
  
  const filePath = path.resolve(migrationFile);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  
  if (!connectionString) {
    console.error('DATABASE_URL not found in environment');
    process.exit(1);
  }
  
  try {
    console.log(`Running migration: ${filePath}`);
    await runMigration(filePath);
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

