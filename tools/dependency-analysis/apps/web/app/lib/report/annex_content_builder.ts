/**
 * Part II Technical Annex content: structural profile, vulnerability count, vulnerability blocks.
 * Supports grouping by_driver (collapse multi-sector) or by_sector (sector headers).
 * No SAFE references; options cap 4 per vulnerability.
 */

import type { ReportVM, EvaluatedVulnerability, CurveSummary } from './view_model';
import type { InfrastructureSection } from './view_model';
import {
  buildFederalVulnerabilityBlock,
  mapSeverity,
  type FederalSeverity,
} from './vulnerability/federal_block_format';

/** Canonical domain order for grouping and severity distribution. All domains must be present. */
export const ALL_VULN_DOMAINS = [
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
  'CROSS',
] as const;

const SECTOR_LABEL: Record<string, string> = {
  ELECTRIC_POWER: 'Electric Power',
  COMMUNICATIONS: 'Communications',
  INFORMATION_TECHNOLOGY: 'Information Technology',
  WATER: 'Water',
  WASTEWATER: 'Wastewater',
  CROSS: 'Cross-Dependency',
};

const MAX_OFC_PER_VULN = 4;

export type GroupedVuln = {
  vulns: EvaluatedVulnerability[];
  curve: CurveSummary | undefined;
  domainLabels: string[];
  infraCodes: string[];
};

/**
 * Group vulnerabilities by rootCauseKey (by_driver): same root cause across sectors → one block with multi-domain; merge OFCs.
 */
function groupByDriver(infrastructures: InfrastructureSection[]): GroupedVuln[] {
  const byKey = new Map<string, GroupedVuln>();

  for (const infra of infrastructures) {
    const curve = infra.curve;
    const label = SECTOR_LABEL[infra.code] ?? infra.display_name ?? infra.code;
    for (const v of infra.vulnerabilities ?? []) {
      const key = v.rootCauseKey ?? v.title?.trim() ?? v.id ?? '';
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.infraCodes.includes(infra.code)) {
          existing.infraCodes.push(infra.code);
          existing.domainLabels.push(label);
        }
        existing.vulns.push(v);
        if (curve && !existing.curve) existing.curve = curve;
      } else {
        byKey.set(key, {
          vulns: [v],
          curve,
          domainLabels: [label],
          infraCodes: [infra.code],
        });
      }
    }
  }

  return [...byKey.values()];
}

/**
 * Per-sector list (by_sector): no grouping; each infra's vulns with that sector's curve.
 */
function listBySector(infrastructures: InfrastructureSection[]): GroupedVuln[] {
  const out: GroupedVuln[] = [];
  for (const infra of infrastructures) {
    const curve = infra.curve;
    const label = SECTOR_LABEL[infra.code] ?? infra.display_name ?? infra.code;
    for (const v of infra.vulnerabilities ?? []) {
      out.push({
        vulns: [v],
        curve,
        domainLabels: [label],
        infraCodes: [infra.code],
      });
    }
  }
  return out;
}

/**
 * Merge OFCs from multiple vulns (dedupe by normalized text), cap at 4.
 */
export function mergeOfcs(vulns: EvaluatedVulnerability[]): Array<{ text: string; title: string }> {
  const seen = new Set<string>();
  const result: Array<{ text: string; title: string }> = [];
  for (const v of vulns) {
    for (const o of v.ofcs ?? []) {
      const t = (o.text || o.title || '').trim();
      const norm = t.toLowerCase().replace(/\s+/g, ' ');
      if (t && !seen.has(norm) && result.length < MAX_OFC_PER_VULN) {
        seen.add(norm);
        result.push({ text: t, title: (o.title || '').trim() });
      }
    }
  }
  return result.slice(0, MAX_OFC_PER_VULN);
}

/**
 * Build structural profile summary (1–3 sentences).
 */
export function buildStructuralProfileSummary(vm: ReportVM): string {
  const narrative = vm.executive?.executive_risk_posture_narrative;
  if (narrative && narrative.length > 0) {
    return narrative.slice(0, 3).join(' ').trim();
  }
  const snapshot = vm.executive?.risk_posture_snapshot;
  const posture = snapshot?.overallPosture ?? 'Structural sensitivity is informed by the dependency assessment.';
  const driverCount = snapshot?.drivers?.length ?? 0;
  if (driverCount === 0) {
    return `${posture} No sector-specific structural drivers were highlighted.`;
  }
  return `${posture} Key structural drivers inform the dependency characteristics described in this assessment.`;
}

/**
 * Build vulnerability count summary (2–3 lines: total + HIGH/ELEVATED/MODERATE).
 */
export function buildVulnerabilityCountSummary(grouped: GroupedVuln[]): string {
  if (grouped.length === 0) {
    return 'No infrastructure vulnerabilities were triggered from the captured assessment responses.';
  }
  let high = 0;
  let elevated = 0;
  let moderate = 0;
  for (const g of grouped) {
    const sev = mapSeverity(g.curve?.time_to_impact_hr, g.curve?.loss_no_backup_pct);
    if (sev === 'HIGH') high++;
    else if (sev === 'ELEVATED') elevated++;
    else moderate++;
  }
  const total = grouped.length;
  const lines: string[] = [
    `Total findings: ${total} vulnerability block${total !== 1 ? 's' : ''}.`,
    `Severity distribution: ${high} HIGH, ${elevated} ELEVATED, ${moderate} MODERATE.`,
  ];
  return lines.join(' ');
}

/**
 * Build full vulnerability blocks string (federal format). By_driver: collapse by rootCauseKey; by_sector: per-sector (no empty sector headers).
 */
export function buildVulnerabilityBlocks(vm: ReportVM): string {
  const mode = vm.vuln_grouping_mode ?? 'by_driver';
  const infras = vm.infrastructures ?? [];
  const grouped =
    mode === 'by_driver'
      ? groupByDriver(infras)
      : listBySector(infras);

  if (grouped.length === 0) {
    return 'No infrastructure vulnerabilities were triggered. Validate provider restoration assumptions and backup duration inputs to confirm operational sensitivity.';
  }

  const blocks: string[] = [];
  grouped.forEach((g, i) => {
    const representative = g.vulns[0];
    const mergedOfcs =
      g.vulns.length > 1
        ? mergeOfcs(g.vulns)
        : (representative.ofcs ?? []).slice(0, MAX_OFC_PER_VULN).map((o) => ({ text: o.text || o.title || '', title: (o.title || '').trim() }));
    const vulnWithMergedOfcs: EvaluatedVulnerability = {
      ...representative,
      ofcs: mergedOfcs.map((o, idx) => ({ id: `ofc-${idx}`, title: o.title, text: o.text })),
    };
    const block = buildFederalVulnerabilityBlock({
      vuln: vulnWithMergedOfcs,
      index: i,
      curve: g.curve,
      domainLabels: g.domainLabels,
      cascadeExposure: 'Low',
    });
    blocks.push(block);
  });

  return blocks.join('\n\n').replace(/\n{4,}/g, '\n\n\n').trim();
}

/** Count vulnerability blocks in the federal-format string (one block per "VULNERABILITY N" line). */
export function countVulnerabilityBlocksInString(blocksText: string): number {
  if (!blocksText || typeof blocksText !== 'string') return 0;
  const matches = blocksText.match(/^VULNERABILITY \d+/gm);
  return matches ? matches.length : 0;
}

/**
 * Build all Part II annex content for the new anchor map.
 * Returns evaluatedVulnBlockCount for QC: must equal countVulnerabilityBlocksInString(vulnerability_blocks).
 */
export function buildAnnexContent(vm: ReportVM): {
  structural_profile_summary: string;
  vulnerability_count_summary: string;
  vulnerability_blocks: string;
  evaluatedVulnBlockCount: number;
} {
  const infras = vm.infrastructures ?? [];
  const mode = vm.vuln_grouping_mode ?? 'by_driver';
  const grouped =
    mode === 'by_driver'
      ? groupByDriver(infras)
      : listBySector(infras);

  return {
    structural_profile_summary: buildStructuralProfileSummary(vm),
    vulnerability_count_summary: buildVulnerabilityCountSummary(grouped),
    vulnerability_blocks: buildVulnerabilityBlocks(vm),
    evaluatedVulnBlockCount: grouped.length,
  };
}

/**
 * Format a synthesis line with a space after the category label (e.g. "Communications: Time to impact...").
 * Use when composing synthesis bullets into a single string; ensures no "Category:No space" jammed text.
 */
export function formatSynthesisBulletLine(category: string, text: string): string {
  const cat = (category ?? '').trim().replace(/:+$/, '');
  const txt = (text ?? '').trim();
  return txt ? `${cat}: ${txt}` : cat;
}

/**
 * Return grouped vulnerabilities (same grouping as buildVulnerabilityBlocks) for Part II report VM.
 */
export function getGroupedVulnerabilities(vm: ReportVM): GroupedVuln[] {
  const mode = vm.vuln_grouping_mode ?? 'by_driver';
  const infras = vm.infrastructures ?? [];
  return mode === 'by_driver' ? groupByDriver(infras) : listBySector(infras);
}
