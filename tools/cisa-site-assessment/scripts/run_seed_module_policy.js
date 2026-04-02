#!/usr/bin/env node
/**
 * Run Subsector Module Policy Seed Migration
 * 
 * Seeds example policy rows using lookup (no hardcoded UUIDs).
 */

const { loadEnvLocal } = require('./lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('./lib/pg_tls');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

loadEnvLocal(process.cwd());

async function runSeed() {
  console.log('\n=== Running Subsector Module Policy Seed ===\n');
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
  const seedFile = path.join(__dirname, '..', 'db', 'migrations', '20260121_seed_subsector_module_policy_examples.sql');
  if (!fs.existsSync(seedFile)) {
    console.error(`❌ Seed file not found: ${seedFile}`);
    process.exit(1);
  }
  const sql = fs.readFileSync(seedFile, 'utf-8');
  console.log(`Reading seed file: ${path.basename(seedFile)}`);
  console.log(`Size: ${sql.length} characters\n`);
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
    
    console.log('Executing seed migration...');
    await pool.query(sql);
    console.log('✅ Seed migration completed successfully!\n');
    
    // Verify seed data
    console.log('Verifying seed data...');
    
    const policyCount = await pool.query(`
      SELECT COUNT(*) as count 
      FROM public.subsector_module_policy
    `);
    
    console.log(`Policy rows created: ${policyCount.rows[0].count}`);
    
    if (parseInt(policyCount.rows[0].count) > 0) {
      const policies = await pool.query(`
        SELECT 
          smp.id,
          smp.subsector_id,
          s.name as subsector_name,
          smp.module_code,
          am.module_name,
          smp.attach_mode
        FROM public.subsector_module_policy smp
        LEFT JOIN public.subsectors s ON s.id = smp.subsector_id
        LEFT JOIN public.assessment_modules am ON am.module_code = smp.module_code
        ORDER BY smp.created_at DESC
      `);
      
      console.log('\nPolicy details:');
      policies.rows.forEach((row, idx) => {
        console.log(`\n  ${idx + 1}. ${row.subsector_name || row.subsector_id}`);
        console.log(`     Module: ${row.module_code} (${row.module_name || 'N/A'})`);
        console.log(`     Mode: ${row.attach_mode}`);
      });
    } else {
      console.log('\n⚠️  No policy rows were created.');
      console.log('   This may be expected if:');
      console.log('   - The module_code in the seed does not exist');
      console.log('   - The subsector names do not match');
      console.log('   - The seed uses conditional logic that skipped insertion');
    }
    
    console.log('\n✅ Seed verification complete!');
    
  } catch (error) {
    console.error('\n❌ Seed migration failed:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    if (error.position) {
      console.error('   Position:', error.position);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSeed().catch(console.error);
