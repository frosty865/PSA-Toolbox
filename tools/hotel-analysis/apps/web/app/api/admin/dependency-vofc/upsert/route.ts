/**
 * POST /api/admin/dependency-vofc/upsert
 * Upsert a row into dependency_vofc_local. Validates via validateDependencyRow.
 * Body: { row: DependencyVofcRowInput }
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateDependencyRow, type DependencyVofcRowInput } from '@/app/lib/dependency-vofc/guards';
import { upsertDependencyVofcRow } from '@/app/lib/dependency-vofc/repo';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const payload = body as { row?: unknown };
  const row = payload?.row;

  if (row == null || typeof row !== 'object') {
    return NextResponse.json(
      { ok: false, error: 'Body must contain { row: {...} }' },
      { status: 400 }
    );
  }

  const r = row as Record<string, unknown>;

  const getTrimmed = (value: unknown): string | undefined =>
    typeof value === 'string' ? value.trim() : undefined;

  const normalizeApproved = (value: unknown): boolean | undefined => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lowered = value.trim().toLowerCase();
      if (lowered === 'true') return true;
      if (lowered === 'false') return false;
    }
    return undefined;
  };

  const normalizedVulnerability =
    getTrimmed(r.vulnerability_text) || getTrimmed(r.vulnerability) || '';
  const approved = normalizeApproved(r.approved);

  const normalizedRow: DependencyVofcRowInput = {
    condition_code: getTrimmed(r.condition_code),
    infrastructure: getTrimmed(r.infrastructure),
    vulnerability_text: normalizedVulnerability || undefined,
    vulnerability: normalizedVulnerability || undefined,
    ofc_1: getTrimmed(r.ofc_1),
    ofc_2: getTrimmed(r.ofc_2),
    ofc_3: getTrimmed(r.ofc_3),
    ofc_4: getTrimmed(r.ofc_4),
    source_type: getTrimmed(r.source_type),
    source_reference: getTrimmed(r.source_reference),
    approved,
    version: getTrimmed(r.version),
  };

  const validation = validateDependencyRow(normalizedRow);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, errors: validation.errors },
      { status: 400 }
    );
  }

  const vulnerabilityText = normalizedVulnerability;
  const approvedForUpsert = approved ?? false;

  const toUpsert = {
    condition_code: getTrimmed(r.condition_code) ?? '',
    infrastructure: getTrimmed(r.infrastructure) ?? '',
    vulnerability_text: vulnerabilityText,
    ofc_1: getTrimmed(r.ofc_1),
    ofc_2: getTrimmed(r.ofc_2),
    ofc_3: getTrimmed(r.ofc_3),
    ofc_4: getTrimmed(r.ofc_4),
    source_type: getTrimmed(r.source_type) ?? '',
    source_reference: getTrimmed(r.source_reference) ?? '',
    approved: approvedForUpsert,
    version: getTrimmed(r.version) ?? 'dep_v1',
  };

  await upsertDependencyVofcRow(toUpsert);
  return NextResponse.json({ ok: true });
}
