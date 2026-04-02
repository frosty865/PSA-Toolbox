/**
 * Run Runtime DB Reset Script
 * 
 * Executes the SQL commands from runtime_db_reset.sql using the runtime_client.
 * This ensures we're using the same connection logic as the app.
 * 
 * Usage:
 *   node tools/run_runtime_db_reset.ts
 */

import * as dotenv from 'dotenv';
import { ensureRuntimePoolConnected } from '../app/lib/db/runtime_client';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Clean up environment variables (remove leading/trailing whitespace and backslashes)
if (process.env.SUPABASE_RUNTIME_URL) {
  process.env.SUPABASE_RUNTIME_URL = process.env.SUPABASE_RUNTIME_URL.trim().replace(/^\\+|\/+$/, '');
}
if (process.env.SUPABASE_RUNTIME_DB_PASSWORD) {
  process.env.SUPABASE_RUNTIME_DB_PASSWORD = process.env.SUPABASE_RUNTIME_DB_PASSWORD.trim().replace(/^\\+|\/+$/, '');
}

const RESET_SQL = `
BEGIN;

-- runtime artifacts (safe to wipe)
-- These tables store runtime assessment data that can be regenerated

-- Assessment responses and related runtime data
TRUNCATE TABLE public.assessment_question_responses RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assessment_responses RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assessment_expansion_responses RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assessment_status RESTART IDENTITY CASCADE;

-- Assessment instances and related runtime artifacts
TRUNCATE TABLE public.assessment_question_universe RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assessment_expansion_profiles RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assessment_required_elements RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assessment_technology_profiles RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assessment_applied_ofcs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assessment_applied_vulnerabilities RESTART IDENTITY CASCADE;

-- Assessment definitions and instances (if you want to wipe assessments too)
-- UNCOMMENT THE NEXT TWO LINES IF YOU WANT TO WIPE ALL ASSESSMENTS:
-- TRUNCATE TABLE public.assessment_definitions RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE public.assessments RESTART IDENTITY CASCADE;

-- spine table is authoritative runtime content; wipe to guarantee clean reseed
TRUNCATE TABLE public.baseline_spines_runtime RESTART IDENTITY CASCADE;

COMMIT;
`;

async function main() {
  console.log('[INFO] Starting runtime DB reset...\n');
  console.log('[WARNING] This will delete all runtime assessment data!');
  console.log('[WARNING] Press Ctrl+C within 5 seconds to cancel...\n');

  // Give user a chance to cancel
  await new Promise(resolve => setTimeout(resolve, 5000));

  const pool = await ensureRuntimePoolConnected();

  try {
    // Pre-flight check: verify connection and get database info
    console.log('[INFO] Verifying database connection...');
    const preflightResult = await pool.query(`
      SELECT 
        current_database() as db,
        current_user as user,
        inet_server_addr() as addr,
        inet_server_port() as port
    `);
    const preflight = preflightResult.rows[0];
    console.log(`[OK] Connected to: db=${preflight.db} user=${preflight.user} addr=${preflight.addr || 'null'} port=${preflight.port || 'null'}`);

    // Execute reset SQL
    console.log('[INFO] Executing reset SQL...');
    await pool.query(RESET_SQL);
    console.log('[OK] Reset SQL executed successfully');

    // Post-reset verification: check baseline_spines_runtime is empty
    console.log('[INFO] Verifying reset...');
    const verifyResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN active = true THEN 1 ELSE 0 END) as active_true
      FROM public.baseline_spines_runtime
    `);
    const total = parseInt(verifyResult.rows[0]?.total || '0', 10);
    const activeTrue = parseInt(verifyResult.rows[0]?.active_true || '0', 10);
    
    console.log(`[OK] Verification: baseline_spines_runtime has ${total} total rows, ${activeTrue} active`);
    
    if (total > 0) {
      console.warn(`[WARNING] baseline_spines_runtime still has ${total} rows after reset. This may be expected if the table was not truncated.`);
    } else {
      console.log('[OK] baseline_spines_runtime is empty (expected after reset)');
    }

    console.log('\n[OK] Runtime DB reset complete!');
    console.log('[INFO] All runtime tables have been truncated.');
    console.log('[INFO] Run seed_baseline_spines.ts to repopulate baseline_spines_runtime.');
  } catch (error) {
    console.error('[ERROR] Reset failed:', error);
    if (error instanceof Error) {
      console.error('[ERROR]', error.message);
      if (error.stack) {
        console.error('[ERROR]', error.stack);
      }
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('[FATAL]', error);
    process.exit(1);
  });
}

export { main as runRuntimeDbReset };
