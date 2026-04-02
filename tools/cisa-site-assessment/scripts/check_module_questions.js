/**
 * Diagnostic script to check what questions are stored for a module
 */

const { loadEnvLocal } = require('./lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('./lib/pg_tls');
const { Pool } = require('pg');

loadEnvLocal(process.cwd());

async function checkModuleQuestions(moduleCode) {
  let connectionString = process.env.RUNTIME_DATABASE_URL;
  if (!connectionString && process.env.DATABASE_URL) {
    connectionString = process.env.DATABASE_URL;
  } else if (!connectionString) {
    const runtimeUrl = process.env.SUPABASE_RUNTIME_URL;
    const runtimePassword = process.env.SUPABASE_RUNTIME_DB_PASSWORD || process.env.DATABASE_PASSWORD;
    if (!runtimeUrl || !runtimePassword) {
      console.error('❌ RUNTIME env vars not set');
      return;
    }
    const url = new URL(runtimeUrl);
    const hostname = url.hostname.replace('.supabase.co', '');
    connectionString = `postgresql://postgres:${encodeURIComponent(runtimePassword)}@db.${hostname}.supabase.co:6543/psa_runtime`;
  }
  const normalizedUrl = ensureNodePgTls(connectionString) ?? connectionString;
  const pool = new Pool(
    applyNodeTls({
      connectionString: normalizedUrl,
      ssl: { rejectUnauthorized: false },
    })
  );
  
  try {
    // Check module exists
    const moduleCheck = await pool.query(
      `SELECT module_code, module_name FROM public.assessment_modules WHERE module_code = $1`,
      [moduleCode]
    );
    
    if (moduleCheck.rowCount === 0) {
      console.log(`❌ Module ${moduleCode} not found`);
      return;
    }
    
    console.log(`✅ Module found: ${moduleCheck.rows[0].module_name}`);
    
    // Check stored questions
    const questions = await pool.query(
      `
      SELECT 
        amq.question_canon_id,
        amq.question_order,
        bs.question_text,
        bs.discipline_code,
        bs.subtype_code,
        bs.active
      FROM public.assessment_module_questions amq
      LEFT JOIN public.baseline_spines_runtime bs 
        ON amq.question_canon_id = bs.canon_id
      WHERE amq.module_code = $1
      ORDER BY amq.question_order ASC
      `,
      [moduleCode]
    );
    
    console.log(`\n📋 Questions stored in database (${questions.rowCount}):`);
    questions.rows.forEach((q, idx) => {
      console.log(`\n${idx + 1}. ${q.question_canon_id}`);
      console.log(`   Order: ${q.question_order}`);
      if (q.question_text) {
        console.log(`   Text: ${q.question_text.substring(0, 80)}...`);
      } else {
        console.log(`   ⚠️  Question not found in baseline_spines_runtime`);
      }
      console.log(`   Discipline: ${q.discipline_code || 'N/A'}`);
      console.log(`   Subtype: ${q.subtype_code || 'N/A'}`);
      console.log(`   Active: ${q.active !== false ? 'Yes' : 'No'}`);
    });
    
    // Check for missing questions
    const missing = questions.rows.filter(q => !q.question_text || q.active === false);
    if (missing.length > 0) {
      console.log(`\n⚠️  ${missing.length} question(s) not found or inactive in baseline_spines_runtime:`);
      missing.forEach(q => {
        console.log(`   - ${q.question_canon_id}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

const moduleCode = process.argv[2] || 'MODULE_EV_CHARGING';
console.log(`Checking questions for module: ${moduleCode}\n`);
checkModuleQuestions(moduleCode);
