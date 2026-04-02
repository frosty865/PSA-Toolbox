const { loadEnvLocal } = require('./lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('./lib/pg_tls');
const { Pool } = require('pg');

loadEnvLocal(process.cwd());

async function verify() {
  let rawUrl = process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL;
  if (!rawUrl) {
    const runtimeUrl = process.env.SUPABASE_RUNTIME_URL;
    const runtimePassword = process.env.SUPABASE_RUNTIME_DB_PASSWORD || process.env.DATABASE_PASSWORD;
    if (!runtimeUrl || !runtimePassword) {
      console.error('❌ RUNTIME env vars not set');
      return;
    }
    const url = new URL(runtimeUrl);
    const hostname = url.hostname.replace('.supabase.co', '');
    rawUrl = `postgresql://postgres:${encodeURIComponent(runtimePassword)}@db.${hostname}.supabase.co:6543/psa_runtime`;
  }
  const connectionString = ensureNodePgTls(rawUrl) ?? rawUrl;
  const pool = new Pool(
    applyNodeTls({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  );
  
  try {
    console.log('\n=== Verifying Module Import ===\n');
    
    // Check module exists
    const module = await pool.query(
      `SELECT module_code, module_name FROM public.assessment_modules WHERE module_code = 'MODULE_EV_CHARGING'`
    );
    
    if (module.rowCount === 0) {
      console.log('❌ Module not found');
      return;
    }
    
    console.log(`✅ Module: ${module.rows[0].module_name} (${module.rows[0].module_code})\n`);
    
    // Check module questions (should be 0)
    const questions = await pool.query(
      `SELECT COUNT(*) as count FROM public.assessment_module_questions WHERE module_code = 'MODULE_EV_CHARGING'`
    );
    console.log(`Module Questions: ${questions.rows[0].count} (should be 0)`);
    
    // Check baseline references (should be 5)
    const baselineRefs = await pool.query(
      `SELECT COUNT(*) as count FROM public.module_baseline_references WHERE module_code = 'MODULE_EV_CHARGING'`
    );
    console.log(`Baseline References: ${baselineRefs.rows[0].count} (should be 5)`);
    
    // Show baseline references
    const refs = await pool.query(
      `SELECT baseline_canon_id, note FROM public.module_baseline_references WHERE module_code = 'MODULE_EV_CHARGING' ORDER BY baseline_canon_id`
    );
    console.log('\nBaseline References:');
    refs.rows.forEach((ref, idx) => {
      console.log(`  ${idx + 1}. ${ref.baseline_canon_id}`);
      if (ref.note) console.log(`     Note: ${ref.note}`);
    });
    
    // Check curated OFCs (should be 15)
    const ofcs = await pool.query(
      `SELECT COUNT(*) as count FROM public.module_curated_ofcs WHERE module_code = 'MODULE_EV_CHARGING'`
    );
    console.log(`\nCurated OFCs: ${ofcs.rows[0].count} (should be 15)`);
    
    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

verify();
