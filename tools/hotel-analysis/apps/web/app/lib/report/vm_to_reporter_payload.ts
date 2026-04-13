/**
 * Convert ReportVM to reporter payload format.
 * Used by export route to pass data to Python reporter.
 */

import type { Assessment } from 'schema';
import type { ReportVM } from './view_model';
import type { CurveSummary } from './view_model';
import type { EvaluatedVulnerability } from './view_model';
import type { CitationRef } from './citations/registry';
import { compileCitations, CITATION_REGISTRY_VERSION } from './citations/registry';
import type { ItExternalService } from './it_services_builder';
import { buildSectorFieldBullets } from './cross_infrastructure_synthesis';

export type ReporterExecutiveSnapshot = {
  posture: string;
  summary: string;
  executive_summary_brief?: string;
  citations?: CitationRef[];
  drivers: string[];
  matrixRows: Array<{
    sector: string;
    ttiHrs: string;
    lossPct: string;
    backupHrs: string;
    structuralPosture: string;
  }>;
  cascade: string | null;
};

export type ReporterSynthesis = {
  title: string;
  paragraphs: string[];
  bullets: Array<{ label: string; text: string }>;
};

function mapTtiToStructuralPosture(tti?: number): string {
  if (tti === undefined || tti === null) return 'Tolerant';
  if (tti <= 2) return 'Immediate';
  if (tti <= 8) return 'Near-term';
  return 'Tolerant';
}

/** Missing numeric fields: empty string (no em dash) for dependency/snapshot rendering. */
function fmtOrBlank(v: number | undefined | null): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return '';
  return String(v);
}

/**
 * Build executive_snapshot dict for reporter from ReportVM.
 */
export function vmToExecutiveSnapshot(vm: ReportVM): ReporterExecutiveSnapshot {
  const snapshot = vm.executive?.risk_posture_snapshot;
  const narrative = vm.executive?.executive_risk_posture_narrative;
  const curves = vm.executive?.curve_summaries ?? [];

  const posture = snapshot?.overallPosture ?? (narrative?.[0] ?? 'Localized Sensitivity');

  const driverTitles = (snapshot?.drivers ?? []).map((d) => d.title).slice(0, 3);
  const summary =
    narrative && narrative.length > 0
      ? narrative.join(' ')
      : driverTitles.length > 0
        ? `Key risk drivers: ${driverTitles.join('; ')}.`
        : 'Complete the dependency assessment to see risk posture.';

  const synthesisText = vm.synthesis?.sections
    ?.flatMap((s) => s.paragraphs?.map((p) => p.text) ?? [])
    .filter(Boolean)
    .join(' ') ?? '';
  const executive_summary_brief =
    synthesisText.slice(0, 400) + (synthesisText.length > 400 ? '…' : '');

  const citations = vm.appendices?.citations_used ?? [];

  const matrixRows = curves
    .filter((c) => c.infra)
    .map((curve: CurveSummary) => ({
      sector: curve.infra,
      ttiHrs: fmtOrBlank(curve.time_to_impact_hr),
      lossPct: fmtOrBlank(curve.loss_no_backup_pct),
      backupHrs: curve.backup_available ? fmtOrBlank(curve.backup_duration_hr) : '',
      structuralPosture: mapTtiToStructuralPosture(curve.time_to_impact_hr),
    }));

  const cascade = snapshot?.cascadingIndicator?.summary ?? null;

  return {
    posture,
    summary,
    executive_summary_brief: executive_summary_brief || summary,
    citations,
    drivers: narrative && narrative.length > 0 ? [] : driverTitles,
    matrixRows,
    cascade,
  };
}

/**
 * Build synthesis dict for reporter from ReportVM.
 * When assessment is provided, uses field-only sector bullets (no summarizing narrative).
 */
export function vmToSynthesis(vm: ReportVM, assessment?: Assessment | null): ReporterSynthesis {
  if (assessment != null) {
    const bullets = buildSectorFieldBullets(assessment);
    return {
      title: 'Cross-Infrastructure Synthesis',
      paragraphs: [],
      bullets,
    };
  }

  const sections = vm.synthesis?.sections ?? [];
  const paragraphs = sections.flatMap((s) =>
    (s.paragraphs ?? []).map((p) => (typeof p === 'string' ? p : p.text ?? '')).filter(Boolean)
  );

  return {
    title: 'Cross-Infrastructure Synthesis',
    paragraphs,
    bullets: [],
  };
}

/** Rendered vulnerability block for reporter (single source of truth). */
export type ReporterVulnerabilityBlock = {
  title: string;
  narrative: string;
  ofcs: string[];
  references: string[];
  /** Canonical sections (when present, render as separate headings). */
  condition_identified?: string;
  operational_exposure?: string;
  why_this_matters?: string;
  driverCategory?: string;
  /** Vulnerability ID (for QC: detect catalog leak in canonical sectors). */
  id?: string;
  /** Root cause key (for QC: duplicate rootCauseKey check). */
  rootCauseKey?: string;
};

const SECTOR_DISPLAY: Record<string, string> = {
  ELECTRIC_POWER: 'Electric Power (Energy)',
  COMMUNICATIONS: 'Communications (Carrier-Based Transport Services)',
  INFORMATION_TECHNOLOGY: 'Information Technology (Externally Hosted / Managed Digital Services)',
  WATER: 'Water',
  WASTEWATER: 'Wastewater',
};

/**
 * Hard requirement: sector narrative must be non-empty. Throws with sector name and diagnostic context.
 * No placeholders, no silent blanks—either it builds narrative or it fails with proof.
 */
function assertNonEmptyNarrative(label: string, text: string, ctx: unknown): string {
  const trimmed = text.replace(/\u00a0/g, ' ').trim();
  if (trimmed.length === 0) {
    throw new Error(
      `Sector narrative empty: ${label}. Context: ${JSON.stringify(ctx).slice(0, 800)}`
    );
  }
  return trimmed;
}

const IS_DEV = process.env.NODE_ENV !== 'production';

function vulnToBlock(v: EvaluatedVulnerability): ReporterVulnerabilityBlock {
  if (IS_DEV) {
    if (CITATION_REGISTRY_VERSION !== 'v1') {
      throw new Error(`Wrong citation registry: expected v1, got ${CITATION_REGISTRY_VERSION}`);
    }
    (v.citations ?? []).forEach((key) => {
      if (key && key !== key.trim()) console.warn('citation_key_raw', JSON.stringify(key));
    });
  }
  const citationIds = (v.citations ?? []).filter(Boolean);
  const citations = compileCitations(citationIds);
  if (citations.length === 0) {
    throw new Error(`Missing citations for vulnerability ${v.id || v.title || '(unknown)'}.`);
  }
  const refs = citations.map((c) => c.full);
  const ofcs = (v.ofcs ?? []).slice(0, 4).map((o, idx) => {
    const base = (o.text || o.title || '').trim();
    if (!base) {
      throw new Error(`Empty OFC text for vulnerability ${v.id || v.title || '(unknown)'} at index ${idx + 1}.`);
    }
    return base.replace(/\s*\(\s*Source\s*:[^)]+\)\s*/gi, ' ').replace(/\s{2,}/g, ' ').trim();
  });
  return {
    id: v.id,
    title: v.title ?? '',
    narrative: (v.summary ?? '').replace(/\s*Source references:\s*[^.]+\.?/gi, '').replace(/\s{2,}/g, ' ').trim(),
    ofcs,
    references: refs,
    condition_identified: v.condition_identified,
    operational_exposure: v.operational_exposure,
    why_this_matters: v.why_this_matters,
    driverCategory: v.driverCategory,
    rootCauseKey: v.rootCauseKey,
  };
}

/** Index row for compact vulnerability table (title + sector only; no narrative/OFC). */
export type ReporterVulnerabilityIndexRow = { title: string; sector: string };

/**
 * Build energy_dependency and dependency_sections from ReportVM.
 * vulnerability_blocks are strict truth data from ReportVM.
 * If any sector resolves to zero vulnerability blocks, this throws (no placeholders/fallbacks).
 * vulnerability_index_rows: compact index for annex table (title + sector), NOT narrative/OFC.
 */
export function vmToDependencyPayload(vm: ReportVM): {
  energy_dependency: { vulnerability_blocks: ReporterVulnerabilityBlock[]; dataBlocks?: unknown[] };
  dependency_sections: Array<{
    name: string;
    infraCode: string;
    vulnerability_blocks: ReporterVulnerabilityBlock[];
    external_services?: ItExternalService[];
    cascade_narrative?: string;
  }>;
  vulnerability_index_rows: ReporterVulnerabilityIndexRow[];
} {
  const infras = vm.infrastructures ?? [];
  let energy_dependency: { vulnerability_blocks: ReporterVulnerabilityBlock[]; dataBlocks?: unknown[] } = {
    vulnerability_blocks: [],
  };
  const dependency_sections: Array<{ name: string; infraCode: string; vulnerability_blocks: ReporterVulnerabilityBlock[] }> = [];
  const vulnerability_index_rows: ReporterVulnerabilityIndexRow[] = [];

  for (const infra of infras) {
    let blocks = (infra.vulnerabilities ?? [])
      .slice(0, 6)
      .map((v) => vulnToBlock(v))
      .filter((b) => b.title || b.narrative || b.ofcs.length > 0 || b.references.length > 0);

    const sectorName = SECTOR_DISPLAY[infra.code] ?? infra.display_name ?? infra.code;
    if (blocks.length === 0) {
      throw new Error(
        `Missing vulnerability blocks for ${sectorName} (${infra.code}). Report output requires truth-backed findings for every rendered sector.`
      );
    }
    for (const b of blocks) {
      if (b.title) {
        vulnerability_index_rows.push({ title: b.title, sector: sectorName });
      }
    }

    if (infra.code === 'ELECTRIC_POWER') {
      energy_dependency = { vulnerability_blocks: blocks };
    } else {
      const section: {
        name: string;
        infraCode: string;
        vulnerability_blocks: ReporterVulnerabilityBlock[];
        external_services?: ItExternalService[];
        cascade_narrative?: string;
      } = { name: sectorName, infraCode: infra.code, vulnerability_blocks: blocks };
      if (infra.code === 'INFORMATION_TECHNOLOGY' && infra.external_services !== undefined) {
        section.external_services = infra.external_services;
        section.cascade_narrative = infra.cascade_narrative;
      }
      dependency_sections.push(section);
    }
  }

  return { energy_dependency, dependency_sections, vulnerability_index_rows };
}

/**
 * Build INFRA_* narrative strings from ReportVM for payload.
 * Hard-fails with diagnostic context if any sector narrative is empty (no placeholders).
 */
export function vmToInfraNarratives(vm: ReportVM): {
  INFRA_ENERGY: string;
  INFRA_COMMS: string;
  INFRA_IT: string;
  INFRA_WATER: string;
  INFRA_WASTEWATER: string;
} {
  const infras = vm.infrastructures ?? [];
  const byCode: Record<string, string> = {};
  for (const infra of infras) {
    const parts: string[] = [];
    if (infra.intro?.purpose?.trim()) parts.push(infra.intro.purpose.trim());
    if (infra.sensitivity_summary?.trim()) parts.push(infra.sensitivity_summary.trim());
    for (const v of infra.vulnerabilities ?? []) {
      if (v.summary?.trim()) parts.push(v.summary.trim());
    }
    const raw = parts.join('\n\n').replace(/\u00a0/g, ' ').trim();
    const ctx = {
      hasCurve: !!(infra.curve as { curve_points?: unknown[] } | undefined)?.curve_points?.length,
      vulnCount: (infra.vulnerabilities ?? []).length,
      introLength: (infra.intro?.purpose ?? '').replace(/\u00a0/g, ' ').trim().length,
    };
    byCode[infra.code] = assertNonEmptyNarrative(`INFRA_${infra.code}`, raw, ctx);
  }
  return {
    INFRA_ENERGY: byCode.ELECTRIC_POWER ?? '',
    INFRA_COMMS: byCode.COMMUNICATIONS ?? '',
    INFRA_IT: byCode.INFORMATION_TECHNOLOGY ?? '',
    INFRA_WATER: byCode.WATER ?? '',
    INFRA_WASTEWATER: byCode.WASTEWATER ?? '',
  };
}
