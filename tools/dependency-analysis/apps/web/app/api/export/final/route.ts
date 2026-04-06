import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { parseAssessment, type Assessment } from 'schema';
import { migrateAssessmentItIsp } from '@/app/lib/dependencies/it_to_category_input';
import { ZodError } from 'zod';
import { buildSummary, assertExportReady, REQUIRED_ANCHORS } from 'engine';
import {
  getRepoRoot,
  getCanonicalTemplatePath,
  getWritableTempBase,
} from '@/app/lib/template/path';
import { existsSync } from 'fs';

/** Allow enough time for remote reporter (cold start + render); reporter uses template from disk (ADA/report template.docx), not base64. */
export const maxDuration = 300;

import { buildPart2ForReport } from '@/app/lib/export/build_part2_for_report';
import {
  buildReportThemedFindingsForExport,
  buildSessionsDerivedFromAssessment,
} from '@/app/lib/export/build_report_themed_findings';
import { buildCanonicalVulnBlocks } from '@/app/lib/export/canonical_vuln_blocks';
import { normalizeCurveInputsForExport } from '@/app/lib/export/normalize_curve_inputs';
import { migrateReportThemedFindingsFromCategories } from '@/app/lib/assessment/migrate_report_themed_findings';
import { purgeAll } from '@/app/lib/purge/purgeAll';
import { buildReportVMForReviewAndExport } from '@/app/lib/report/build_report_vm';
import { vmToExecutiveSnapshot, vmToSynthesis, vmToDependencyPayload } from '@/app/lib/report/vm_to_reporter_payload';
import { buildSectorFieldBullets } from '@/app/lib/report/cross_infrastructure_synthesis';
import { buildAnnexContent, countVulnerabilityBlocksInString } from '@/app/lib/report/annex_content_builder';
import { ExportQCError } from '@/app/lib/report/export_qc_error';
import { recordCheckpoint } from '@/app/lib/report/vulnerability/debug_checkpoints';
import { runVulnerabilityBlockQC, runExportConsistencyQC, runNarrativeRawKeyQC } from '@/app/lib/report/qc/check_vulnerability_blocks';
import {
  buildCoverageManifest,
  getUnaccountedKeys,
  assertCoverageComplete,
} from '@/app/lib/report/coverage_manifest';
import { buildCrossDependencySummary, buildCrossDependencyModuleFindings } from '@/app/lib/cross-dependencies/buildSummary';
import type { PriorityRestoration } from '@/app/lib/asset-dependency/priorityRestorationSchema';
import { assertReportBindingGuards, type ReportBlock } from '@/app/lib/dependencies/report_binding_guards';
import { evaluateConditions } from '@/app/lib/dependencies/evaluate_conditions';
import { DependencyVofcRepoFile } from '@/app/lib/dependencies/dependency_vofc_repo_file';
import { buildDependencySectionsFromRepo } from '@/app/lib/dependencies/build_dependency_sections_from_repo';
import { loadLibraryInjections, mergeLibraryOfcsIntoRows } from '@/app/lib/dependencies/merge_library_ofcs';
import { isPraSlaEnabled } from '@/lib/pra-sla-enabled';
import { isCrossDependencyEnabled } from '@/lib/cross-dependency-enabled';
import { applyModuleModifiers } from '@/app/lib/modules/apply_module_modifiers';
import { buildSlaReliabilityForReport, buildSlaPraSummaryForReport } from '@/app/lib/export/sla_report_helpers';
import { buildVofcCollectionFromAssessment } from '@/app/lib/vofc/build_vofc_collection';

/** Call remote reporter API (Railway, Render, etc.) when REPORT_SERVICE_URL is set on Vercel. */
async function callRemoteReporter(
  baseUrl: string,
  payload: object,
  requestId: string
): Promise<Uint8Array> {
  const url = `${baseUrl.replace(/\/$/, '')}/render`;
  // 120s to allow reporter API cold start (Railway/Render spin-up); render itself is 2–3s when warm
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const text = await res.text();
    let err: Record<string, unknown>;
    try {
      err = JSON.parse(text) as Record<string, unknown>;
    } catch {
      err = { error: text || res.statusText };
    }
    throw new Error(
      `Reporter API ${res.status}: ${(err.error as string) ?? (err.message as string) ?? text}`
    );
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

/** When PRA/SLA disabled, strip agreements and PRA/SLA provider data from categories so they do not appear in payload. */
function stripAgreementsAndPraSlaIfDisabled(raw: unknown): unknown {
  if (raw == null || typeof raw !== 'object') return raw;
  const obj = raw as Record<string, unknown>;
  const enabled = (obj.settings && typeof obj.settings === 'object')
    ? (obj.settings as Record<string, unknown>).pra_sla_enabled
    : undefined;
  const praSlaDisabled = enabled === false || enabled === 'false';
  if (!praSlaDisabled) return raw;
  const cats = obj.categories;
  if (!cats || typeof cats !== 'object' || Array.isArray(cats)) return raw;
  const entries = Object.entries(cats as Record<string, unknown>).map(([k, v]) => {
    const vObj = v != null && typeof v === 'object' ? { ...v } : {};
    const rec = vObj as Record<string, unknown>;
    delete rec.agreements;
    if (k === 'INFORMATION_TECHNOLOGY') {
      delete rec.pra_sla;
      delete rec.it_pra_sla_providers;
    }
    return [k, vObj];
  });
  return { ...obj, categories: Object.fromEntries(entries) };
}

/** Narrative tokens required for report (Phase 4). Must be resolved for every category with requires_service. */
const REQUIRED_NARRATIVE_TOKEN_KEYS = ['impact_onset_hours', 'functional_loss_percent', 'recovery_time_hours'] as const;
const ALLOWED_PERCENT_KEYS = new Set(['loss_fraction_no_backup', 'loss_fraction_with_backup']);

function buildNarrativeTokensForReport(summary: Array<{ category: string; time_to_impact_hours: number | null; recovery_time_hours: number | null; capacity_after_impact_no_backup: number }>): Record<string, { impact_onset_hours: number; functional_loss_percent: number; recovery_time_hours: number }> {
  const out: Record<string, { impact_onset_hours: number; functional_loss_percent: number; recovery_time_hours: number }> = {};
  for (const row of summary) {
    const lossPercent = Math.round(100 - row.capacity_after_impact_no_backup);
    out[row.category] = {
      impact_onset_hours: row.time_to_impact_hours ?? 0,
      functional_loss_percent: Math.max(0, Math.min(100, lossPercent)),
      recovery_time_hours: row.recovery_time_hours ?? 0,
    };
  }
  return out;
}

function assertNarrativeTokensResolved(
  assessment: { categories?: Record<string, { requires_service?: boolean }> },
  narrativeTokens: Record<string, { impact_onset_hours: number; functional_loss_percent: number; recovery_time_hours: number }>
): void {
  const chartCategories = ['ELECTRIC_POWER', 'COMMUNICATIONS', 'INFORMATION_TECHNOLOGY', 'WATER', 'WASTEWATER'];
  const errors: string[] = [];
  for (const cat of chartCategories) {
    const input = assessment.categories?.[cat];
    if (input?.requires_service !== true) continue;
    const tokens = narrativeTokens[cat];
    if (!tokens) {
      errors.push(`Category ${cat}: narrative tokens missing (impact_onset_hours, functional_loss_percent, recovery_time_hours)`);
      continue;
    }
    for (const key of REQUIRED_NARRATIVE_TOKEN_KEYS) {
      const val = tokens[key as keyof typeof tokens];
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        errors.push(`Category ${cat}: token ${key} is unresolved or invalid`);
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(`Report narrative tokens unresolved:\n${errors.join('\n')}`);
  }
}

/** Strip legacy backup_capacity_percent from categories before export (renamed to backup_capacity_pct). */
function stripLegacyPercentKeys(assessment: Assessment): void {
  const cats = assessment.categories ?? {};
  for (const data of Object.values(cats)) {
    if (!data || typeof data !== 'object') continue;
    const rec = data as Record<string, unknown>;
    if ('backup_capacity_percent' in rec) {
      delete rec.backup_capacity_percent;
    }
  }
}

function assertNoNonCurvePercentKeys(assessment: Assessment): void {
  if (!isDev()) return;
  const errors: string[] = [];
  const cats = assessment.categories ?? {};
  for (const [category, data] of Object.entries(cats)) {
    if (!data || typeof data !== 'object') continue;
    for (const key of Object.keys(data as Record<string, unknown>)) {
      if (!/percent/i.test(key)) continue;
      if (!ALLOWED_PERCENT_KEYS.has(key)) {
        errors.push(`${category}.${key}`);
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(`Non-curve percent keys detected in export: ${errors.join(', ')}`);
  }
}

function getRequestId(request: NextRequest): string {
  return request.headers.get('x-request-id') ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : `srv-${Date.now()}`);
}

function isDev(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function safeStackTop(stack?: string): string[] {
  if (!stack) return [];
  return stack.split('\n').slice(0, 12);
}

type ErrorPayload = {
  ok: false;
  code: string;
  message: string;
  request_id: string;
  failure_reason?: string;
  details?: Record<string, unknown>;
  debug?: { err: string; stack_top: string[]; timings?: Record<string, number> };
};

/** When set (comma-separated origins, or single FIELD_EXPORT_CORS_ORIGIN), allow browser POST from static field UI (hybrid DOCX). */
function applyExportFinalCors(res: NextResponse, request?: NextRequest) {
  if (!request) return;
  const fromList = (process.env.FIELD_EXPORT_CORS_ORIGINS?.trim() ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const single = process.env.FIELD_EXPORT_CORS_ORIGIN?.trim();
  const allow = single ? [...fromList, single] : fromList;
  if (allow.length === 0) return;
  const origin = request.headers.get('origin');
  if (!origin || !allow.includes(origin)) return;
  res.headers.set('Access-Control-Allow-Origin', origin);
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id');
  res.headers.set('Access-Control-Max-Age', '86400');
}

function jsonError(payload: ErrorPayload, status: number, request?: NextRequest): NextResponse {
  const res = NextResponse.json(payload, { status });
  applyExportFinalCors(res, request);
  return res;
}

export async function OPTIONS(request: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  applyExportFinalCors(res, request);
  if (!res.headers.get('Access-Control-Allow-Origin')) {
    return new NextResponse(null, { status: 403 });
  }
  return res;
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const timings: Record<string, number> = {};
  const t0 = Date.now();

  let workDir: string | null = null;
  let repoRoot = getRepoRoot();
  let templatePathUsed: string | null = null;

  try {
    timings.load_start = Date.now() - t0;
    if (isDev()) console.log(`[export/final] ${requestId} load_start`);

    const body = await request.json().catch(() => null);
    if (body == null || (body as { assessment?: unknown }).assessment == null) {
      return jsonError(
        {
          ok: false,
          code: 'MISSING_INPUT',
          message: 'Missing assessment. Send JSON body with an assessment object.',
          request_id: requestId,
        },
        400,
        request
      );
    }

    let raw = (body as { assessment: unknown }).assessment;
    raw = stripAgreementsAndPraSlaIfDisabled(raw);
    const energy_dependency = (body as { energy_dependency?: unknown }).energy_dependency;
    let assessment;
    try {
      assessment = parseAssessment(raw);
      migrateAssessmentItIsp(assessment as { categories?: Record<string, unknown> });
    } catch (e) {
      timings.validate = Date.now() - t0;
      if (e instanceof ZodError) {
        const issues = e.issues?.map((i) => ({ path: i.path, message: i.message })) ?? [];
        return jsonError(
          {
            ok: false,
            code: 'INVALID_ASSESSMENT',
            message: 'Assessment validation failed.',
            request_id: requestId,
            failure_reason: 'Validation failed',
            details: { issues },
            debug: isDev() ? { err: String(e), stack_top: safeStackTop(e.stack) } : undefined,
          },
          400,
          request
        );
      }
      throw e;
    }

    timings.load_assessment = Date.now() - t0;
    if (isDev()) console.log(`[export/final] ${requestId} load_assessment`);

    normalizeCurveInputsForExport(assessment);
    migrateReportThemedFindingsFromCategories(assessment);
    stripLegacyPercentKeys(assessment);
    assertNoNonCurvePercentKeys(assessment);

    const conditionCodes = evaluateConditions(assessment);
    const depVofcRepo = new DependencyVofcRepoFile();
    let depVofcRows = await depVofcRepo.getApprovedByConditionCodes(conditionCodes);
    if (process.env.ENABLE_LIBRARY_OFC_INJECTIONS === '1') {
      const libraryPayload = await loadLibraryInjections();
      depVofcRows = mergeLibraryOfcsIntoRows(depVofcRows, libraryPayload);
    }
    const dependency_sections = buildDependencySectionsFromRepo(depVofcRows);

    repoRoot = getRepoRoot();
    const tempBase = getWritableTempBase(repoRoot);
    workDir = path.join(tempBase, randomUUID());
    await fs.mkdir(workDir, { recursive: true });

    timings.assemble_start = Date.now() - t0;
    let vofcCollection = buildVofcCollectionFromAssessment(assessment);
    const summary = applyModuleModifiers(buildSummary(assessment), assessment.modules as Record<string, unknown> | undefined);
    if (energy_dependency != null && typeof energy_dependency === 'object') {
      const ed = energy_dependency as {
        vulnerabilities?: Array<{ id: string; text: string }>;
        ofcs?: Array<{ id: string; text: string; vulnerability_id: string }>;
      };
      if (ed.vulnerabilities?.length && ed.ofcs) {
        const ofcByVuln = new Map<string, string>();
        for (const o of ed.ofcs) {
          if (o.vulnerability_id && o.text) ofcByVuln.set(o.vulnerability_id, o.text);
        }
        const MAX_PER_CATEGORY = 4;
        const existingByCat = new Map<string, number>();
        for (const item of vofcCollection.items) {
          const c = item.category;
          existingByCat.set(c, (existingByCat.get(c) ?? 0) + 1);
        }
        const derivedItems: typeof vofcCollection.items = [];
        for (const v of ed.vulnerabilities) {
          const count = existingByCat.get('ELECTRIC_POWER') ?? 0;
          if (count >= MAX_PER_CATEGORY) break;
          const ofc = ofcByVuln.get(v.id);
          if (!ofc || !ofc.trim()) {
            throw new Error(`Missing OFC for energy vulnerability "${v.id}".`);
          }
          derivedItems.push({
            vofc_id: `derived-energy-${v.id}`,
            category: 'ELECTRIC_POWER',
            title: v.text,
            vulnerability: v.text,
            impact: null,
            option_for_consideration: ofc,
            base_severity: 'MODERATE',
            calibrated_severity: 'MODERATE',
            calibration_reason: null,
            applicability: 'CONFIRMED',
            origin: 'GENERATED',
          });
          existingByCat.set('ELECTRIC_POWER', count + 1);
        }
        vofcCollection = {
          ...vofcCollection,
          items: [...vofcCollection.items, ...derivedItems],
        };
      }
    }

    assertExportReady({
      assessment,
      summary,
      vofcs: vofcCollection,
      requiredAnchors: [...REQUIRED_ANCHORS],
    });

    const narrative_tokens = buildNarrativeTokensForReport(summary);
    assertNarrativeTokensResolved(assessment, narrative_tokens);

    const reportCoverageDebug = process.env.REPORT_COVERAGE_DEBUG === 'true';
    const coverageManifest = buildCoverageManifest(assessment);
    const unaccountedKeys = getUnaccountedKeys(coverageManifest);
    if (unaccountedKeys.length > 0 && !reportCoverageDebug) {
      const maxShow = 25;
      const sample = unaccountedKeys.slice(0, maxShow);
      const entries = sample.map((k) => {
        const c = coverageManifest.captured[k];
        return `${k} (sector: ${c?.sector ?? '?'}, source: ${c?.sourceQuestionId ?? '?'})`;
      });
      const msg =
        unaccountedKeys.length > maxShow
          ? `Coverage audit failed: ${unaccountedKeys.length} captured inputs unaccounted. First ${maxShow}: ${entries.join('; ')}`
          : `Coverage audit failed: captured inputs not represented or suppressed: ${entries.join('; ')}`;
      return jsonError(
        {
          ok: false,
          code: 'COVERAGE_AUDIT_FAILED',
          message: msg,
          request_id: requestId,
          failure_reason: 'Captured inputs not represented or suppressed',
          details: { unaccounted_count: unaccountedKeys.length, sample: entries },
        },
        400,
        request
      );
    }

    const praSlaEnabled = isPraSlaEnabled(assessment);
    const crossDependencyEnabled = isCrossDependencyEnabled(assessment);
    const sla_reliability_for_report = praSlaEnabled ? buildSlaReliabilityForReport(assessment) : undefined;
    const sla_pra_summary = praSlaEnabled ? buildSlaPraSummaryForReport(assessment) : undefined;
    const cross_dependency_summary = crossDependencyEnabled ? buildCrossDependencySummary(assessment) : null;
    const cross_dependency_modules = crossDependencyEnabled ? buildCrossDependencyModuleFindings(assessment) : [];

    const reportVM = buildReportVMForReviewAndExport(assessment, { templateReady: true });
    const executive_snapshot = vmToExecutiveSnapshot(reportVM);
    const synthesis = vmToSynthesis(reportVM, assessment);
    const priority_actions = reportVM.priority_actions;
    const {
      energy_dependency: vmEnergy,
      dependency_sections: vmDependencySections,
      vulnerability_index_rows: vmVulnIndex,
    } = vmToDependencyPayload(reportVM);
    // Build reportAssessment and Part II (and sessions.derived) before annex so QC can use part2.vulnerabilities when present.
    let reportAssessment: Assessment = praSlaEnabled
      ? assessment
      : {
          ...assessment,
          categories: Object.fromEntries(
            Object.entries(assessment.categories ?? {}).map(([k, v]) => [k, { ...v, agreements: undefined }])
          ) as Assessment['categories'],
        };
    buildReportThemedFindingsForExport(reportAssessment);
    const sessionsDerived = buildSessionsDerivedFromAssessment(reportAssessment);
    (reportAssessment as Record<string, unknown>).sessions = sessionsDerived;
    const { canonicalVulnBlocks, canonicalTotals } = buildCanonicalVulnBlocks(reportAssessment);
    const part2 = buildPart2ForReport(reportVM, reportAssessment, canonicalVulnBlocks);
    const reportVMForPayload = { ...reportVM, part2 };

    const annex = buildAnnexContent(reportVM);
    const renderedBlockCount = countVulnerabilityBlocksInString(annex.vulnerability_blocks);
    if (annex.evaluatedVulnBlockCount !== renderedBlockCount) {
      throw new ExportQCError(
        `Vulnerability drop detected between evaluation and render: evaluated=${annex.evaluatedVulnBlockCount}, rendered=${renderedBlockCount}.`
      );
    }
    const vulnCount = canonicalTotals.totalFindings;
    const vulnerability_count_summary_for_payload =
      vulnCount > 0
        ? `Total findings: ${vulnCount} vulnerability block${vulnCount !== 1 ? 's' : ''}.`
        : annex.vulnerability_count_summary;
    const expectedVulnTotal = vulnCount > 0 ? vulnCount : annex.evaluatedVulnBlockCount;
    const totalFromSummary = (() => {
      const m = vulnerability_count_summary_for_payload.match(/Total findings:\s*(\d+)/);
      return m ? parseInt(m[1], 10) : null;
    })();
    if (totalFromSummary !== null && totalFromSummary !== expectedVulnTotal) {
      throw new ExportQCError(
        `vuln_count_summary.total (${totalFromSummary}) != expected (${expectedVulnTotal}).`
      );
    }
    recordCheckpoint('before_reporter_injection', {
      triggered_ids: (reportVM.infrastructures ?? []).flatMap((i) => (i.vulnerabilities ?? []).map((v) => v.id).filter(Boolean)),
      domain_counts: (reportVM.infrastructures ?? []).reduce(
        (acc, i) => {
          const code = i.code as string;
          acc[code] = (i.vulnerabilities ?? []).length;
          return acc;
        },
        { ELECTRIC_POWER: 0, COMMUNICATIONS: 0, INFORMATION_TECHNOLOGY: 0, WATER: 0, WASTEWATER: 0, CROSS: 0 } as Record<string, number>
      ),
    });
    // Field-only: sector bullets only (no summarizing narrative). Matches synthesis payload when assessment provided.
    const sectorFieldBullets = buildSectorFieldBullets(assessment);
    const cross_infra_analysis =
      sectorFieldBullets.length > 0
        ? sectorFieldBullets.map((b) => `${b.label}: ${b.text}`).join('\n')
        : (reportVM.synthesis?.sections ?? [])
            .flatMap((s) => (s.paragraphs ?? []).map((p) => (typeof p === 'string' ? p : (p as { text?: string }).text ?? '')).filter(Boolean))
            .join('\n\n')
            .trim() || 'Cross-infrastructure analysis is informed by the synthesis section.';

    timings.assemble_sections = Date.now() - t0;
    if (isDev()) console.log(`[export/final] ${requestId} assemble_sections`);

    // QC: fail if vulnerability blocks would look like gibberish
    const energyBlocks = vmEnergy?.vulnerability_blocks ?? [];
    const energyQC = runVulnerabilityBlockQC(energyBlocks, 'Electric Power', 'ELECTRIC_POWER');
    if (!energyQC.ok) {
      throw new Error(`Vulnerability QC failed: ${energyQC.errors.join('; ')}`);
    }
    for (const sec of vmDependencySections) {
      const blocks = sec.vulnerability_blocks ?? [];
      const infraCode = (sec as { infraCode?: string }).infraCode ?? sec.name;
      const qc = runVulnerabilityBlockQC(blocks, sec.name, infraCode);
      if (!qc.ok) {
        throw new Error(`Vulnerability QC failed [${sec.name}]: ${qc.errors.join('; ')}`);
      }
    }
    const consistencyQC = runExportConsistencyQC(assessment, vmDependencySections);
    if (!consistencyQC.ok) {
      throw new Error(`Export consistency QC failed: ${consistencyQC.errors.join('; ')}`);
    }
    const synthesisNarratives = [
      ...(synthesis?.paragraphs ?? []),
      ...(synthesis?.bullets ?? []).map((b) => b.text),
    ].filter(Boolean);
    const narrativeQC = runNarrativeRawKeyQC(synthesisNarratives, 'synthesis');
    if (!narrativeQC.ok) {
      throw new Error(`Narrative QC failed: ${narrativeQC.errors.join('; ')}`);
    }

    if (energy_dependency != null && typeof energy_dependency === 'object') {
      const ed = energy_dependency as {
        vulnerabilities?: Array<{ id: string; text: string }>;
        ofcs?: Array<{ id: string; text: string; vulnerability_id: string }>;
        reportBlocks?: unknown[];
      };
      if (ed.vulnerabilities && ed.ofcs) {
        assertReportBindingGuards({
          vulnerabilities: ed.vulnerabilities,
          ofcs: ed.ofcs,
          reportBlocks: Array.isArray(ed.reportBlocks) ? (ed.reportBlocks as ReportBlock[]) : undefined,
        });
      }
    }

    const templatePath = getCanonicalTemplatePath(repoRoot);
    templatePathUsed = templatePath;

    const asset = assessment.asset as { psa_phone?: string; psa_cell?: string } | undefined;
    const psaPhone = (asset?.psa_phone ?? asset?.psa_cell ?? '').toString().trim();
    if (!psaPhone) {
      return jsonError(
        {
          ok: false,
          code: 'MISSING_PSA_PHONE',
          message: 'PSA phone number is required for export. Set asset.psa_cell or asset.psa_phone.',
          request_id: requestId,
          failure_reason: 'Required metadata missing',
        },
        400,
        request
      );
    }

    timings.render_start = Date.now() - t0;
    const exportDebug =
      new URL(request.url).searchParams.get('debug') === '1' || request.headers.get('x-export-debug') === '1';
    if (exportDebug) {
      (process.env as NodeJS.ProcessEnv).ADA_REPORTER_DEBUG = '1';
      console.log(`[export/final] ${requestId} debug=on template=${templatePath} workDir=${workDir}`);
    }
    if (isDev()) console.log(`[export/final] ${requestId} render_start`);
    // reportAssessment, part2, reportVMForPayload, vulnerability_count_summary_for_payload built before annex (above).
    const payload = {
      template_key: 'ada',
      assessment: reportAssessment,
      report_vm: reportVMForPayload,
      canonicalVulnBlocks,
      canonicalTotals,
      vofc_collection: vofcCollection,
      executive_snapshot,
      synthesis,
      ...(praSlaEnabled
        ? {
            sla_pra_module_enabled: true,
            sla_reliability_for_report,
            sla_pra_summary: sla_pra_summary ?? undefined,
          }
        : { sla_pra_module_enabled: false }),
      energy_dependency: vmEnergy.vulnerability_blocks.length > 0 ? vmEnergy : (energy_dependency ?? undefined),
      dependency_sections: vmDependencySections.length > 0 ? vmDependencySections : (dependency_sections.length ? dependency_sections : undefined),
      vulnerability_index_rows: vmVulnIndex.length > 0 ? vmVulnIndex : undefined,
      structural_profile_summary: annex.structural_profile_summary,
      vulnerability_count_summary: vulnerability_count_summary_for_payload,
      vulnerability_blocks: annex.vulnerability_blocks,
      cross_infra_analysis,
      narrative_tokens,
      cross_dependency_summary: crossDependencyEnabled ? (cross_dependency_summary ?? undefined) : undefined,
      cross_dependency_modules: crossDependencyEnabled ? (cross_dependency_modules.length ? cross_dependency_modules : undefined) : undefined,
      priority_actions,
    };

    // Tripwire: if template requires [[VULNERABILITY_BLOCKS]], payload must have non-empty vulnerability content (structured or legacy)
    const vulnBlocks = (payload as Record<string, unknown>).vulnerability_blocks;
    const hasVulnBlocks = typeof vulnBlocks === 'string' && (vulnBlocks as string).replace(/\u00a0/g, ' ').trim().length > 0;
    const reportVm = (payload as Record<string, unknown>).report_vm as { part2?: { vulnerabilities?: unknown[] } } | undefined;
    const hasStructuredVulns = Array.isArray(reportVm?.part2?.vulnerabilities) && reportVm.part2.vulnerabilities.length > 0;
    if (
      (REQUIRED_ANCHORS as readonly string[]).includes('[[VULNERABILITY_BLOCKS]]') &&
      !hasVulnBlocks &&
      !hasStructuredVulns
    ) {
      return jsonError(
        {
          ok: false,
          code: 'EXPORT_FAILED',
          message: 'Vulnerability blocks empty. Add vulnerability content or use a template without [[VULNERABILITY_BLOCKS]].',
          request_id: requestId,
          failure_reason: 'Vulnerability blocks empty',
        },
        400,
        request
      );
    }

    // Debug: dump payload to .debug/ when ADA_EXPORT_DEBUG_DUMP=1 (diagnostic only; does not affect behavior)
    if (process.env.ADA_EXPORT_DEBUG_DUMP === '1') {
      try {
        const debugDir = path.join(repoRoot, '.debug');
        await fs.mkdir(debugDir, { recursive: true });
        const dumpPath = path.join(debugDir, `export_payload_${Date.now()}.json`);
        const dump = {
          assessment: (payload as Record<string, unknown>).assessment,
          report_vm: (payload as Record<string, unknown>).report_vm,
          energy_dependency: (payload as Record<string, unknown>).energy_dependency,
          dependency_sections: (payload as Record<string, unknown>).dependency_sections,
          vulnerability_blocks: (payload as Record<string, unknown>).vulnerability_blocks,
        };
        await fs.writeFile(dumpPath, JSON.stringify(dump, null, 2), 'utf8');
        if (isDev()) console.log(`[export/final] ${requestId} debug dump: ${dumpPath}`);
      } catch (dumpErr) {
        if (isDev()) console.warn('[export/final] debug dump failed:', dumpErr);
      }
    }

    const reportServiceUrl = process.env.REPORT_SERVICE_URL?.trim();
    if (!reportServiceUrl) {
      return jsonError(
        {
          ok: false,
          code: 'EXPORT_NOT_AVAILABLE',
          message: 'DOCX export requires a hosted reporter service. Set REPORT_SERVICE_URL to the Railway ADA reporter endpoint.',
          request_id: requestId,
          failure_reason: 'Hosted reporter not configured',
        },
        503,
        request
      );
    }
    const docxBytes = await callRemoteReporter(reportServiceUrl, payload, requestId);

    timings.render_docx = Date.now() - t0;
    if (isDev()) console.log(`[export/final] ${requestId} render_docx`);
    await purgeAll(repoRoot);
    timings.persist_artifact = Date.now() - t0;
    if (isDev()) console.log(`[export/final] ${requestId} persist_artifact`);

    const okRes = new NextResponse(new Uint8Array(docxBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="Infrastructure-Dependency-Tool-Report.docx"',
        'X-Request-Id': requestId,
      },
    });
    applyExportFinalCors(okRes, request);
    return okRes;
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    const stderr = (e as Error & { reporterStderr?: string }).reporterStderr;
    const stdout = (e as Error & { reporterStdout?: string }).reporterStdout;
    let message = stderr ? `Reporter failed: ${stderr}` : (err.message || 'Export failed');
    console.error(`[export/final] ${requestId} export failed:`, message);
    console.error(`[export/final] ${requestId} repo_root=${repoRoot} template_path=${templatePathUsed ?? '(not reached)'}`);
    if (stderr) console.error(`[export/final] ${requestId} reporter stderr:`, stderr);
    if (stdout) console.error(`[export/final] ${requestId} reporter stdout:`, stdout);
    const isNarrativeTokens = (err.message?.includes('narrative tokens') ?? false) || (err.message?.includes('Narrative tokens') ?? false);
    const isExportQC = e instanceof ExportQCError;
    const isValidation =
      e instanceof ZodError ||
      (err.message?.includes('assertExportReady') ?? false) ||
      (err.message?.includes('Export not ready') ?? false) ||
      isNarrativeTokens ||
      isExportQC;
    const code = e instanceof ZodError
      ? 'INVALID_ASSESSMENT'
      : isExportQC
        ? 'EXPORT_QC_FAILED'
        : err.message?.includes('assertExportReady') || err.message?.includes('Export not ready')
          ? 'EXPORT_NOT_READY'
          : isNarrativeTokens
            ? 'EXPORT_NOT_READY'
            : 'EXPORT_FAILED';

    const status = isValidation || code === 'INVALID_ASSESSMENT' ? 400 : 500;
    const payload: ErrorPayload = {
      ok: false,
      code,
      message,
      request_id: requestId,
      failure_reason: message,
    };
    payload.details = {};
    if (e instanceof ZodError && e.issues?.length) {
      (payload.details as Record<string, unknown>).issues = e.issues?.map((i) => ({ path: i.path, message: i.message }));
    }
    if (stderr) (payload.details as Record<string, unknown>).reporter_stderr = stderr;
    if (stdout) (payload.details as Record<string, unknown>).reporter_stdout = stdout;
    if (status === 500 && !stderr) (payload.details as Record<string, unknown>).error_message = err.message;
    (payload.details as Record<string, unknown>).repo_root = repoRoot;
    if (templatePathUsed != null) (payload.details as Record<string, unknown>).template_path = templatePathUsed;
    if (isDev()) {
      payload.debug = {
        err: String(err),
        stack_top: safeStackTop(err.stack),
        timings: Object.keys(timings).length > 0 ? timings : undefined,
        ...(stderr ? { reporter_stderr: stderr } : {}),
      };
    }
    return jsonError(payload, status, request);
  } finally {
    if (workDir) await rmSafe(workDir);
    try {
      await purgeAll(repoRoot);
    } catch (_) {}
  }
}

function norm(s: string): string {
  return (s ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Compare canonical vuln blocks to reporter-rendered manifest. Returns null if match; else short actionable message.
 * Includes vuln_id in each mismatch so export fails with a clear pointer to the finding.
 */
function diffCanonicalVulnToRendered(
  canonical: Array<{ vuln_id?: string; title: string; narrative: string; ofcText: string }>,
  rendered: Array<{ title: string; narrative: string; ofcText: string }>
): string | null {
  if (canonical.length !== rendered.length) {
    return `count mismatch: canonical=${canonical.length} rendered=${rendered.length}`;
  }
  const parts: string[] = [];
  for (let i = 0; i < canonical.length; i++) {
    const c = canonical[i];
    const r = rendered[i];
    const vid = (c.vuln_id ?? '').trim() || `#${i + 1}`;
    if (norm(c.title) !== norm(r.title)) parts.push(`vuln_id ${vid}: title mismatch`);
    if (norm(c.narrative) !== norm(r.narrative)) parts.push(`vuln_id ${vid}: narrative mismatch`);
    if (norm(c.ofcText) !== norm(r.ofcText)) parts.push(`vuln_id ${vid}: OFC mismatch`);
  }
  return parts.length > 0 ? parts.join('; ') : null;
}

async function rmSafe(p: string) {
  try {
    await fs.rm(p, { recursive: true });
  } catch (_) {}
}
