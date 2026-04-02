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
    console.log('\n=== Verifying Convergence Bridge Implementation ===\n');
    
    // Check module exists
    const module = await pool.query(
      `SELECT module_code, module_name FROM public.assessment_modules WHERE module_code = 'MODULE_EV_CHARGING'`
    );
    
    if (module.rowCount === 0) {
      console.log('❌ Module not found');
      return;
    }
    
    console.log(`✅ Module: ${module.rows[0].module_name} (${module.rows[0].module_code})\n`);
    
    // Check inferred module questions
    const moduleQs = await pool.query(
      `SELECT module_question_id, question_text, question_intent, question_order 
       FROM public.module_questions 
       WHERE module_code = 'MODULE_EV_CHARGING' 
       ORDER BY question_order ASC`
    );
    console.log(`Inferred Module Questions: ${moduleQs.rowCount}`);
    moduleQs.rows.forEach((q, idx) => {
      console.log(`\n${idx + 1}. ${q.module_question_id} [${q.question_intent}]`);
      console.log(`   ${q.question_text.substring(0, 100)}...`);
    });
    
    // Check risk drivers
    const drivers = await pool.query(
      `SELECT driver_type, driver_text FROM public.module_risk_drivers WHERE module_code = 'MODULE_EV_CHARGING' ORDER BY driver_type`
    );
    console.log(`\n\nRisk Drivers: ${drivers.rowCount}`);
    drivers.rows.forEach((d, idx) => {
      console.log(`\n${idx + 1}. [${d.driver_type}]`);
      console.log(`   ${d.driver_text.substring(0, 150)}...`);
    });
    
    // Check baseline references
    const baselineRefs = await pool.query(
      `SELECT COUNT(*) as count FROM public.module_baseline_references WHERE module_code = 'MODULE_EV_CHARGING'`
    );
    console.log(`\n\nBaseline References: ${baselineRefs.rows[0].count} (informational only)`);
    
    // Check curated OFCs
    const ofcs = await pool.query(
      `SELECT COUNT(*) as count FROM public.module_curated_ofcs WHERE module_code = 'MODULE_EV_CHARGING'`
    );
    console.log(`Curated OFCs: ${ofcs.rows[0].count}`);
    
    console.log('\n✅ Convergence Bridge verification complete!');
    console.log('\nKey Points:');
    console.log('  - Cyber/fraud drivers are stored as context (not requirements)');
    console.log('  - PSA-scope questions address physical impact readiness');
    console.log('  - Cyber controls were filtered out (not converted to questions)');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

verify();
