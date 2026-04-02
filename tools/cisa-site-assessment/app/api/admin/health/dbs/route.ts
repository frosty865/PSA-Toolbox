import { NextRequest, NextResponse } from 'next/server';
import { checkRuntimeHealth } from '@/app/lib/db/runtime_client';
import { checkCorpusHealth } from '@/app/lib/db/corpus_client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/health/dbs
 * 
 * Health check endpoint to verify both RUNTIME and CORPUS databases are accessible
 * and correctly configured.
 * 
 * Returns:
 * {
 *   runtime_ok: boolean,
 *   corpus_ok: boolean,
 *   runtime_project: string,
 *   corpus_project: string
 * }
 */
export async function GET(
   
  _request: NextRequest
) {
  try {
    // Check RUNTIME database (should have assessments table)
    const runtimeOk = await checkRuntimeHealth();
    
    // Check CORPUS database (optional - may not be configured yet)
    let corpusOk = false;
    let corpusError: string | null = null;
    try {
      corpusOk = await checkCorpusHealth();
    } catch (error: unknown) {
      corpusError = error instanceof Error ? error.message : 'Unknown error';
      console.warn('[API /api/admin/health/dbs] CORPUS check failed (optional):', corpusError);
    }
    
    // Extract project IDs from actual database URLs for verification.
    const runtimeUrl = process.env.RUNTIME_DATABASE_URL || '';
    const corpusUrl = process.env.CORPUS_DATABASE_URL || '';
    
    const runtimeProject = runtimeUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'unknown';
    const corpusProject = corpusUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'unknown';
    
    return NextResponse.json({
      runtime_ok: runtimeOk,
      corpus_ok: corpusOk,
      runtime_configured: !!process.env.RUNTIME_DATABASE_URL,
      corpus_configured: !!process.env.CORPUS_DATABASE_URL,
      corpus_error: corpusError,
      runtime_project: runtimeProject,
      corpus_project: corpusProject,
      note: corpusOk ? null : 'CORPUS database not configured or not accessible. This is optional - RUNTIME features work independently.'
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API /api/admin/health/dbs GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check database health',
        message: error instanceof Error ? error.message : 'Unknown error',
        runtime_ok: false,
        corpus_ok: false
      },
      { status: 500 }
    );
  }
}


