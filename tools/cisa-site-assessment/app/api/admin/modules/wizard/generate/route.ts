import { NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { generateModuleContentFromChunks } from '@/app/lib/modules/generation/generate_module_content_from_chunks';

/**
 * POST /api/admin/modules/wizard/generate
 *
 * Generates questions and OFCs from document chunks via the Node generator path.
 * Uses single-pass consolidated prompt; allows 0–4 OFCs per question (export may require 1–4 or NO_OFC_NEEDED).
 * For 2-pass pipeline (PASS A questions, PASS B OFCs per question) with yield guards and export validation,
 * use CLI: npx tsx tools/module_crawler/generate_module_cli.ts --module MODULE_EV_PARKING
 * Requires data/module_chunks/<module_code>.json (run extract_module_pdfs_to_chunks first). May take 2–10 min.
 * Returns draft payload (does not write to final tables).
 */
export async function POST(req: Request) {
  let module_code: string | undefined;

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    module_code = body.module_code;
    const max_chunks = typeof body.max_chunks === 'number' ? Math.min(Math.max(1, body.max_chunks), 150) : 12;

    if (!module_code || typeof module_code !== 'string') {
      return NextResponse.json(
        { ok: false, error: { code: 'MISSING_MODULE_CODE', message: 'Module code is required' } },
        { status: 400 }
      );
    }

    // Verify module exists
    const runtimePool = getRuntimePool();
    const moduleCheck = await runtimePool.query(
      'SELECT module_code FROM public.assessment_modules WHERE module_code = $1',
      [module_code]
    );

    if (!moduleCheck.rowCount || moduleCheck.rowCount === 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'MODULE_NOT_FOUND', message: 'Module not found' } },
        { status: 404 }
      );
    }

    const generated = await generateModuleContentFromChunks(module_code, { maxChunks: max_chunks });
    return NextResponse.json({
      ok: true,
      questions: generated.questions,
      ofcs: generated.ofcs,
      source: generated.source,
      itemCount: generated.itemCount,
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = (error as { stack?: string })?.stack;
    console.error('[API /api/admin/modules/wizard/generate] Error:', error);
    console.error('[API /api/admin/modules/wizard/generate] Error stack:', stack);
    console.error('[API /api/admin/modules/wizard/generate] Module code:', module_code);

    if (msg.includes('CHUNK_EXPORT_MISSING')) {
      const safeMsg = msg.replace(/ollama/gi, 'generator');
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'CHUNK_EXPORT_MISSING',
            message: safeMsg,
            details: `Run the offline chunk extractor for ${module_code} before generating module content.`
          }
        },
        { status: 400 }
      );
    }

    const details = msg.replace(/ollama/gi, 'generator');
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate content',
          details,
          stack: process.env.NODE_ENV === 'development' ? stack : undefined
        }
      },
      { status: 500 }
    );
  }
}

