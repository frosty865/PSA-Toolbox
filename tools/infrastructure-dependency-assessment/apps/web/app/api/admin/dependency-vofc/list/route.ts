/**
 * GET /api/admin/dependency-vofc/list?approved=true|false&infrastructure=...
 * List rows from dependency_vofc_local.
 */
import { NextRequest, NextResponse } from 'next/server';
import { listDependencyVofcRows } from '@/app/lib/dependency-vofc/repo';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const approvedParam = searchParams.get('approved');
  const infrastructure = searchParams.get('infrastructure') ?? undefined;

  const filters: { approved?: boolean; infrastructure?: string } = {};
  if (approvedParam !== null && approvedParam !== '') {
    filters.approved = approvedParam === 'true' || approvedParam === '1';
  }
  if (infrastructure) {
    filters.infrastructure = infrastructure;
  }

  const rows = await listDependencyVofcRows(filters);
  return NextResponse.json({ rows });
}
