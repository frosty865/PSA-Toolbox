/**
 * Builds dependency_sections from repo rows (condition_code-driven).
 * Applies guards: exclude forbidden verbs, blocked keywords. Max 4 OFCs per row.
 */
import type { DependencyVofcRow } from './dependency_vofc_repo';
import { hasForbiddenVerb, hasBlockedKeyword } from '@/app/lib/dependency-vofc/guards';
import { INFRA_ORDER } from './condition_codes';
import type { DependencySectionPayload } from '@/lib/api';

const INFRA_TO_SECTION_NAME: Record<string, string> = {
  ENERGY: 'Electric Power (Energy)',
  COMMUNICATIONS: 'Communications (Carrier-Based Transport Services)',
  INFORMATION_TRANSPORT: 'Information Technology (Externally Hosted / Managed Digital Services)',
  WATER: 'Water',
  WASTEWATER: 'Wastewater',
};

function rowPassesGuards(row: DependencyVofcRow): boolean {
  if (hasBlockedKeyword(row.vulnerability_text)) return false;
  const ofcs = [row.ofc_1, row.ofc_2, row.ofc_3, row.ofc_4].filter((o): o is string => !!o?.trim());
  for (const ofc of ofcs) {
    if (hasForbiddenVerb(ofc) || hasBlockedKeyword(ofc)) return false;
  }
  return true;
}

function ensureSourcedOfc(ofc: string, row: DependencyVofcRow): string {
  const trimmed = (ofc ?? '').trim();
  if (!trimmed) return '';
  if (/\(\s*Source\s*:/i.test(trimmed)) return trimmed;
  const source = (row.source_reference ?? '').trim();
  if (!source) {
    throw new Error(`Missing source reference for OFC in condition ${row.condition_code}.`);
  }
  return `${trimmed} (Source: ${source})`;
}

function rowToThemedFindings(row: DependencyVofcRow): Array<{ id: string; title: string; narrative: string }> {
  const rawOfcs = [row.ofc_1, row.ofc_2, row.ofc_3, row.ofc_4].filter((o): o is string => !!o?.trim());
  if (rawOfcs.length < 2 || rawOfcs.length > 3) {
    throw new Error(
      `Invalid OFC count for condition ${row.condition_code}: ${rawOfcs.length}. Each vulnerability must have 2-3 OFCs.`
    );
  }
  const ofcs = rawOfcs.map((o) => ensureSourcedOfc(o, row));
  const narrative = ofcs.length > 0 ? ofcs.map((o) => `• ${o}`).join('\n') : '';
  return [
    {
      id: `dep-${row.condition_code}`,
      title: row.vulnerability_text,
      narrative,
    },
  ];
}

/**
 * Build dependency_sections for reporter from repo rows.
 * Grouped by infrastructure; excludes drifting/blocked rows.
 */
export function buildDependencySectionsFromRepo(rows: DependencyVofcRow[]): DependencySectionPayload[] {
  const filtered = rows.filter(rowPassesGuards);
  const byInfra = new Map<string, DependencyVofcRow[]>();
  for (const row of filtered) {
    const list = byInfra.get(row.infrastructure) ?? [];
    list.push(row);
    byInfra.set(row.infrastructure, list);
  }

  const sections: DependencySectionPayload[] = [];
  for (const infra of INFRA_ORDER) {
    const infraRows = byInfra.get(infra) ?? [];
    if (infraRows.length === 0) continue;

    const themedFindings: Array<{ id: string; title: string; narrative: string }> = [];
    for (const row of infraRows) {
      themedFindings.push(...rowToThemedFindings(row));
    }

    sections.push({
      name: INFRA_TO_SECTION_NAME[infra] ?? infra,
      themedFindings,
    });
  }

  return sections;
}
