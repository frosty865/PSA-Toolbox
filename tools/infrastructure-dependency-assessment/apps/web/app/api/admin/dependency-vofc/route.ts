/**
 * GET /api/admin/dependency-vofc?infrastructure=&approved=
 * List rows from dependency_vofc_local (file-based).
 */
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getRepoRoot } from '@/app/lib/template/path';
import type { DepInfra } from '@/app/lib/dependencies/condition_codes';
import { INFRA_ORDER } from '@/app/lib/dependencies/condition_codes';

const DATA_PATH = path.join(getRepoRoot(), 'data', 'dependency_vofc_local.json');

interface StoredRow {
  id: string;
  condition_code: string;
  infrastructure: string;
  vulnerability_text: string;
  ofc_1?: string;
  ofc_2?: string;
  ofc_3?: string;
  ofc_4?: string;
  source_type: string;
  source_reference: string;
  approved: boolean;
  version?: string;
}

async function loadRows(): Promise<StoredRow[]> {
  try {
    const buf = await fs.readFile(DATA_PATH, 'utf-8');
    const raw = JSON.parse(buf);
    return Array.isArray(raw) ? raw : (raw as { rows?: StoredRow[] }).rows ?? [];
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const infra = searchParams.get('infrastructure') ?? '';
  const approvedParam = searchParams.get('approved');

  let rows = await loadRows();

  if (infra && INFRA_ORDER.includes(infra as DepInfra)) {
    rows = rows.filter((r) => r.infrastructure === infra);
  }
  if (approvedParam !== null && approvedParam !== '') {
    const wantApproved = approvedParam === 'true' || approvedParam === '1';
    rows = rows.filter((r) => !!r.approved === wantApproved);
  }

  rows.sort((a, b) => {
    const ai = INFRA_ORDER.indexOf(a.infrastructure as DepInfra);
    const bi = INFRA_ORDER.indexOf(b.infrastructure as DepInfra);
    if (ai !== bi) return ai - bi;
    return a.condition_code.localeCompare(b.condition_code);
  });

  return NextResponse.json({ rows });
}
