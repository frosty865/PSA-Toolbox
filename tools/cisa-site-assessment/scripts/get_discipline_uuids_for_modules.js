const { loadEnvLocal } = require('./lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('./lib/pg_tls');
const { Pool } = require('pg');

loadEnvLocal(process.cwd());

const rawUrl = process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL;
const connectionString = ensureNodePgTls(rawUrl) ?? rawUrl;

const pool = new Pool(
  applyNodeTls({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })
);

async function main() {
  const result = await pool.query(`
    SELECT 
      d.id as discipline_id, 
      d.code, 
      d.name,
      ds.id as subtype_id, 
      ds.code as subtype_code,
      ds.name as subtype_name
    FROM public.disciplines d 
    LEFT JOIN public.discipline_subtypes ds ON d.id = ds.discipline_id 
    WHERE d.code IN ('ACS', 'VSS', 'EMR', 'SMG') 
      AND d.is_active = true 
      AND (ds.is_active = true OR ds.id IS NULL) 
    ORDER BY d.code, ds.code
  `);

  const grouped = {};
  result.rows.forEach(row => {
    if (!grouped[row.code]) {
      grouped[row.code] = {
        discipline_id: row.discipline_id,
        discipline_name: row.name,
        subtypes: []
      };
    }
    if (row.subtype_id) {
      grouped[row.code].subtypes.push({
        id: row.subtype_id,
        code: row.subtype_code,
        name: row.subtype_name
      });
    }
  });

  console.log(JSON.stringify(grouped, null, 2));
  await pool.end();
}

main().catch(console.error);
