#!/usr/bin/env node
/**
 * Get sample question canon_ids for module import
 */

const { loadEnvLocal } = require('./lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('./lib/pg_tls');
const { Pool } = require('pg');

loadEnvLocal(process.cwd());

async function main() {
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
    // Get some sample questions (you can filter by discipline_code if needed)
    const result = await pool.query(`
      SELECT canon_id, discipline_code, subtype_code, question_text
      FROM public.baseline_spines_runtime
      WHERE active = true
      ORDER BY discipline_code, canon_id
      LIMIT 20
    `);
    
    console.log('\n=== Sample Question Canon IDs ===\n');
    result.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.canon_id}`);
      console.log(`   Discipline: ${row.discipline_code}`);
      if (row.subtype_code) {
        console.log(`   Subtype: ${row.subtype_code}`);
      }
      console.log(`   Text: ${row.question_text.substring(0, 80)}${row.question_text.length > 80 ? '...' : ''}`);
      console.log('');
    });
    
    console.log('\n=== Canon IDs Array (for copy-paste) ===\n');
    const canonIds = result.rows.map(r => `"${r.canon_id}"`).join(',\n  ');
    console.log(`[\n  ${canonIds}\n]`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
