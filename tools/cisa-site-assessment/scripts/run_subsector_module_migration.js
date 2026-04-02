#!/usr/bin/env node
/**
 * Run Subsector Module Policy Migration
 * 
 * Executes the migration to create subsector_module_policy table and extend
 * assessment_module_instances with locking columns.
 */

const { loadEnvLocal } = require('./lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('./lib/pg_tls');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

loadEnvLocal(process.cwd());

async function runMigration() {
  console.log('\n=== Running Subsector Module Policy Migration ===\n');
  let connectionString = process.env.RUNTIME_DATABASE_URL;
  if (!connectionString) {
    if (process.env.DATABASE_URL) {
      connectionString = process.env.DATABASE_URL;
    } else {
      const runtimeUrl = process.env.SUPABASE_RUNTIME_URL;
      const runtimePassword = process.env.SUPABASE_RUNTIME_DB_PASSWORD || process.env.DATABASE_PASSWORD;
      if (!runtimeUrl || !runtimePassword) {
        console.error('❌ RUNTIME env vars not set');
        console.error('Need: RUNTIME_DATABASE_URL, DATABASE_URL, or SUPABASE_RUNTIME_URL + password');
        process.exit(1);
      }
      const url = new URL(runtimeUrl);
      const hostname = url.hostname.replace('.supabase.co', '');
      connectionString = `postgresql://postgres:${encodeURIComponent(runtimePassword)}@db.${hostname}.supabase.co:6543/psa_runtime`;
    }
  }
  const migrationFile = path.join(__dirname, '..', 'db', 'migrations', '20260121_subsector_module_policy_and_instance_locking.sql');
  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ Migration file not found: ${migrationFile}`);
    process.exit(1);
  }
  const sql = fs.readFileSync(migrationFile, 'utf-8');
  console.log(`Reading migration file: ${migrationFile}`);
  console.log(`Migration size: ${sql.length} characters\n`);
  const normalizedUrl = ensureNodePgTls(connectionString) ?? connectionString;
  const pool = new Pool(
    applyNodeTls({
      connectionString: normalizedUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    })
  );
  
  try {
    console.log('Connecting to database...');
    await pool.query('SELECT 1');
    console.log('✅ Connected\n');
    
    console.log('Executing migration...');
    await pool.query(sql);
    console.log('✅ Migration completed successfully!\n');
    
    // Verify migration
    console.log('Verifying migration...');
    const policyTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'subsector_module_policy'
      )
    `);
    
    const instancesColumnsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'assessment_module_instances'
      AND column_name IN ('is_locked', 'attached_via')
    `);
    
    if (policyTableCheck.rows[0]?.exists) {
      console.log('✅ subsector_module_policy table exists');
    } else {
      console.log('❌ subsector_module_policy table not found');
    }
    
    if (instancesColumnsCheck.rows.length === 2) {
      console.log('✅ assessment_module_instances columns added (is_locked, attached_via)');
    } else {
      console.log(`⚠️  assessment_module_instances columns check: found ${instancesColumnsCheck.rows.length}/2 columns`);
      console.log('   Found:', instancesColumnsCheck.rows.map(r => r.column_name).join(', '));
    }
    
    console.log('\n✅ Migration verification complete!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration().catch(console.error);
