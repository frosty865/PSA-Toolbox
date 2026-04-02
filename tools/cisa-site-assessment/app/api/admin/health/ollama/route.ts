import { NextRequest, NextResponse } from 'next/server';
import { ollamaInferenceHealthCheck } from '@/app/lib/ollama/ollama_client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/health/ollama
 *
 * Runs inference healthcheck using the GENERAL model (PSA_GENERAL_MODEL):
 * sends "Return ONLY the word OK." and expects OK. Does not use metadata model.
 */
export async function GET(
   
  _request: NextRequest
) {
  try {
    const result = await ollamaInferenceHealthCheck(15000);
    return NextResponse.json(
      {
        ok: result.ok,
        model: result.model,
        response: result.response,
        error: result.error,
        base_url: result.baseUrl,
      },
      { status: result.ok ? 200 : 503 }
    );
  } catch (error: unknown) {
    console.error('[API /api/admin/health/ollama GET] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
