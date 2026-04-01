/**
 * Client-safe Report VM builder for the Review page.
 *
 * Does NOT import from 'engine' (which uses Node.js fs). Use this in client components.
 * The export route uses build_report_vm.ts (server-only) for full VM with priority_actions.
 *
 * Online Summary uses the SAME canonical derived list as DOCX export (sessions.derived.themedFindings + ofcs).
 * Reporter must not re-derive; both consume buildCanonicalVulnBlocks() so web and DOCX match 1:1.
 */

import type { Assessment } from 'schema';
import { buildReportVM, type ReportVM, type MethodologySection, type EvaluatedVulnerability } from './view_model';
import { buildMethodology, type MethodologyBlock, type SectorKey } from './methodology_builder';
import { buildCanonicalVulnBlocks, type CanonicalVulnBlock } from '@/app/lib/export/canonical_vuln_blocks';
import { migrateReportThemedFindingsFromCategories } from '@/app/lib/assessment/migrate_report_themed_findings';
import { formatHours } from './format_hours';
import { getUnaccountedKeys } from './coverage_manifest';
import { computeCompletion, getFirstMissingInfo, type CompletionResult } from '@/app/lib/assessment/completion';
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
  TEMPLATE_NOT_READY: 'TEMPLATE_NOT_READY',
} as const;

const SECTOR_LABELS: Record<SectorKey, string> = {
  ELECTRIC_POWER: 'Electric Power',
  COMMUNICATIONS: 'Communications',
  INFORMATION_TECHNOLOGY: 'Information Technology',
  WATER: 'Water',
  WASTEWATER: 'Wastewater',
};

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

  const hasRequiredCharts =
    (vm.executive?.curve_summaries?.length ?? 0) > 0 &&
    (vm.executive?.curve_summaries?.some(
      (c) =>
        typeof c.time_to_impact_hr === 'number' ||
        typeof c.loss_no_backup_pct === 'number' ||
        (c.curve_points?.length ?? 0) > 0
    ) ?? false);

  const hasSynthesis = (vm.synthesis?.sections?.length ?? 0) > 0;

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
    has_required_sections: hasSynthesis,
    can_export: canExport,
    blockers,
  };
}

export type BuildReportVMClientOptions = {
  completion?: CompletionResult;
  templateReady?: boolean;
};

/** Map canonical block to EvaluatedVulnerability so Online Summary matches DOCX (same OFC cap as canonical). */
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
 * Build Report VM for the Review page (client-safe, no engine/fs).
 * Priority actions are empty; export route builds full VM server-side.
 * Vulnerabilities are taken from the canonical derived list so Online Summary matches DOCX export 1:1.
 */
export function buildReportVMForReview(
  assessment: Assessment,
  options: BuildReportVMClientOptions = {}
): ReportVMWithPreflight {
  const { completion, templateReady = false } = options;

  migrateReportThemedFindingsFromCategories(assessment);
  const vm = buildReportVM(assessment);

  // Single source of truth: same canonical list as DOCX export (do not re-derive in reporter).
  const { canonicalVulnBlocks } = buildCanonicalVulnBlocks(assessment);
  const infras = vm.infrastructures ?? [];
  const sessions = (assessment as Record<string, unknown>).sessions as Record<
    string,
    { derived?: { themedFindings?: Array<{ ofcText?: string }>; ofcs?: unknown[] } }
  > | undefined;

  for (const inf of infras) {
    const citationIdsByVulnId = new Map<string, string[]>();
    const previousVulns = inf.vulnerabilities ?? [];
    for (const vuln of previousVulns) {
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

    // QC: fail loudly if derived has OFC data but VM emitted none for this domain.
    const domainDerived = sessions?.[inf.code as string]?.derived;
    const rawHasOfcs =
      (domainDerived?.themedFindings?.some((f) => (f?.ofcText ?? '').trim().length > 0) ?? false) ||
      (domainDerived?.ofcs?.length ?? 0) > 0;
    const vmOfcCount = (inf.vulnerabilities ?? []).reduce((sum, v) => sum + (v.ofcs?.length ?? 0), 0);
    if (rawHasOfcs && vmOfcCount === 0) {
      throw new Error(
        `OFC binding lost for ${inf.code}: derived OFCs exist but ReportVM emitted none. Check resolveFindingOfcs and canonical block build.`
      );
    }
  }

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
    priority_actions: {
      title: 'Priority Actions',
      actions: [],
    },
    preflight,
  };
}
