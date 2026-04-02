const { loadEnvLocal } = require('./lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('./lib/pg_tls');
const { Pool } = require('pg');

loadEnvLocal(process.cwd());

async function verify() {
  const rawUrl = process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL;
  const connectionString = ensureNodePgTls(rawUrl) ?? rawUrl;
  const pool = new Pool(
    applyNodeTls({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  );
  
  try {
    const questions = await pool.query(
      'SELECT COUNT(*) as count FROM public.module_questions WHERE module_code = $1',
      ['MODULE_EV_CHARGING']
    );
    console.log('Module Questions:', questions.rows[0].count);
    
    const ofcs = await pool.query(
      'SELECT COUNT(*) as count FROM public.module_ofcs WHERE module_code = $1',
      ['MODULE_EV_CHARGING']
    );
    console.log('Module OFCs:', ofcs.rows[0].count);
    
    const batches = await pool.query(
      'SELECT COUNT(*) as count FROM public.module_import_batches WHERE module_code = $1',
      ['MODULE_EV_CHARGING']
    );
    console.log('Import Batches:', batches.rows[0].count);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

verify();
