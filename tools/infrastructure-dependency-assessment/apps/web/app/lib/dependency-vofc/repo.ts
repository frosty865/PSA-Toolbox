/**
 * Repository for dependency_vofc_local (DB-tech-agnostic).
 * Current implementation: JSON file storage.
 * Swap to SQLite/Prisma/Drizzle without changing route logic.
 */
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { getRepoRoot } from '@/app/lib/template/path';
import type { DepInfra } from '@/app/lib/dependencies/condition_codes';
import { INFRA_ORDER } from '@/app/lib/dependencies/condition_codes';

export interface DependencyVofcRow {
  condition_code: string;
  infrastructure: DepInfra;
  vulnerability_text: string;
  ofc_1?: string;
  ofc_2?: string;
  ofc_3?: string;
  ofc_4?: string;
  source_type: 'VOFC_XLS' | 'CISA_GUIDE' | 'NIST' | 'OTHER';
  source_reference: string;
  approved: boolean;
  version: string;
}

interface StoredRow extends DependencyVofcRow {
  id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ListFilters {
  approved?: boolean;
  infrastructure?: string;
}

const DATA_PATH = path.join(getRepoRoot(), 'data', 'dependency_vofc_local.json');

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

/**
 * Upsert a row by condition_code.
 */
export async function upsertDependencyVofcRow(row: {
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
  version: string;
}): Promise<StoredRow> {
  const rows = await loadRows();
  const code = row.condition_code.trim();
  const existing = rows.find((r) => r.condition_code === code);
  const now = new Date().toISOString();

  const newRow: StoredRow = {
    id: existing?.id ?? randomUUID(),
    condition_code: code,
    infrastructure: row.infrastructure as DepInfra,
    vulnerability_text: row.vulnerability_text.trim(),
    ofc_1: row.ofc_1?.trim() || undefined,
    ofc_2: row.ofc_2?.trim() || undefined,
    ofc_3: row.ofc_3?.trim() || undefined,
    ofc_4: row.ofc_4?.trim() || undefined,
    source_type: row.source_type as DependencyVofcRow['source_type'],
    source_reference: row.source_reference.trim(),
    approved: !!row.approved,
    version: row.version || 'dep_v1',
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  const next = existing
    ? rows.map((r) => (r.condition_code === newRow.condition_code ? newRow : r))
    : [...rows, newRow];

  await saveRows(next);
  return newRow;
}

/**
 * List rows with optional filters.
 */
export async function listDependencyVofcRows(filters?: ListFilters): Promise<DependencyVofcRow[]> {
  let rows = await loadRows();

  if (filters?.approved !== undefined) {
    rows = rows.filter((r) => !!r.approved === !!filters.approved);
  }
  if (filters?.infrastructure && INFRA_ORDER.includes(filters.infrastructure as DepInfra)) {
    rows = rows.filter((r) => r.infrastructure === filters.infrastructure);
  }

  rows.sort((a, b) => {
    const ai = INFRA_ORDER.indexOf(a.infrastructure);
    const bi = INFRA_ORDER.indexOf(b.infrastructure);
    if (ai !== bi) return ai - bi;
    return a.condition_code.localeCompare(b.condition_code);
  });

  return rows;
}
