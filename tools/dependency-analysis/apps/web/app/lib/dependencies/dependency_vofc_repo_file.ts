/**
 * File-based implementation of DependencyVofcRepo.
 * Reads from data/dependency_vofc_local.json (curated, approved rows).
 * WEB-ONLY: Primary source for dependency relationship data until database integration available.
 */
import path from 'path';
import fs from 'fs/promises';
import { getRepoRoot } from '@/app/lib/template/path';
import type { DependencyVofcRepo, DependencyVofcRow } from './dependency_vofc_repo';
import type { DepInfra } from './condition_codes';
import { INFRA_ORDER } from './condition_codes';

const VALID_INFRA = new Set<string>(INFRA_ORDER);
const VALID_SOURCE = new Set(['VOFC_XLS', 'CISA_GUIDE', 'NIST', 'OTHER', 'LIBRARY_RAG']);

interface StoredRow {
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

function toRow(r: StoredRow): DependencyVofcRow | null {
  if (!VALID_INFRA.has(r.infrastructure) || !VALID_SOURCE.has(r.source_type)) return null;
  return {
    condition_code: r.condition_code,
    infrastructure: r.infrastructure as DepInfra,
    vulnerability_text: r.vulnerability_text,
    ofc_1: r.ofc_1 || undefined,
    ofc_2: r.ofc_2 || undefined,
    ofc_3: r.ofc_3 || undefined,
    ofc_4: r.ofc_4 || undefined,
    source_type: r.source_type as DependencyVofcRow['source_type'],
    source_reference: r.source_reference,
    approved: !!r.approved,
    version: r.version ?? 'dep_v1',
  };
}

export class DependencyVofcRepoFile implements DependencyVofcRepo {
  private dataPath: string;

  constructor(dataPath?: string) {
    this.dataPath =
      dataPath ?? path.join(getRepoRoot(), 'data', 'dependency_vofc_local.json');
  }

  async getApprovedByConditionCodes(codes: string[]): Promise<DependencyVofcRow[]> {
    if (codes.length === 0) return [];
    const codeSet = new Set(codes.map((c) => c.trim()).filter(Boolean));
    if (codeSet.size === 0) return [];

    let raw: unknown;
    try {
      const buf = await fs.readFile(this.dataPath, 'utf-8');
      raw = JSON.parse(buf);
    } catch {
      return [];
    }

    const rows = Array.isArray(raw) ? raw : (raw as { rows?: unknown[] }).rows ?? [];
    const seen = new Set<string>();
    const result: DependencyVofcRow[] = [];

    for (const r of rows) {
      const row = toRow(r as StoredRow);
      if (!row || !row.approved || !codeSet.has(row.condition_code) || seen.has(row.condition_code))
        continue;
      seen.add(row.condition_code);
      result.push(row);
    }

    result.sort((a, b) => {
      const ai = INFRA_ORDER.indexOf(a.infrastructure);
      const bi = INFRA_ORDER.indexOf(b.infrastructure);
      if (ai !== bi) return ai - bi;
      return a.condition_code.localeCompare(b.condition_code);
    });

    return result;
  }
}
