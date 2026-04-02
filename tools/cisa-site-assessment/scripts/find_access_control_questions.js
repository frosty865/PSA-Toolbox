const { loadEnvLocal } = require('./lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('./lib/pg_tls');
const { Pool } = require('pg');

loadEnvLocal(process.cwd());

async function findQuestions() {
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
    const result = await pool.query(`
      SELECT canon_id, question_text, discipline_code, subtype_code
      FROM public.baseline_spines_runtime 
      WHERE active = true 
        AND (
          question_text ILIKE '%access%' 
          OR question_text ILIKE '%entry%' 
          OR question_text ILIKE '%perimeter%' 
          OR question_text ILIKE '%barrier%'
          OR question_text ILIKE '%lighting%'
          OR question_text ILIKE '%monitor%'
          OR question_text ILIKE '%surveillance%'
          OR question_text ILIKE '%control%'
        )
      ORDER BY discipline_code, canon_id
      LIMIT 50
    `);
    
    console.log(`Found ${result.rows.length} relevant questions:\n`);
    result.rows.forEach((q, idx) => {
      console.log(`${idx + 1}. ${q.canon_id}`);
      console.log(`   ${q.question_text}`);
      console.log(`   Discipline: ${q.discipline_code}${q.subtype_code ? `, Subtype: ${q.subtype_code}` : ''}\n`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

findQuestions();
