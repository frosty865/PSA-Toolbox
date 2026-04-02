/**
 * Seed Baseline Spines to Runtime Database
 * 
 * This script seeds baseline_spines_runtime from a canonical JSON export.
 * It uses the same runtime_client as the app, ensuring it targets the same DB.
 * 
 * Usage:
 *   BASELINE_SPINES_JSON_PATH=/path/to/baseline_spines.json node tools/seed_baseline_spines.ts
 * 
 * Requirements:
 *   - BASELINE_SPINES_JSON_PATH must be set (absolute or repo-relative path)
 *   - SUPABASE_RUNTIME_URL and SUPABASE_RUNTIME_DB_PASSWORD must be set (or USE_DATABASE_URL=true)
 *   - baseline_spines_runtime table must exist in runtime database
 * 
 * This is idempotent: uses UPSERT by canon_id, so safe to run multiple times.
 * 
 * Expected JSON shape: array of objects containing at minimum:
 *   - canon_id (string)
 *   - discipline_code (string)
 *   - subtype_code (string, optional)
 *   - question_text (string)
 *   - response_enum (array ["YES","NO","N_A"] or stringified)
 *   - active (boolean, default true)
 *   - canon_hash (string, optional)
 *   - canon_version (string, optional)
 */

import * as dotenv from 'dotenv';
import { ensureRuntimePoolConnected } from '../app/lib/db/runtime_client';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Clean up environment variables
if (process.env.SUPABASE_RUNTIME_URL) {
  process.env.SUPABASE_RUNTIME_URL = process.env.SUPABASE_RUNTIME_URL.trim().replace(/^\\+|\/+$/, '');
}
if (process.env.SUPABASE_RUNTIME_DB_PASSWORD) {
  process.env.SUPABASE_RUNTIME_DB_PASSWORD = process.env.SUPABASE_RUNTIME_DB_PASSWORD.trim().replace(/^\\+|\/+$/, '');
}

interface BaselineSpineInput {
  canon_id: string;
  discipline_code: string;
  subtype_code?: string | null;
  question_text: string;
  response_enum: ["YES", "NO", "N_A"] | string;
  active?: boolean;
  canon_hash?: string;
  canon_version?: string;
}

/**
 * Load JSON file from path (absolute or repo-relative)
 */
function loadJsonFile(filePath: string): BaselineSpineInput[] {
  // Resolve path (handles absolute and relative)
  const resolvedPath = path.isAbsolute(filePath) 
    ? filePath 
    : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Baseline spines JSON file not found: ${resolvedPath}`);
  }

  const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
  let data: any;

  try {
    data = JSON.parse(fileContent);
  } catch (parseError) {
    throw new Error(`Failed to parse JSON file ${resolvedPath}: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
  }

  // Handle both array format and object with "spines" property
  let spines: BaselineSpineInput[];
  if (Array.isArray(data)) {
    spines = data;
  } else if (data && typeof data === 'object' && Array.isArray(data.spines)) {
    spines = data.spines;
  } else {
    throw new Error(`Expected JSON file to contain an array or object with "spines" array, got ${typeof data}`);
  }

  return spines;
}

/**
 * Normalize response_enum to array format
 */
function normalizeResponseEnum(responseEnum: any): ["YES", "NO", "N_A"] {
  if (Array.isArray(responseEnum)) {
    if (responseEnum.length === 3 && 
        responseEnum.includes('YES') && 
        responseEnum.includes('NO') && 
        responseEnum.includes('N_A')) {
      return responseEnum as ["YES", "NO", "N_A"];
    }
  }
  
  if (typeof responseEnum === 'string') {
    try {
      const parsed = JSON.parse(responseEnum);
      if (Array.isArray(parsed) && parsed.length === 3) {
        return parsed as ["YES", "NO", "N_A"];
      }
    } catch {
      // Fall through to default
    }
  }

  // Default fallback
  return ["YES", "NO", "N_A"];
}

/**
 * Upsert spines into baseline_spines_runtime
 */
async function upsertSpines(pool: any, spines: BaselineSpineInput[]): Promise<void> {
  const upsertQuery = `
    INSERT INTO public.baseline_spines_runtime (
      canon_id,
      discipline_code,
      subtype_code,
      question_text,
      response_enum,
      active,
      canon_hash,
      canon_version,
      loaded_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
    ON CONFLICT (canon_id) DO UPDATE SET
      discipline_code = EXCLUDED.discipline_code,
      subtype_code = EXCLUDED.subtype_code,
      question_text = EXCLUDED.question_text,
      response_enum = EXCLUDED.response_enum,
      active = EXCLUDED.active,
      canon_hash = COALESCE(EXCLUDED.canon_hash, baseline_spines_runtime.canon_hash),
      canon_version = COALESCE(EXCLUDED.canon_version, baseline_spines_runtime.canon_version),
      loaded_at = now()
  `;

  let inserted = 0;
  let updated = 0;

  for (const spine of spines) {
    // Validate required fields
    if (!spine.canon_id || !spine.discipline_code || !spine.question_text) {
      console.warn(`[WARNING] Skipping spine with missing required fields:`, spine);
      continue;
    }

    const responseEnum = normalizeResponseEnum(spine.response_enum);
    const active = spine.active !== undefined ? spine.active : true;
    
    // Generate defaults for canon_version and canon_hash if not provided
    // Use a simple hash of canon_id + question_text for canon_hash if missing
    const canonVersion = spine.canon_version || 'v1';
    const canonHash = spine.canon_hash || 
      Buffer.from(`${spine.canon_id}:${spine.question_text}`).toString('base64').substring(0, 32);

    const result = await pool.query(upsertQuery, [
      spine.canon_id,
      spine.discipline_code,
      spine.subtype_code || null,
      spine.question_text,
      JSON.stringify(responseEnum),
      active,
      canonHash,
      canonVersion,
    ]);

    // Check if it was insert or update by checking if row was just inserted
    // Since we don't have created_at, we'll assume it's an insert if rowCount is 1
    // A more accurate check would require a separate query, but this is simpler
    if (result.rowCount === 1) {
      // Try to determine if it was insert vs update by checking loaded_at
      // This is approximate - we'll count all as inserts for simplicity
      inserted++;
    }
  }

  // Note: We can't accurately distinguish inserts from updates without created_at
  // So we'll just report total upserted
  console.log(`[OK] Upserted ${spines.length} spines`);
}

/**
 * Main seeding function
 */
async function main() {
  console.log('[INFO] Starting baseline spines seeding...\n');

  // Check for required environment variable
  const jsonPath = process.env.BASELINE_SPINES_JSON_PATH;
  if (!jsonPath) {
    console.error('[ERROR] BASELINE_SPINES_JSON_PATH environment variable must be set.');
    console.error('[ERROR] Example: BASELINE_SPINES_JSON_PATH=/path/to/baseline_spines.json node tools/seed_baseline_spines.ts');
    process.exit(1);
  }

  const pool = await ensureRuntimePoolConnected();

  try {
    // Load JSON file
    console.log(`[INFO] Loading spines from: ${jsonPath}`);
    const spines = loadJsonFile(jsonPath);
    console.log(`[OK] Loaded ${spines.length} spines from JSON file`);

    if (spines.length === 0) {
      console.error('[ERROR] JSON file contains no spines');
      process.exit(1);
    }

    // Upsert into runtime database
    console.log('[INFO] Upserting spines into runtime database...');
    await upsertSpines(pool, spines);

    // Verify counts
    const verifyResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN active = true THEN 1 ELSE 0 END) as active_true
      FROM public.baseline_spines_runtime
    `);
    const total = parseInt(verifyResult.rows[0]?.total || '0', 10);
    const activeTrue = parseInt(verifyResult.rows[0]?.active_true || '0', 10);

    console.log(`\n[OK] Seeding complete!`);
    console.log(`[INFO] Runtime database now has ${total} total spines, ${activeTrue} active`);

    // Hard fail if active_true == 0
    if (activeTrue === 0) {
      console.error('[ERROR] No active spines found after seeding (active_true == 0)');
      process.exit(1);
    }

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

export { main as seedBaselineSpines };
