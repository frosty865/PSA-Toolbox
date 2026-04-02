#!/usr/bin/env node
/**
 * Check Module Policy Setup
 * 
 * Shows available modules and subsectors for policy configuration.
 */

const { loadEnvLocal } = require('./lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('./lib/pg_tls');
const { Pool } = require('pg');

loadEnvLocal(process.cwd());

async function checkSetup() {
  console.log('\n=== Checking Module Policy Setup ===\n');
  let connectionString = process.env.RUNTIME_DATABASE_URL;
  if (!connectionString) {
    if (process.env.DATABASE_URL) {
      connectionString = process.env.DATABASE_URL;
    } else {
      const runtimeUrl = process.env.SUPABASE_RUNTIME_URL;
      const runtimePassword = process.env.SUPABASE_RUNTIME_DB_PASSWORD || process.env.DATABASE_PASSWORD;
      if (!runtimeUrl || !runtimePassword) {
        console.error('❌ RUNTIME env vars not set');
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
    
    // Check modules
    console.log('=== Available Modules ===');
    const modules = await pool.query(`
      SELECT module_code, module_name, description, is_active
      FROM public.assessment_modules
      ORDER BY module_code
    `);
    
    if (modules.rows.length === 0) {
      console.log('⚠️  No modules found. Create modules first using the Admin module builder.');
    } else {
      console.log(`Found ${modules.rows.length} module(s):\n`);
      modules.rows.forEach((m, idx) => {
        console.log(`  ${idx + 1}. ${m.module_code}`);
        console.log(`     Name: ${m.module_name || 'N/A'}`);
        console.log(`     Active: ${m.is_active ? '✅' : '❌'}`);
        if (m.description) {
          console.log(`     Description: ${m.description.substring(0, 60)}${m.description.length > 60 ? '...' : ''}`);
        }
        console.log('');
      });
    }
    
    // Check subsectors
    console.log('\n=== Available Subsectors ===');
    const subsectors = await pool.query(`
      SELECT id, name, sector_id
      FROM public.subsectors
      ORDER BY name
      LIMIT 20
    `);
    
    if (subsectors.rows.length === 0) {
      console.log('⚠️  No subsectors found.');
    } else {
      console.log(`Found ${subsectors.rows.length} subsector(s) (showing first 20):\n`);
      subsectors.rows.forEach((s, idx) => {
        console.log(`  ${idx + 1}. ${s.name}`);
        console.log(`     ID: ${s.id}`);
        console.log('');
      });
    }
    
    // Check existing policies
    console.log('\n=== Existing Policies ===');
    const policies = await pool.query(`
      SELECT 
        smp.id,
        smp.subsector_id,
        s.name as subsector_name,
        smp.module_code,
        am.module_name,
        smp.attach_mode,
        smp.created_at
      FROM public.subsector_module_policy smp
      LEFT JOIN public.subsectors s ON s.id = smp.subsector_id
      LEFT JOIN public.assessment_modules am ON am.module_code = smp.module_code
      ORDER BY smp.created_at DESC
    `);
    
    if (policies.rows.length === 0) {
      console.log('⚠️  No policy rules configured yet.');
      console.log('\nTo create a policy, run SQL like:');
      console.log(`
INSERT INTO public.subsector_module_policy (subsector_id, module_code, attach_mode)
VALUES ('subsector_id_here', 'MODULE_CODE_HERE', 'REQUIRED');
      `);
    } else {
      console.log(`Found ${policies.rows.length} policy rule(s):\n`);
      policies.rows.forEach((p, idx) => {
        console.log(`  ${idx + 1}. ${p.subsector_name || p.subsector_id}`);
        console.log(`     Module: ${p.module_code} (${p.module_name || 'N/A'})`);
        console.log(`     Mode: ${p.attach_mode}`);
        console.log(`     Created: ${p.created_at}`);
        console.log('');
      });
    }
    
    console.log('\n✅ Setup check complete!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkSetup().catch(console.error);
