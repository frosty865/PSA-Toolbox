/**
 * Seed Baseline Spines to Local Database
 * 
 * This script seeds baseline_spines_runtime from the authoritative Supabase runtime database
 * into a local PostgreSQL database for development.
 * 
 * Usage:
 *   npx tsx tools/seed_baseline_spines_local.ts
 * 
 * Requirements:
 *   - SUPABASE_RUNTIME_URL and SUPABASE_RUNTIME_DB_PASSWORD must be set (source)
 *   - DATABASE_URL must point to local PostgreSQL (target)
 *   - baseline_spines_runtime table must exist in local database
 * 
 * This is idempotent: uses UPSERT by canon_id, so safe to run multiple times.
 */

import { Pool } from 'pg';
import { loadEnvLocal } from '../app/lib/db/load_env_local';
import { ensureNodePgTls } from '../app/lib/db/ensure_ssl';
import { applyNodeTls } from '../app/lib/db/pg_tls';

loadEnvLocal(process.cwd());

interface BaselineSpine {
  canon_id: string;
  discipline_code: string;
  subtype_code?: string | null;
  question_text: string;
  response_enum: ["YES", "NO", "N_A"];
  canon_version: string;
  canon_hash: string;
}

/**
 * Get source pool (authoritative Supabase runtime)
 */
function getSourcePool(): Pool {
  const runtimeUrl = process.env.SUPABASE_RUNTIME_URL;
  const runtimePassword = process.env.SUPABASE_RUNTIME_DB_PASSWORD;

  if (!runtimeUrl || !runtimePassword) {
    throw new Error(
      'SUPABASE_RUNTIME_URL and SUPABASE_RUNTIME_DB_PASSWORD must be set to seed from authoritative source'
    );
  }

  const runtimeDatabaseUrl = process.env.RUNTIME_DATABASE_URL;
  if (runtimeDatabaseUrl) {
    const url = new URL(runtimeDatabaseUrl);
    const password = url.password || runtimePassword;
    const rawUrl = runtimeDatabaseUrl.replace(/:[^:@]*@/, `:${encodeURIComponent(password)}@`);
    const connectionString = ensureNodePgTls(rawUrl) ?? rawUrl;
    return new Pool(
      applyNodeTls({
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 2,
      })
    );
  }

  const url = new URL(runtimeUrl);
  const projectRef = url.hostname.split('.')[0];
  const host = `db.${projectRef}.supabase.co`;
  const rawUrl = `postgresql://postgres:${encodeURIComponent(runtimePassword)}@${host}:6543/psa_runtime`;
  const connectionString = ensureNodePgTls(rawUrl) ?? rawUrl;
  return new Pool(
    applyNodeTls({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 2,
    })
  );
}

/**
 * Get target pool (local PostgreSQL)
 */
function getTargetPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL must be set to point to local PostgreSQL database for seeding'
    );
  }

  // Verify it's localhost
  try {
    const url = new URL(databaseUrl);
    const host = url.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1' && !host.includes('localhost')) {
      console.warn(`[WARNING] DATABASE_URL host is ${host}, expected localhost. Proceeding anyway...`);
    }
  } catch {
    // If parsing fails, proceed anyway
  }

  const connectionString = ensureNodePgTls(databaseUrl) ?? databaseUrl;
  return new Pool(
    applyNodeTls({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 2,
    })
  );
}

/**
 * Ensure baseline_spines_runtime table exists in target
 */
async function ensureTableExists(pool: Pool): Promise<void> {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS public.baseline_spines_runtime (
      canon_id TEXT PRIMARY KEY,
      discipline_code TEXT NOT NULL,
      subtype_code TEXT,
      question_text TEXT NOT NULL,
      response_enum JSONB NOT NULL DEFAULT '["YES","NO","N_A"]'::jsonb,
      canon_version TEXT NOT NULL,
      canon_hash TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_baseline_spines_runtime_active 
      ON public.baseline_spines_runtime(active) 
      WHERE active = true;

    CREATE INDEX IF NOT EXISTS idx_baseline_spines_runtime_discipline 
      ON public.baseline_spines_runtime(discipline_code);
  `;

  await pool.query(createTableQuery);
  console.log('[OK] Table baseline_spines_runtime exists or created');
}

/**
 * Load spines from source (authoritative Supabase runtime)
 */
async function loadSpinesFromSource(pool: Pool): Promise<BaselineSpine[]> {
  const query = `
    SELECT 
      canon_id,
      discipline_code,
      subtype_code,
      question_text,
      response_enum,
      canon_version,
      canon_hash
    FROM public.baseline_spines_runtime
    WHERE active = true
    ORDER BY discipline_code ASC, canon_id ASC
  `;

  const result = await pool.query(query);
  
  const spines: BaselineSpine[] = result.rows.map((row: any) => {
    let responseEnum = row.response_enum;
    if (typeof responseEnum === 'string') {
      try {
        responseEnum = JSON.parse(responseEnum);
      } catch {
        responseEnum = ["YES", "NO", "N_A"];
      }
    }
    if (!Array.isArray(responseEnum) || responseEnum.length !== 3) {
      responseEnum = ["YES", "NO", "N_A"];
    }

    return {
      canon_id: row.canon_id,
      discipline_code: row.discipline_code,
      subtype_code: row.subtype_code,
      question_text: row.question_text,
      response_enum: responseEnum as ["YES", "NO", "N_A"],
      canon_version: row.canon_version,
      canon_hash: row.canon_hash,
    };
  });

  return spines;
}

/**
 * Upsert spines into target (local database)
 */
async function upsertSpines(pool: Pool, spines: BaselineSpine[]): Promise<void> {
  const upsertQuery = `
    INSERT INTO public.baseline_spines_runtime (
      canon_id,
      discipline_code,
      subtype_code,
      question_text,
      response_enum,
      canon_version,
      canon_hash,
      active,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, now())
    ON CONFLICT (canon_id) DO UPDATE SET
      discipline_code = EXCLUDED.discipline_code,
      subtype_code = EXCLUDED.subtype_code,
      question_text = EXCLUDED.question_text,
      response_enum = EXCLUDED.response_enum,
      canon_version = EXCLUDED.canon_version,
      canon_hash = EXCLUDED.canon_hash,
      active = true,
      updated_at = now()
  `;

  let inserted = 0;
  let updated = 0;

  for (const spine of spines) {
    const result = await pool.query(upsertQuery, [
      spine.canon_id,
      spine.discipline_code,
      spine.subtype_code || null,
      spine.question_text,
      JSON.stringify(spine.response_enum),
      spine.canon_version,
      spine.canon_hash,
    ]);

    if (result.rowCount === 1) {
      // Check if it was insert or update by querying
      const checkResult = await pool.query(
        'SELECT created_at = updated_at as is_new FROM public.baseline_spines_runtime WHERE canon_id = $1',
        [spine.canon_id]
      );
      if (checkResult.rows[0]?.is_new) {
        inserted++;
      } else {
        updated++;
      }
    }
  }

  console.log(`[OK] Upserted ${spines.length} spines (${inserted} inserted, ${updated} updated)`);
}

/**
 * Main seeding function
 */
async function main() {
  console.log('[INFO] Starting baseline spines seeding from authoritative source...\n');

  const sourcePool = getSourcePool();
  const targetPool = getTargetPool();

  try {
    // Ensure table exists
    await ensureTableExists(targetPool);

    // Load from source
    console.log('[INFO] Loading spines from authoritative Supabase runtime database...');
    const spines = await loadSpinesFromSource(sourcePool);
    console.log(`[OK] Loaded ${spines.length} active spines from source`);

    if (spines.length === 0) {
      console.warn('[WARNING] No active spines found in source database');
      return;
    }

    // Upsert into target
    console.log('[INFO] Upserting spines into local database...');
    await upsertSpines(targetPool, spines);

    // Verify
    const verifyResult = await targetPool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN active = true THEN 1 ELSE 0 END) as active_true
      FROM public.baseline_spines_runtime
    `);
    const total = parseInt(verifyResult.rows[0]?.total || '0', 10);
    const activeTrue = parseInt(verifyResult.rows[0]?.active_true || '0', 10);

    console.log(`\n[OK] Seeding complete!`);
    console.log(`[INFO] Local database now has ${total} total spines, ${activeTrue} active`);

  } catch (error) {
    console.error('[ERROR] Seeding failed:', error);
    if (error instanceof Error) {
      console.error('[ERROR]', error.message);
      if (error.stack) {
        console.error('[ERROR]', error.stack);
      }
    }
    process.exit(1);
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('[FATAL]', error);
    process.exit(1);
  });
}

export { main as seedBaselineSpinesLocal };
