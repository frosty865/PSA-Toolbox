/**
 * Baseline Loader
 * 
 * Provides a unified loadBaseline() function that works in both server and client contexts.
 * 
 * - Server-side (API routes): Queries database directly (no HTTP overhead)
 * - Client-side: Uses HTTP fetch to Next.js API route
 * 
 * NOTE: Consolidated - no longer requires external psaback Flask server.
 */

import type { BaselineSpine } from './baselineClient';
import { ensureRuntimePoolConnected } from '@/app/lib/db/runtime_client';
import { getSubtypeInfo, getDisciplineName } from './taxonomy/subtype_guidance';

export type { BaselineSpine };

/**
 * Load baseline spines directly from database (server-side) or via API (client-side).
 * 
 * This is the authoritative source - no file-based fallbacks.
 * 
 * @param activeOnly - Only return active spines (default: true)
 * @returns Array of baseline spine objects
 * @throws Error if fetch/query fails or data is invalid
 */
export async function loadBaseline(activeOnly: boolean = true): Promise<BaselineSpine[]> {
  // In server-side context (API routes), query database directly
  // In client-side context, use HTTP fetch (handled by baselineClient)
  if (typeof window === 'undefined') {
    // Server-side: direct database query
    return loadBaselineFromDb(activeOnly);
  } else {
    // Client-side: HTTP fetch (import dynamically to avoid server-side issues)
    const { fetchBaselineSpines } = await import('./baselineClient');
    return fetchBaselineSpines(activeOnly);
  }
}

/**
 * Load baseline spines directly from database (server-side only).
 */
async function loadBaselineFromDb(activeOnly: boolean = true): Promise<BaselineSpine[]> {
  const pool = await ensureRuntimePoolConnected();
  
  const whereClause = activeOnly ? 'WHERE active = true' : '';
  const query = `
    SELECT 
      canon_id, 
      discipline_code, 
      subtype_code, 
      discipline_subtype_id,
      question_text, 
      response_enum, 
      canon_version, 
      canon_hash
    FROM baseline_spines_runtime
    ${whereClause}
    ORDER BY discipline_code ASC, canon_id ASC
  `;

  let result;
  try {
    result = await pool.query(query);
  } catch (queryError: unknown) {
    const err = queryError as { code?: string; message?: string };
    const errCode = err.code ?? '';
    const errMessage = err.message ?? '';
    
    // Check if table doesn't exist
    if (errCode === '42P01' || errMessage.includes('does not exist')) {
      throw new Error(
        `Baseline spines table (baseline_spines_runtime) does not exist. ` +
        `Query failed: ${errMessage}`
      );
    }
    
    // Check if it's a connection error
    if (
      errCode === 'ETIMEDOUT' ||
      errCode === 'ECONNREFUSED' ||
      errCode === 'ENOTFOUND' ||
      errCode === 'ECONNRESET' ||
      errMessage.includes('timeout') ||
      errMessage.includes('connect')
    ) {
      throw new Error(
        `Database connection failed while querying baseline_spines_runtime: ${errMessage} ` +
        `(code: ${errCode}). Check RUNTIME_DATABASE_URL and verify the runtime database is reachable.`
      );
    }
    
    // Re-throw other query errors with context
    throw new Error(
      `Failed to query baseline_spines_runtime: ${errMessage} (code: ${errCode})`
    );
  }
  
  const spines: BaselineSpine[] = result.rows.map((row: Record<string, unknown>) => {
    // response_enum is stored as jsonb; pg returns it as array or string
    let responseEnum = row.response_enum;
    if (typeof responseEnum === 'string') {
      try {
        responseEnum = JSON.parse(responseEnum);
      } catch (parseError) {
        console.warn(
          `[baselineLoader] Failed to parse response_enum for canon_id=${row.canon_id}, ` +
          `using fallback. Parse error: ${parseError instanceof Error ? parseError.message : parseError}`
        );
        responseEnum = ["YES", "NO", "N_A"]; // fallback
      }
    }
    
    // Ensure it's the correct format
    if (!Array.isArray(responseEnum) || responseEnum.length !== 3) {
      console.warn(
        `[baselineLoader] Invalid response_enum format for canon_id=${row.canon_id}, ` +
        `expected array of 3 elements, got: ${JSON.stringify(responseEnum)}`
      );
      responseEnum = ["YES", "NO", "N_A"];
    }

    // Attach subtype guidance and names from taxonomy at runtime
    const subtypeCode = typeof row.subtype_code === 'string' ? row.subtype_code : null;
    const subtypeInfo = subtypeCode ? getSubtypeInfo(subtypeCode) : null;
    const subtypeGuidance = subtypeInfo?.guidance || null;
    const subtypeName = subtypeInfo?.name || null;
    
    // Get discipline_name: from subtype info if available, otherwise look up by discipline_code
    let disciplineName = subtypeInfo?.discipline_name || null;
    const disciplineCode = typeof row.discipline_code === 'string' ? row.discipline_code : '';
    if (!disciplineName && disciplineCode) {
      disciplineName = getDisciplineName(disciplineCode);
    }

    return {
      canon_id: String(row.canon_id ?? ''),
      discipline_code: disciplineCode,
      subtype_code: subtypeCode,
      discipline_subtype_id: typeof row.discipline_subtype_id === 'string' ? row.discipline_subtype_id : null,
      question_text: String(row.question_text ?? ''),
      response_enum: responseEnum as ["YES", "NO", "N_A"],
      canon_version: String(row.canon_version ?? ''),
      canon_hash: String(row.canon_hash ?? ''),
      subtype_name: subtypeName,
      subtype_guidance: subtypeGuidance,
      // Add discipline_name for UI compatibility
      discipline_name: disciplineName,
      // Add discipline_subtype_name (same as subtype_name) for UI compatibility
      discipline_subtype_name: subtypeName,
    };
  });

  // Validate spines - provide context about whether table exists vs empty
  if (spines.length === 0) {
    // Check if table exists
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'baseline_spines_runtime'
        ) as exists
      `);
      const tableExists = tableCheck.rows[0]?.exists;
      
      if (!tableExists) {
        throw new Error(
          'Baseline spines table (baseline_spines_runtime) does not exist in database. ' +
          'Query returned empty result because table is missing.'
        );
      } else {
        throw new Error(
          `Baseline spines query returned empty - no ${activeOnly ? 'active' : ''} spines found. ` +
          'Table exists but contains no matching rows.'
        );
      }
    } catch (checkError: unknown) {
      const msg = checkError instanceof Error ? checkError.message : String(checkError);
      throw new Error(
        `Baseline spines query returned empty. ` +
        `Unable to verify table existence: ${msg}`
      );
    }
  }

  for (const s of spines) {
    if (!s.canon_id || !s.discipline_code || !s.question_text) {
      throw new Error(
        `Baseline spine missing required fields: canon_id=${s.canon_id}, discipline_code=${s.discipline_code}`
      );
    }
  }

  return spines;
}
