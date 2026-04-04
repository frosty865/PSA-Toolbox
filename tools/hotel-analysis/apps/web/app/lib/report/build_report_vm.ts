/**
 * Single source-of-truth Report VM builder for Review & Export.
 *
 * Used by both the Review page and the Export route.
 * Produces exactly the same structure; no parallel calculations.
 */

import type { Assessment } from 'schema';
import { buildSummary } from 'engine';
import { applyModuleModifiers } from '@/app/lib/modules/apply_module_modifiers';
import { buildReportVM, type ReportVM, type MethodologySection, type CurveSummary, type EvaluatedVulnerability } from './view_model';
import { buildMethodology, type MethodologyBlock, type SectorKey } from './methodology_builder';
import { formatHours } from './format_hours';
import { buildPriorityActions } from './priority_actions';
import { buildCoverageManifest, getUnaccountedKeys } from './coverage_manifest';
import { computeCompletion, getFirstMissingInfo, type CompletionResult } from '@/app/lib/assessment/completion';
import { buildCanonicalVulnBlocks, type CanonicalVulnBlock } from '@/app/lib/export/canonical_vuln_blocks';
import { migrateReportThemedFindingsFromCategories } from '@/app/lib/assessment/migrate_report_themed_findings';
import { compileCitations } from './citations/registry';

export type ExportPreflight = {
  assessment_complete: boolean;
  has_required_curves: boolean;
  has_required_charts: boolean;
  has_required_sections: boolean;
  can_export: boolean;
  blockers: Array<{ code: string; message: string; sector?: SectorKey }>;
};

export type ReportVMWithPreflight = ReportVM & {
  methodology: MethodologySection;
  priority_actions: {
    title: string;
    actions: Array<{ number: number; leadIn: string; fullText: string }>;
  };
  preflight: ExportPreflight;
};

const BLOCKER_CODES = {
  MISSING_REQUIRED_ANSWERS: 'MISSING_REQUIRED_ANSWERS',
  MISSING_CURVE_POINTS: 'MISSING_CURVE_POINTS',
  MISSING_CHART_MODEL: 'MISSING_CHART_MODEL',
  UNMAPPED_CAPTURED_KEYS: 'UNMAPPED_CAPTURED_KEYS',
  UNMAPPED_TRIGGER_CONDITIONS: 'UNMAPPED_TRIGGER_CONDITIONS',
  TEMPLATE_NOT_READY: 'TEMPLATE_NOT_READY',
} as const;

const SECTOR_LABELS: Record<SectorKey, string> = {
  ELECTRIC_POWER: 'Electric Power',
  COMMUNICATIONS: 'Communications',
  INFORMATION_TECHNOLOGY: 'Information Technology',
  WATER: 'Water',
  WASTEWATER: 'Wastewater',
};

function canonicalBlockToEvaluatedVuln(
  block: CanonicalVulnBlock,
  citationIds: string[] = []
): EvaluatedVulnerability {
  const normalizeOfc = (s: string): string => {
    let t = String(s ?? '').replace(/\u00a0/g, ' ').trim();
    let prev = '';
    while (t && t !== prev) {
      prev = t;
      t = t.replace(/^\s*(?:[\u2022\u2023\-*]+|\(?\d+[.)]\)?|[A-Za-z][.)])\s*/, '').trim();
      t = t.replace(/^\s*:\s*/, '').trim();
    }
    return t;
  };
  const ofcLines = (block.ofcText ?? '').split(/\n/).map((s) => normalizeOfc(s)).filter(Boolean);
  const ofcs = ofcLines.slice(0, 4).map((text, idx) => ({
    id: `ofc-${block.vuln_id}-${idx}`,
    title: '',
    text,
  }));
  return {
    id: block.vuln_id,
    title: block.title,
    summary: block.narrative,
    citations: citationIds,
    ofcs,
  };
}

/**
 * Convert MethodologyBlock to MethodologySection for report rendering.
 */
function methodologyBlockToSection(block: MethodologyBlock): MethodologySection {
  const facts: string[] = [
    `Tool version: ${block.tool_version}. Template: ${block.template_version}.`,
    `Assessment created: ${block.assessment_created_at}. Horizon: ${formatHours(block.horizon_hours)}.`,
    `Curve model: ${block.curve_model}. Vulnerability model: ${block.vulnerability_model}.`,
    `Cross-dependency: ${block.cross_dependency.enabled ? 'enabled' : 'disabled'}; ${block.cross_dependency.edges} edge(s) evaluated.`,
  ];

  const notesParagraphs = block.notes.length > 0
    ? block.notes.map((n) => `• ${n}`)
    : [];

  return {
    heading: 'Methodology',
    sections: [
      { heading: 'Facts', paragraphs: facts },
      ...(notesParagraphs.length > 0 ? [{ heading: 'Notes', paragraphs: notesParagraphs }] : []),
    ],
  };
}

/**
 * Determine highest structural posture classification from key risk drivers.
 * Returns "High" | "Elevated" | "Moderate".
 */
function getStructuralPostureClassification(
  drivers: Array<{ severity: string }>
): 'High' | 'Elevated' | 'Moderate' {
  if (drivers.length === 0) return 'Moderate';
  if (drivers.some((d) => d.severity === 'HIGH')) return 'High';
  const elevatedCount = drivers.filter((d) => d.severity === 'ELEVATED').length;
  if (elevatedCount > drivers.length / 2) return 'Elevated';
  return 'Moderate';
}

/**
 * Build 3-paragraph executive risk posture narrative (paragraph-only, no driver labels).
 * P1: "<Classification> Structural Sensitivity"
 * P2: Structural drivers summarized in sentence form (no standalone labels).
 * P3: Time-to-impact exposure across sectors in plain language.
 */
function buildExecutiveRiskPostureNarrative(vm: ReportVM): string[] {
  const drivers = vm.executive?.key_risk_drivers ?? [];
  const curves = vm.executive?.curve_summaries ?? [];

  const classification = getStructuralPostureClassification(drivers);
  const p1 = `${classification} Structural Sensitivity`;

  const driverThemes: string[] = [];
  if (drivers.some((d) => (d as { _category?: string })._category === 'STRUCTURAL' || (d as { driverCategory?: string }).driverCategory === 'STRUCTURAL')) {
    driverThemes.push('structural constraints');
  }
  if (drivers.some((d) => d.infrastructures.length > 1)) {
    driverThemes.push('cross-infrastructure exposure');
  }
  if (drivers.some((d) => (d as { _category?: string })._category === 'CASCADING')) {
    driverThemes.push('cascading dependency risk');
  }
  if (drivers.length > 0 && driverThemes.length === 0) {
    driverThemes.push('identified risk drivers across assessed sectors');
  }
  const p2 =
    driverThemes.length > 0
      ? `Structural drivers are reflected in ${driverThemes.join(', ')}, and inform the dependency characteristics described in this assessment.`
      : 'Structural sensitivity is informed by the dependency characteristics described in this assessment.';

  const immediate: string[] = [];
  const nearTerm: string[] = [];
  const tolerant: string[] = [];
  for (const c of curves) {
    const tti = c.time_to_impact_hr;
    const label = typeof c.infra === 'string' ? c.infra : (c as CurveSummary).infra;
    if (tti === undefined || tti === null) {
      tolerant.push(label);
    } else if (tti <= 2) {
      immediate.push(label);
    } else if (tti <= 8) {
      nearTerm.push(label);
    } else {
      tolerant.push(label);
    }
  }
  const ttiParts: string[] = [];
  if (immediate.length > 0) ttiParts.push(`${immediate.join(' and ')} show immediate time-to-impact exposure`);
  if (nearTerm.length > 0) ttiParts.push(`${nearTerm.join(' and ')} show near-term exposure`);
  if (tolerant.length > 0) ttiParts.push(`${tolerant.join(' and ')} ${tolerant.length === 1 ? 'shows' : 'show'} a more tolerant profile`);
  const p3 =
    ttiParts.length > 0
      ? `Time-to-impact exposure varies by sector: ${ttiParts.join('; ')}.`
      : 'Time-to-impact exposure across sectors is determined by the curve data in this assessment.';

  return [p1, p2, p3];
}

/**
 * Compute export preflight from VM, completion, assessment, and template status.
 */
function computePreflight(
  vm: ReportVM,
  completion: CompletionResult,
  templateReady: boolean
): ExportPreflight {
  const blockers: ExportPreflight['blockers'] = [];

  if (!templateReady) {
    blockers.push({ code: BLOCKER_CODES.TEMPLATE_NOT_READY, message: 'Report template is not ready.' });
  }

  if (!completion.isComplete) {
    const first = getFirstMissingInfo(completion);
    const sector = first?.sector;
    const label = first?.sectorLabel ?? (sector ? SECTOR_LABELS[sector] : 'Assessment');
    const next = first?.label ? ` Next: ${first.label}` : '';
    blockers.push({
      code: BLOCKER_CODES.MISSING_REQUIRED_ANSWERS,
      message: `Assessment incomplete: missing required inputs in ${label}.${next}`,
      sector,
    });
  }

  // Check required curves for sectors where requires_service
  let hasRequiredCurves = true;
  const infras = vm.infrastructures ?? [];
  for (const inf of infras) {
    const curve = inf.curve;
    if (!curve) continue;

    const hasTti = typeof curve.time_to_impact_hr === 'number';
    const hasLoss = typeof curve.loss_no_backup_pct === 'number';
    const hasRecovery = typeof curve.recovery_hr === 'number';
    const hasAny = hasTti || hasLoss || hasRecovery;
    if (!hasAny) {
      hasRequiredCurves = false;
      blockers.push({
        code: BLOCKER_CODES.MISSING_CURVE_POINTS,
        message: `Missing curve points for ${inf.display_name}.`,
        sector: inf.code as SectorKey,
      });
    }
  }

  // Chart models: curve points present for at least one sector
  const hasRequiredCharts =
    (vm.executive?.curve_summaries?.length ?? 0) > 0 &&
    (vm.executive?.curve_summaries?.some(
      (c) =>
        typeof c.time_to_impact_hr === 'number' ||
        typeof c.loss_no_backup_pct === 'number' ||
        (c.curve_points?.length ?? 0) > 0
    ) ?? false);

  // Required sections: synthesis and priority actions
  const hasSynthesis = (vm.synthesis?.sections?.length ?? 0) > 0;
  const hasRequiredSections = hasSynthesis;

  // Unmapped keys (from coverage) - do not block export in Review; export route handles separately
  const hasUnmappedKeys = vm.coverage
    ? getUnaccountedKeys(vm.coverage).length > 0
    : false;
  if (hasUnmappedKeys) {
    blockers.push({
      code: BLOCKER_CODES.UNMAPPED_CAPTURED_KEYS,
      message: 'Some captured inputs are not represented in the report.',
    });
  }

  const canExport =
    templateReady &&
    completion.isComplete &&
    hasRequiredCurves &&
    !hasUnmappedKeys;

  return {
    assessment_complete: completion.isComplete,
    has_required_curves: hasRequiredCurves,
    has_required_charts: hasRequiredCharts,
    has_required_sections: hasRequiredSections,
    can_export: canExport,
    blockers,
  };
}

export type BuildReportVMOptions = {
  completion?: CompletionResult;
  templateReady?: boolean;
};

/**
 * Build the single Report VM used by both Review page and Export route.
 */
export function buildReportVMForReviewAndExport(
  assessment: Assessment,
  options: BuildReportVMOptions = {}
): ReportVMWithPreflight {
  const { completion, templateReady = false } = options;

  migrateReportThemedFindingsFromCategories(assessment);
  const vm = buildReportVM(assessment);
  const { canonicalVulnBlocks } = buildCanonicalVulnBlocks(assessment);
  for (const inf of vm.infrastructures ?? []) {
    const citationIdsByVulnId = new Map<string, string[]>();
    for (const vuln of inf.vulnerabilities ?? []) {
      if (!vuln?.id) continue;
      const ids = Array.isArray(vuln.citations) ? vuln.citations.filter(Boolean) : [];
      if (ids.length > 0) citationIdsByVulnId.set(vuln.id, ids);
    }
    const blocksForDomain = canonicalVulnBlocks.filter((b) => b.domain === inf.code);
    inf.vulnerabilities = blocksForDomain.map((b) =>
      canonicalBlockToEvaluatedVuln(b, citationIdsByVulnId.get(b.vuln_id) ?? [])
    );
    inf.findings = blocksForDomain.map((b) => {
      const citationIds = citationIdsByVulnId.get(b.vuln_id) ?? [];
      return {
        title: b.title,
        narrative: b.narrative,
        citations: citationIds.length > 0 ? compileCitations(citationIds) : [],
      };
    });
  }

  vm.executive.executive_risk_posture_narrative = buildExecutiveRiskPostureNarrative(vm);

  const summary = applyModuleModifiers(
    buildSummary(assessment),
    assessment.modules as Record<string, unknown> | undefined
  );

  const priorityActionsList = buildPriorityActions({
    summary,
    assessment,
    crossDependencyEnabled: vm.featureFlags.crossDependencyEnabled ?? false,
  });

  const priority_actions = {
    title: 'Priority Actions',
    actions: priorityActionsList.map((a, i) => ({
      number: i + 1,
      leadIn: a.title,
      fullText: a.text,
    })),
  };

  const methodologyBlock = buildMethodology({
    assessment,
    normalizedConditions: undefined,
  });

  const methodology = methodologyBlockToSection(methodologyBlock);

  const completionResult = completion ?? computeCompletion(assessment);
  const preflight = computePreflight(vm, completionResult, templateReady);

  return {
    ...vm,
    methodology,
    priority_actions,
    preflight,
  };
}
