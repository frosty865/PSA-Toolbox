import { NextResponse } from 'next/server';
import fs from 'fs';
import { checkTemplateAnchors } from '@/app/lib/template/validateAnchors';
import {
  getRepoRoot,
  getCanonicalTemplatePath,
  assertCanonicalTemplatePath,
} from '@/app/lib/template/path';

export const dynamic = 'force-dynamic';

/**
 * GET /api/template/check
 * Returns template readiness for the same template export uses.
 */
export async function GET() {
  try {
    const repoRoot = getRepoRoot();
    const templatePath = getCanonicalTemplatePath(repoRoot);
    assertCanonicalTemplatePath(templatePath);
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({
        ok: false,
        templatePath,
        missing: [],
        duplicates: [],
        error: `Template file not found: ${templatePath}`,
      });
    }
    const result = await checkTemplateAnchors(templatePath);
    return NextResponse.json({
      ok: result.ok,
      templatePath: result.templatePath,
      missing: result.missing,
      duplicates: result.duplicates,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Template check failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
