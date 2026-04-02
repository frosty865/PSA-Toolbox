import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { checkTemplateAnchors } from '@/app/lib/template/validateAnchors';
import {
  getRepoRoot,
  getCanonicalTemplatePath,
  assertCanonicalTemplatePath,
} from '@/app/lib/template/path';

const MAIN_PY_RELATIVE = path.join('apps', 'reporter', 'main.py');

function findRootWithReporter(): string {
  const root = getRepoRoot();
  if (fs.existsSync(path.join(root, MAIN_PY_RELATIVE))) return root;
  const cwd = process.cwd();
  const candidates = [cwd, path.join(cwd, '..'), path.join(cwd, '..', '..'), path.join(cwd, 'asset-dependency-tool')];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, MAIN_PY_RELATIVE))) return path.resolve(dir);
  }
  return root;
}

export const dynamic = 'force-dynamic';

/**
 * GET /api/template/check
 * Returns template readiness for the same template export uses (ADA/report template.docx at findRootWithReporter()).
 */
export async function GET() {
  try {
    const repoRoot = findRootWithReporter();
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
