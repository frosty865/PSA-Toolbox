import { NextRequest, NextResponse } from 'next/server';
import { ensureRuntimePoolConnected } from '@/app/lib/db/runtime_client';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/health
 * 
 * Diagnostic endpoint that shows:
 * - Server time
 * - Database connection info (current_database, current_user, host, port)
 * - Schema checks (baseline_spines_runtime exists, row counts)
 * 
 * Use this to verify you're connected to the correct database and that
 * baseline_spines_runtime table exists with active rows.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js route signature
export async function GET(request: NextRequest) {
  try {
    const pool = await ensureRuntimePoolConnected();
    const serverTime = new Date().toISOString();

    // Get database connection info
    const dbInfoResult = await pool.query(`
      SELECT 
        current_database() as db,
        current_user as user
    `);
    const dbInfo = dbInfoResult.rows[0];

    // Get server address/port
    const hostResult = await pool.query(`
      SELECT 
        inet_server_addr() as addr,
        inet_server_port() as port
    `);
    const hostInfo = hostResult.rows[0];

    // Check if baseline_spines_runtime table exists
    let tableExists = false;
    let totalCount = 0;
    let activeTrueCount = 0;
    let subtypeAnchoredCount = 0;
    let sample: Record<string, unknown>[] = [];
    let schemaError: string | null = null;

    try {
      const existsResult = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'baseline_spines_runtime'
        ) as exists
      `);
      tableExists = existsResult.rows[0]?.exists || false;

      if (tableExists) {
        // Get row counts including subtype-anchored count
        const countsResult = await pool.query(`
          SELECT
            COUNT(*)::text as total,
            SUM(CASE WHEN active = true THEN 1 ELSE 0 END)::text as active_true,
            SUM(CASE WHEN active = true AND subtype_code IS NOT NULL AND subtype_code <> '' THEN 1 ELSE 0 END)::text as subtype_anchored
          FROM public.baseline_spines_runtime
        `);
        // Handle BIGINT count values - cast to string first to avoid INT32 overflow
        const totalValue = countsResult.rows[0]?.total || '0';
        const activeTrueValue = countsResult.rows[0]?.active_true || '0';
        const subtypeAnchoredValue = countsResult.rows[0]?.subtype_anchored || '0';
        totalCount = parseInt(String(totalValue), 10);
        activeTrueCount = parseInt(String(activeTrueValue), 10);
        subtypeAnchoredCount = parseInt(String(subtypeAnchoredValue), 10);

        // Get sample when total > 0 (prioritize subtype-anchored entries)
        if (totalCount > 0) {
          const sampleResult = await pool.query(`
            SELECT 
              canon_id, 
              discipline_code, 
              subtype_code, 
              left(question_text, 80) as preview, 
              active
            FROM public.baseline_spines_runtime
            WHERE subtype_code IS NOT NULL AND subtype_code <> ''
            ORDER BY canon_id
            LIMIT 5
          `);
          // If no subtype-anchored samples, fall back to any rows
          if (sampleResult.rows.length === 0) {
            const fallbackResult = await pool.query(`
              SELECT 
                canon_id, 
                discipline_code, 
                subtype_code, 
                left(question_text, 80) as preview, 
                active
              FROM public.baseline_spines_runtime
              ORDER BY canon_id
              LIMIT 5
            `);
            sample = fallbackResult.rows;
          } else {
            sample = sampleResult.rows;
          }
        }
      }
    } catch (schemaCheckError: unknown) {
      schemaError = schemaCheckError instanceof Error ? schemaCheckError.message : "Unknown error checking schema";
    }

    return NextResponse.json({
      server_time: serverTime,
      db: {
        database: dbInfo.db,
        user: dbInfo.user
      },
      host: {
        addr: hostInfo.addr,
        port: hostInfo.port
      },
      schema_checks: {
        baseline_spines_runtime: {
          exists: tableExists,
          counts: {
            total: totalCount,
            active_true: activeTrueCount,
            subtype_anchored: subtypeAnchoredCount
          },
          sample: totalCount > 0 ? sample : undefined,
          error: schemaError || undefined
        }
      }
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API /api/runtime/health GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        server_time: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

