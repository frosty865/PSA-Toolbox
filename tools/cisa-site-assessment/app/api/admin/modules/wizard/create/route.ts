import { NextResponse } from 'next/server';
import { createModuleMetadata } from '@/app/lib/admin/module_creation';

/**
 * POST /api/admin/modules/wizard/create
 * 
 * Creates module metadata (status = DRAFT) for the wizard flow.
 * Returns standardized error format.
 */
type CreateWizardBody = { module_code?: string; title?: string; description?: string };

export async function POST(req: Request) {
  let body: CreateWizardBody | null = null;
  try {
    body = (await req.json().catch(() => null)) as CreateWizardBody | null;
    if (!body) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const { module_code, title, description } = body;

    // Validation
    if (!module_code || typeof module_code !== 'string') {
      return NextResponse.json(
        { ok: false, error: { code: 'MISSING_MODULE_CODE', message: 'Module code is required' } },
        { status: 400 }
      );
    }

    if (!module_code.startsWith('MODULE_')) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_MODULE_CODE', message: 'Module code must start with "MODULE_"' } },
        { status: 400 }
      );
    }

    if (!/^MODULE_[A-Z0-9_]+$/.test(module_code)) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_MODULE_CODE', message: 'Module code must match pattern MODULE_[A-Z0-9_]+' } },
        { status: 400 }
      );
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'MISSING_TITLE', message: 'Title is required' } },
        { status: 400 }
      );
    }

    // Create module metadata
    const result = await createModuleMetadata({
      module_code: module_code.trim().toUpperCase(),
      title: title.trim(),
      description: description ? description.trim() : null
    });

    return NextResponse.json({
      ok: true,
      module_code: result.module_code,
      module_name: result.module_name,
      description: result.description,
      status: result.status
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('[API /api/admin/modules/wizard/create] Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    // Handle known errors
    if (message.includes('already exists')) {
      const code = body?.module_code ?? 'unknown';
      return NextResponse.json(
        { ok: false, error: { code: 'MODULE_EXISTS', message: `Module "${code}" already exists` } },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create module',
          details: error instanceof Error ? error.message : String(error)
        }
      },
      { status: 500 }
    );
  }
}

