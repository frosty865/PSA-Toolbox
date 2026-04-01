/**
 * POST /api/admin/dependency-vofc/approve
 * Body: { condition_code: string, approved: boolean }
 */
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getRepoRoot } from '@/app/lib/template/path';

const DATA_PATH = path.join(getRepoRoot(), 'data', 'dependency_vofc_local.json');

interface StoredRow {
  id: string;
  condition_code: string;
  [key: string]: unknown;
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

async function saveRows(rows: StoredRow[]): Promise<void> {
  const dir = path.dirname(DATA_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(rows, null, 2), 'utf-8');
}

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

  const { condition_code, approved } = body as { condition_code?: string; approved?: boolean };
  if (!condition_code?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'condition_code required' },
      { status: 400 }
    );
  }

  const rows = await loadRows();
  const idx = rows.findIndex((r) => r.condition_code === condition_code.trim());
  if (idx < 0) {
    return NextResponse.json(
      { ok: false, error: 'condition_code not found' },
      { status: 404 }
    );
  }

  rows[idx] = { ...rows[idx], approved: !!approved };
  await saveRows(rows);

  return NextResponse.json({ ok: true, condition_code: condition_code.trim(), approved: !!approved });
}
