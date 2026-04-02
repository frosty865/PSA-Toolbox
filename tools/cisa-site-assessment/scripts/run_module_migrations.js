#!/usr/bin/env node
/**
 * Run Module Migrations (in order)
 * 
 * 1. Creates assessment_modules, assessment_module_questions, assessment_module_instances
 * 2. Creates subsector_module_policy and extends assessment_module_instances
 */

const { loadEnvLocal } = require('./lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('./lib/pg_tls');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

loadEnvLocal(process.cwd());

async function runMigrationFile(pool, migrationFile, description) {
  console.log(`\n=== ${description} ===`);
  
  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ Migration file not found: ${migrationFile}`);
    return false;
  }
  
  const sql = fs.readFileSync(migrationFile, 'utf-8');
  console.log(`Reading: ${path.basename(migrationFile)}`);
  console.log(`Size: ${sql.length} characters`);
  
  try {
    await pool.query(sql);
    console.log('✅ Migration completed successfully!');
    return true;
  } catch (error) {
    if (error.code === '42P01' && error.message.includes('does not exist')) {
      console.error(`❌ Migration failed: Table does not exist`);
      console.error(`   This migration requires tables from a previous migration`);
      console.error(`   Error: ${error.message}`);
    } else if (error.code === '42710' || error.message.includes('already exists')) {
      console.log('⚠️  Migration skipped: Objects already exist');
      return true; // Not a fatal error
    } else {
      console.error(`❌ Migration failed: ${error.message}`);
      if (error.code) console.error(`   Error code: ${error.code}`);
      if (error.detail) console.error(`   Detail: ${error.detail}`);
    }
    return false;
  }
}

async function main() {
  console.log('\n=== Running Module Migrations ===\n');
  
  // Get connection string
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
    
    const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
    
    // Migration 1: Create assessment_modules tables
    const migration1 = path.join(migrationsDir, '20260121_create_assessment_modules.sql');
    const success1 = await runMigrationFile(
      pool,
      migration1,
      'Migration 1: Create Assessment Modules Tables'
    );
    
    if (!success1) {
      console.error('\n❌ Migration 1 failed. Cannot continue.');
      process.exit(1);
    }
    
    // Migration 2: Create subsector_module_policy and extend instances
    const migration2 = path.join(migrationsDir, '20260121_subsector_module_policy_and_instance_locking.sql');
    const success2 = await runMigrationFile(
      pool,
      migration2,
      'Migration 2: Create Subsector Module Policy and Instance Locking'
    );
    
    if (!success2) {
      console.error('\n❌ Migration 2 failed.');
      process.exit(1);
    }
    
    // Migration 3: Create module-curated OFCs tables
    const migration3 = path.join(migrationsDir, '20260121_module_curated_ofcs.sql');
    const success3 = await runMigrationFile(
      pool,
      migration3,
      'Migration 3: Create Module-Curated OFCs Tables'
    );
    
    if (!success3) {
      console.error('\n❌ Migration 3 failed.');
      process.exit(1);
    }
    
    // Migration 4: Create module baseline references table
    const migration4 = path.join(migrationsDir, '20260121_module_baseline_references.sql');
    const success4 = await runMigrationFile(
      pool,
      migration4,
      'Migration 4: Create Module Baseline References Table'
    );
    
    if (!success4) {
      console.error('\n❌ Migration 4 failed.');
      process.exit(1);
    }
    
    // Migration 5: Create module questions and risk drivers tables
    const migration5a = path.join(migrationsDir, '20260121_module_questions_intent.sql');
    const success5a = await runMigrationFile(
      pool,
      migration5a,
      'Migration 5a: Create Module Questions Table'
    );
    
    if (!success5a) {
      console.error('\n❌ Migration 5a failed.');
      process.exit(1);
    }
    
    const migration5b = path.join(migrationsDir, '20260121_module_risk_drivers.sql');
    const success5b = await runMigrationFile(
      pool,
      migration5b,
      'Migration 5b: Create Module Risk Drivers Table'
    );
    
    if (!success5b) {
      console.error('\n❌ Migration 5b failed.');
      process.exit(1);
    }
    
    // Verify migrations
    console.log('\n=== Verifying Migrations ===');
    
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('assessment_modules', 'assessment_module_questions', 'assessment_module_instances', 'subsector_module_policy', 'module_curated_ofcs', 'module_curated_ofc_sources', 'module_baseline_references', 'module_questions', 'module_risk_drivers')
      ORDER BY table_name
    `);
    
    console.log(`\nTables created: ${tablesCheck.rows.length}/9`);
    tablesCheck.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });
    
    const columnsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'assessment_module_instances'
      AND column_name IN ('is_locked', 'attached_via')
    `);
    
    console.log(`\nExtended columns: ${columnsCheck.rows.length}/2`);
    columnsCheck.rows.forEach(row => {
      console.log(`  ✅ ${row.column_name}`);
    });
    
    console.log('\n✅ All migrations completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
