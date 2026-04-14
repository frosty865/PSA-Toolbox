/**
 * ReportViewModel builder: transforms Assessment + VOFC data into report-structured format.
 * Used by exporters to compose narrative reports without direct assessment access.
 * No internal IDs (question IDs, VOFC IDs) in output.
 */

import type { Assessment, CategoryCode, CrossDependencyEdge } from 'schema';
import type { CitationRef } from './citations/registry';
import { compileCitations } from './citations/registry';
import {
  evaluateVulnerabilities,
  evaluateCrossDependencyVulnerabilities,
  type TriggeredVulnerability,
  extractKeyRiskDrivers,
  type KeyRiskDriverVM,
  type InfraId,
  computeTriggerDensitySummary,
  type TriggerDensitySummary,
} from './vulnerability';
import { evaluateVulnerabilitiesByCategory } from '@/app/lib/vuln/evaluate_question_vulnerabilities';
import { buildSynthesis, type SynthesisSection } from './synthesis_builder';
import { buildExecutiveRiskPostureSnapshot, type ExecutiveRiskPostureSnapshotVM } from './snapshot_builder';
import type { Snapshot } from './snapshot';
import { mapEngineToSnapshot } from './mapToSnapshot';
import { isPraSlaEnabled } from '@/lib/pra-sla-enabled';
import { isCrossDependencyEnabled } from '@/lib/cross-dependency-enabled';
import { CROSS_DEPENDENCY_MODULES, mergeModulesState, type ModulesState } from '@/app/lib/modules/registry';
import { deriveOtIcsModule } from '@/app/lib/modules/ot_ics_resilience_derive';
import { formatPaceLayerForSummary } from '@/app/lib/dependencies/infrastructure/comms_spec';
import { buildCurveWorkbookAligned } from '@/app/lib/charts/curveClient';
import { buildCommsPaceForVM, type CommsPaceVM } from '@/app/lib/report/comms_pace_vm';
import { buildCoverageManifest } from '@/app/lib/report/coverage_manifest';
import {
  normalizeDependencyConditions,
  mergeNormalizedIntoAnswers,
  type SectorConditions,
} from '@/app/lib/report/normalize_conditions';
import {
  evaluateVulnerabilitiesFromConditions,
} from '@/app/lib/report/vulnerability/evaluate_from_conditions';
import { buildRedundancyActivationExposure, buildElectricSingleFeedExposure } from '@/app/lib/report/vulnerability/condition_trigger_map';
import { describeTransportConcentration, getTransportConcentrationInput } from '@/app/lib/report/transport_concentration';
import { dedupeByRootCause, dedupeByVulnerabilityId } from '@/app/lib/report/vulnerability/dedupe_rules';
import { isCanonicalSector } from '@/app/lib/report/vulnerability/canonical_sectors';
import { assertTriggerCoverage } from '@/app/lib/report/vulnerability/trigger_coverage_assertion';
import {
  recordCheckpoint,
  domainCountsFromNormalized,
  domainCountsAndIdsFromInfrastructures,
  buildVulnOfcSummary,
} from '@/app/lib/report/vulnerability/debug_checkpoints';
import { getCrossDependenciesNode } from '@/app/lib/cross-dependencies/normalize';
import { computeDerivedFlags, detectCascadeChains, formatCascadeChain, formatCircularPath } from '@/app/lib/cross-dependencies/deriveFlags';
import { formatHours } from './format_hours';
import {
  buildItExternalServices,
  buildItCascadeNarrative,
  type ItConditions,
} from '@/app/lib/report/it_services_builder';

const IS_PROD = process.env.NODE_ENV === 'production';

const TRANSPORT_TYPE_BY_INFRA: Partial<Record<InfraId, 'VOICE_TRANSPORT' | 'DATA_TRANSPORT'>> = {
  COMMUNICATIONS: 'VOICE_TRANSPORT',
  INFORMATION_TECHNOLOGY: 'DATA_TRANSPORT',
};

const NARRATIVE_FORBIDDEN_TERMS: Partial<Record<CategoryCode, string[]>> = {
  COMMUNICATIONS: ['internet', 'isp', 'wan', 'sd-wan', 'broadband', 'data circuit'],
  INFORMATION_TECHNOLOGY: ['pri', 'sip trunk', 'analog line', 'dispatch line', 'radio', 'p25', 'lmrs'],
};

function filterByTransportType(
  infraId: InfraId,
  vulnerabilities: TriggeredVulnerability[]
): TriggeredVulnerability[] {
  const expected = TRANSPORT_TYPE_BY_INFRA[infraId];
  if (!expected) return vulnerabilities;

  return vulnerabilities.filter((vuln) => {
    const actual = vuln.config.transport_type ?? 'missing';
    const ok = vuln.config.transport_type === expected;
    if (!ok) {
      const message = `Transport type mismatch for ${vuln.config.id} in ${infraId}: ${actual} (expected ${expected})`;
      if (!IS_PROD) {
        throw new Error(message);
      }
      console.error(message);
    }
    return ok;
  });
}

function filterBlendedDrivers(drivers: KeyRiskDriver[]): KeyRiskDriver[] {
  return drivers.filter((driver) => {
    const hasComms = driver.infrastructures.includes('COMMUNICATIONS');
    const hasIt = driver.infrastructures.includes('INFORMATION_TECHNOLOGY');
    if (hasComms && hasIt) {
      const message = `Blended driver detected: ${driver.title}`;
      if (!IS_PROD) {
        throw new Error(message);
      }
      console.error(message);
      return false;
    }
    return true;
  });
}

function enforceNarrativeVocabulary(code: CategoryCode, texts: string[]): void {
  const forbidden = NARRATIVE_FORBIDDEN_TERMS[code];
  if (!forbidden || forbidden.length === 0) return;

  const haystack = texts.join(' ').toLowerCase();
  for (const term of forbidden) {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(haystack)) {
      const message = `Forbidden term "${term}" found in ${code} narrative.`;
      if (!IS_PROD) {
        throw new Error(message);
      }
      console.error(message);
      return;
    }
  }
}

/**
 * Severity levels for risk drivers and infrastructure summaries.
 */
export type SeverityLevel = 'IMMEDIATE' | 'SHORT_TERM' | 'DELAYED' | 'STRATEGIC';

/**
 * A single curve summary for one infrastructure.
 * Numeric fields are optional so blank assessments show no placeholder values.
 * Prescribed Agency math: capacity % + loss % = 100 (so capacity_pct = 100 - loss_*_pct).
 */
export type CurveSummary = {
  /** Infrastructure name (e.g., "Electric Power", "Communications"). */
  infra: string;
  /** Severity inferred from curve inputs. */
  severity: SeverityLevel;
  /** Time to impact in hours (undefined when not answered). */
  time_to_impact_hr?: number;
  /** Loss without backup as percent (0–100). Capacity without = 100 - this value. */
  loss_no_backup_pct?: number;
  /** Whether facility has backup capability (undefined when not answered). */
  backup_available?: boolean;
  /** Backup duration in hours (if available). */
  backup_duration_hr?: number;
  /** Loss with backup as percent (if available). Capacity with backup = 100 - this value. */
  loss_with_backup_pct?: number;
  /** Recovery time in hours (undefined when not answered). */
  recovery_hr?: number;
  /** Curve data points for graphing. Format: [{ hour: number; loss_pct: number }]. */
  curve_points?: Array<{ hour: number; loss_pct: number }>;
};

/**
 * Key risk driver callout (for Hotel Fact Sheet infographic).
 * Re-exported from key_risk_driver_engine for convenience.
 */
export type KeyRiskDriver = KeyRiskDriverVM;

/**
 * @deprecated Use KeyRiskDriver (aliased to KeyRiskDriverVM)
   Now populated from triggered vulnerability system.
 */
export type InfrastructureFinding = {
  /** Heading (vulnerability title). */
  title: string;
  /** Narrative describing the finding (1–2 paragraphs). */
  narrative: string;
  /** Optional citations. */
  citations?: CitationRef[];
  /** Optional triggered_by explanation (for debugging). */
  triggered_by?: string;
};

/**
 * Option for Consideration (OFC) - rendered under each vulnerability.
 */
export type OptionForConsideration = {
  id: string;
  title: string;
  text: string;
};

/**
 * Evaluated vulnerability for report output.
 * Replaces Structural Findings + Analytical Considerations with single Vulnerabilities section.
 */
export type EvaluatedVulnerability = {
  id: string;
  title: string;
  summary: string;
  /** Citation IDs from citations_registry (optional for legacy evaluator output). */
  citations?: string[];
  ofcs: OptionForConsideration[];
  /** Canonical render fields (when available). Composed into narrative or rendered as separate sections. */
  condition_identified?: string;
  operational_exposure?: string;
  why_this_matters?: string;
  /** Driver category for section labeling (STRUCTURAL | CAPABILITY | GOVERNANCE | ACTIVATION). */
  driverCategory?: string;
  /** Root cause key for dedupe QC. */
  rootCauseKey?: string;
};

/**
 * Canonical vulnerability block for report rendering.
 * All vulnerability output must conform to this contract.
 * - Narrative appears once.
 * - OFCs rendered only under "Options for Consideration" heading.
 * - References appear after OFCs.
 */
export type RenderedVulnerabilityBlock = {
  title: string;
  narrative: string;
  ofcs: string[]; // max 4
  references: string[];
};

/**
 * Analytical Consideration: a best-practice or mitigation option.
 * Presented as citation-backed narrative paragraph.
 */
export type AnalyticalConsiderationVM = {
  /** Consideration ID (internal reference, not shown to user). */
  id: string;
  /** Short heading. */
  heading: string;
  /** Single narrative paragraph (200-600 chars). */
  narrative: string;
  /** Citations backing this consideration. */
  citations: CitationRef[];
  /** Paragraphs of narrative. */
  paragraphs: Array<{
    text: string;
    citations?: CitationRef[];
  }>;
};

/**
 * Dependency edge (cross-dependency link).
 */
export type EdgeVM = {
  /** Source infrastructure code (e.g., "ELECTRIC_POWER"). */
  from: string;
  /** Target infrastructure code. */
  to: string;
  /** Time-to-cascade bucket. */
  timing_sensitivity: SeverityLevel;
  /** Brief rationale. */
  rationale?: string;
};

/**
 * Dependency matrix heatmap metadata.
 */
export type HeatmapVM = {
  /** List of all infrastructure codes in matrix. */
  infras: string[];
  /** Confirmed edges list. */
  edges: EdgeVM[];
};

/** PACE layer key (Communications only). Re-exported from comms_pace_vm. */
export type { CommsPaceVM, PaceCurvePoint, PaceLayerVM } from './comms_pace_vm';
export type PaceLayerKey = 'PRIMARY' | 'ALTERNATE' | 'CONTINGENCY' | 'EMERGENCY';

/**
 * Single infrastructure report section.
 */
export type InfrastructureSection = {
  /** Infrastructure code (e.g., "ELECTRIC_POWER"). */
  code: CategoryCode;
  /** Display name (e.g., "Electric Power"). */
  display_name: string;
  /** Impact curve summary. */
  curve: CurveSummary;
  /** Optional intro narrative (purpose/scope for this infrastructure). */
  intro?: { title: string; purpose: string };
  /** Triggered findings (narrative). @deprecated Use vulnerabilities instead. */
  findings: InfrastructureFinding[];
  /** 1–2 sentence sensitivity summary. */
  sensitivity_summary?: string;
  /** Raw triggered vulnerabilities (for debugging; not rendered). */
  _triggered_vulnerabilities?: TriggeredVulnerability[];
  /** Analytical Considerations (best practices / VOFC-derived narratives). @deprecated Use vulnerabilities instead. */
  analytical_considerations: AnalyticalConsiderationVM[];
  /** Vulnerabilities (title + summary + up to 3 OFCs each). Replaces Structural Findings + Analytical Considerations. */
  vulnerabilities: EvaluatedVulnerability[];
  /** Communications only: PACE plan summary (Primary: X; Alternate: Y; …). */
  pace_summary?: string;
  /** Communications only: PACE model (layers + curves for chart/narrative). */
  pace?: CommsPaceVM;
  /** Communications only: Interoperability and restoration coordination. */
  coordination_summary?: string;
  /** Resilience strengths (strong posture findings). Shown in Main under "Resilience Strengths". */
  resilience_notes?: Array<{ id: string; title: string; description: string }>;
  /** IT only: external critical services (Office 365, Azure AD, etc.) with cascade effects. */
  external_services?: Array<{
    name: string;
    service_type: string;
    supports_functions: string[];
    relies_on: string[];
    cascade_effect: string;
    criticality: 'HIGH' | 'MED' | 'LOW';
  }>;
  /** IT only: 2–4 sentence cascade narrative. */
  cascade_narrative?: string;
};

/**
 * Module findings (for cross-dependencies, if enabled).
 */
export type ModuleFinding = {
  module_name: string;
  title: string;
  narrative: string;
  citations?: CitationRef[];
};

/**
 * Cross-dependency section.
 */
export type CrossDependencySection = {
  /** Display name. */
  display_name: string;
  /** Confirmed edges list (if available). */
  confirmed_edges?: EdgeVM[];
  /** Triggered cross-dependency findings. */
  cascading_conditions?: Array<{ title: string; narrative: string; citations?: CitationRef[] }>;
  /** Module findings (if modules enabled). */
  module_findings?: ModuleFinding[];
  /** Posture summary (key facts and flags). */
  posture_summary: Array<{ label: string; value: string }>;
  /** Raw triggered cross-dependency vulnerabilities (for debugging). */
  _triggered_vulnerabilities?: TriggeredVulnerability[];
  /** Analytical Considerations. */
  analytical_considerations: AnalyticalConsiderationVM[];
};

/**
 * Risk Posture Synthesis section.
 * Re-exported from synthesis_builder for convenience.
 */
export type { SynthesisSection };

/**
 * @deprecated Use direct import from synthesis_builder
  }>;
};

/**
 * Methodology section.
 */
export type MethodologySection = {
  heading: string;
  sections: Array<{
    heading: string;
    paragraphs: string[];
  }>;
};

/**
 * Appendix data.
 */
export type AppendicesSection = {
  /** Curve input values per infrastructure. */
  curve_inputs: Array<{
    infra: string;
    items: Array<{ label: string; value: string }>;
  }>;
  /** Compiled, de-duplicated cited references. */
  citations_used: CitationRef[];
  /** Dependency graph (nodes and edges for diagram generation). */
  dependency_graph: {
    nodes: Array<{ id: string; label: string }>;
    edges: Array<{ from: string; to: string; label?: string }>;
  };
  /** Module summaries if modules are enabled. */
  module_summaries?: Array<{
    name: string;
    summary: string;
  }>;
};

/**
 * Top-level report view model.
 * Exactly matches the narrative report structure.
 */
export type ReportVM = {
  /** Report metadata. */
  meta: {
    org_name?: string;
    site_name?: string;
    generated_at: string; // ISO timestamp
    version: string; // TOOL_VERSION
  };

  /** Hotel Fact Sheet / security overview. */
  executive: {
    hotel_fact_sheet?: {
      sections: Array<{
        heading: string;
        lines: string[];
      }>;
    };
    purpose_scope: string; // 1–2 sentences
    curve_summaries: CurveSummary[]; // All 5+ infrastructure summaries
    key_risk_drivers: KeyRiskDriver[]; // up to 3 callouts (unique labels, deduplicated)
    citations?: CitationRef[];
    vulnerabilities?: Array<{
      sector: string;
      title: string;
      narrative: string;
      citations?: CitationRef[];
    }>;
    cross_dependency_overview: {
      confirmed_edges: EdgeVM[];
      heatmap: HeatmapVM;
    };
    /** One-page risk posture snapshot (drivers, matrix, cascading). */
    risk_posture_snapshot?: ExecutiveRiskPostureSnapshotVM;
    /** When set, 3-paragraph executive narrative (classification, drivers in sentence form, TTI exposure). No driver labels. */
    executive_risk_posture_narrative?: string[];
  };

  /** Executive Risk Posture Snapshot (one-page executive summary). */
  snapshot: Snapshot;

  /** Infrastructure sections (ordered: Energy, Comms, IT, Water, Wastewater). */
  infrastructures: InfrastructureSection[];

  /** Cross-Dependency & Cascading Risk section. */
  cross_dependency: CrossDependencySection;

  /** Risk Posture Synthesis. */
  synthesis: SynthesisSection;

  /** Methodology. */
  methodology: MethodologySection;

  /** Appendices. */
  appendices: AppendicesSection;

  /** Feature flags for report rendering (PRA gating, etc.). */
  featureFlags: {
    praEnabled: boolean;
    slaEnabled?: boolean;
    crossDependencyEnabled?: boolean;
  };

  /** Vulnerability section grouping: by_driver (collapse multi-sector) or by_sector (sector headers). Default by_driver. */
  vuln_grouping_mode?: 'by_driver' | 'by_sector';

  /**
   * Coverage audit manifest (captured / represented / suppressed).
   * Proves every captured input is either represented or intentionally suppressed.
   */
  coverage?: import('./coverage_manifest').CoverageManifest;

  /**
   * Debug payload (optional, only populated when process.env.NEXT_PUBLIC_REPORT_DEBUG === "1").
   * Not rendered in main report output.
   */
  debug?: {
    /** Trigger density diagnostics for QC gating. */
    triggerDensity?: TriggerDensitySummary;
  };
};

/**
 * Factory function: convert Assessment + VOFCs + other context into ReportVM.
 * This function centralizes all report data transformation.
 * 
 * NOW INTEGRATED: Vulnerability evaluation system for findings and considerations.
 */
export function buildReportVM(
  assessment: Assessment,
  _vofcLibraryPath?: string
): ReportVM {
  const now = new Date().toISOString();
  const toolVersion = process.env.TOOL_VERSION ?? '0.1.0';

  const featureFlags = {
    praEnabled: isPraSlaEnabled(assessment),
    crossDependencyEnabled: isCrossDependencyEnabled(assessment),
  };

  // Map of infrastructure code to InfraId for vulnerability evaluator
  const infraCodeToId: Record<string, 'ELECTRIC_POWER' | 'COMMUNICATIONS' | 'INFORMATION_TECHNOLOGY' | 'WATER' | 'WASTEWATER'> = {
    'ELECTRIC_POWER': 'ELECTRIC_POWER',
    'COMMUNICATIONS': 'COMMUNICATIONS',
    'INFORMATION_TECHNOLOGY': 'INFORMATION_TECHNOLOGY',
    'WATER': 'WATER',
    'WASTEWATER': 'WASTEWATER',
  };

  // Build infrastructure sections with vulnerability evaluation
  const infrastructures: InfrastructureSection[] = [];
  const allCitations: CitationRef[] = [];
  const allTriggeredVulns: Array<{ infra: InfraId; vulnerabilities: TriggeredVulnerability[] }> = [];

  const { normalized: normalizedConditions, accounting: normalizeAccounting } = normalizeDependencyConditions(assessment);

  recordCheckpoint('after_normalization', {
    triggered_ids: [],
    domain_counts: domainCountsFromNormalized(normalizedConditions),
  });

  const allowUnmapped = process.env.REPORT_ALLOW_UNMAPPED_KEYS === 'true';
  if (normalizeAccounting.unmappedKeys.length > 0 && !allowUnmapped) {
    const sample = normalizeAccounting.unmappedKeys.slice(0, 10).join(', ');
    const msg =
      normalizeAccounting.unmappedKeys.length > 10
        ? `Unmapped assessment keys (${normalizeAccounting.unmappedKeys.length}): ${sample}... Set REPORT_ALLOW_UNMAPPED_KEYS=true to bypass.`
        : `Unmapped assessment keys: ${sample}. Set REPORT_ALLOW_UNMAPPED_KEYS=true to bypass.`;
    throw new Error(msg);
  }

  const {
    vulnerabilities: conditionVulns,
    resilienceNotes: allResilienceNotes,
    triggeredConditions,
  } = evaluateVulnerabilitiesFromConditions(normalizedConditions, { praEnabled: featureFlags.praEnabled });

  recordCheckpoint('after_condition_vulns', {
    triggered_ids: conditionVulns.map((v) => v.config?.id).filter(Boolean) as string[],
    vuln_ofc_summary: buildVulnOfcSummary(conditionVulns),
  });

  assertTriggerCoverage(triggeredConditions, conditionVulns);

  const conditionVulnsBySector = new Map<string, typeof conditionVulns>();
  for (const v of conditionVulns) {
    const s = v.sector ?? v.config.infra_id ?? 'UNKNOWN';
    if (!conditionVulnsBySector.has(s)) conditionVulnsBySector.set(s, []);
    conditionVulnsBySector.get(s)!.push(v);
  }

  const resilienceBySector = new Map<string, typeof allResilienceNotes>();
  for (const r of allResilienceNotes) {
    const s = r.sector;
    if (!resilienceBySector.has(s)) resilienceBySector.set(s, []);
    resilienceBySector.get(s)!.push(r);
  }

  // Category data: prefer categories, fallback to dependencies (legacy fixtures)
  const categorySource = assessment.categories ?? (assessment as { dependencies?: Record<string, unknown> }).dependencies ?? {};

  // Process each infrastructure — always emit section (stub when no data) for COMMS/IT transport separation
  for (const [code, infraId] of Object.entries(infraCodeToId)) {
    const categoryData = categorySource[code as CategoryCode] as Record<string, unknown> | undefined;
    const hasData = categoryData && typeof categoryData === 'object' && Object.keys(categoryData).length > 0;

    if (!hasData) {
      const stubSection: InfrastructureSection = {
        code: code as CategoryCode,
        display_name: getDisplayName(code as CategoryCode),
        curve: { infra: getDisplayName(code as CategoryCode), severity: 'DELAYED' },
        findings: [],
        analytical_considerations: [],
        vulnerabilities: [],
        intro: { title: 'Overview', purpose: '' },
      };
      infrastructures.push(stubSection);
      continue;
    }

    // Extract answers for this infrastructure. Category may store curve as curve_* or CategoryInput-style keys.
    const rawAnswers: Record<string, unknown> = normalizeCategoryToCurveAnswers({ ...categoryData } as Record<string, unknown>);
    const sectorKey = code as keyof typeof normalizedConditions;
    const sectorCond = normalizedConditions[sectorKey] as SectorConditions | undefined;
    const answers = mergeNormalizedIntoAnswers(
      rawAnswers,
      sectorCond,
      sectorKey
    );

    // Evaluate vulnerabilities (uses normalized-condition-aware answers)
    const evalResult = evaluateVulnerabilities({
      infraId,
      answers,
      featureFlags,
    });

    const catalogVulns = filterByTransportType(
      infraId,
      evalResult.triggered_vulnerabilities
    );
    const sectorConditionVulns = conditionVulnsBySector.get(infraId) ?? [];
    // Canonical sectors: use condition vulns only (no catalog overlap, no mixed-mode)
    const merged = isCanonicalSector(infraId)
      ? sectorConditionVulns
      : [...sectorConditionVulns, ...catalogVulns];
    const triggeredVulnerabilities = isCanonicalSector(infraId)
      ? dedupeByVulnerabilityId(merged)
      : dedupeByRootCause(merged);

    const curveContext = buildCurveContextFromAnswers(answers);

    // Track triggered vulnerabilities for key risk driver extraction
    allTriggeredVulns.push({
      infra: infraId,
      vulnerabilities: triggeredVulnerabilities,
    });

    // Convert triggered vulnerabilities to findings (legacy)
    const findings: InfrastructureFinding[] = triggeredVulnerabilities.map((vuln) => ({
      title: vuln.config.short_name,
      narrative: `${vuln.condition_summary}${curveContext ? ` ${curveContext}` : ''}`,
      citations: vuln.citations,
      triggered_by: vuln.triggered_by,
    }));

    // Build vulnerabilities: canonical sectors use condition-driven; others prefer question-driven when available
    const categoryCode = code as 'ELECTRIC_POWER' | 'COMMUNICATIONS' | 'INFORMATION_TECHNOLOGY' | 'WATER' | 'WASTEWATER';
    const questionDrivenVulns = evaluateVulnerabilitiesByCategory(categoryCode, answers as Record<string, unknown>, featureFlags);
    const useConditionDriven = isCanonicalSector(infraId) && triggeredVulnerabilities.length > 0;
    const isActivationDelayVuln = (id: string) =>
      id.endsWith('_ALTERNATE_MANUAL_VENDOR_INIT') ||
      id === 'ENERGY_ACTIVATION_MANUAL_TRANSFER_OR_GEN' ||
      id === 'COND_ELECTRIC_POWER_ALTERNATE_MANUAL_VENDOR_INIT' ||
      id === 'COND_COMMUNICATIONS_ALTERNATE_MANUAL_VENDOR_INIT' ||
      id === 'COND_INFORMATION_TECHNOLOGY_ALTERNATE_MANUAL_VENDOR_INIT' ||
      id === 'COND_WATER_ALTERNATE_MANUAL_VENDOR_INIT' ||
      id === 'COND_WASTEWATER_ALTERNATE_MANUAL_VENDOR_INIT';
    const categoryRa = categoryData && typeof categoryData === 'object' ? (categoryData as Record<string, unknown>).redundancy_activation as Parameters<typeof buildRedundancyActivationExposure>[0] : undefined;
    const redundancyActivationExposure = buildRedundancyActivationExposure(categoryRa);
    const cat = categoryData as Record<string, unknown> | undefined;
    const electricHasBackup = cat?.curve_backup_available === true || cat?.curve_backup_available === 'yes' || (cat?.has_backup as boolean) === true;
    const backupDurationHours = typeof (cat?.backup_duration_hours ?? cat?.curve_backup_duration_hours) === 'number'
      ? (cat?.backup_duration_hours ?? cat?.curve_backup_duration_hours) as number
      : undefined;
    const electricSingleFeedExposure = code === 'ELECTRIC_POWER'
      ? buildElectricSingleFeedExposure({ hasBackup: electricHasBackup, backupDurationHours: backupDurationHours ?? null })
      : undefined;

    const vulnerabilities: EvaluatedVulnerability[] =
      useConditionDriven || (questionDrivenVulns.length === 0 && triggeredVulnerabilities.length > 0)
        ? triggeredVulnerabilities.map((vuln) => {
            const ofcs = (vuln.considerations ?? []).slice(0, 4).map((c) => ({
              id: c.id,
              title: c.heading ?? c.title ?? 'Consideration',
              text: c.paragraphs?.[0]?.text ?? c.narrative ?? '',
            }));
            const citationIds = (vuln.citations ?? []).map((c) => (typeof c === 'string' ? c : c.key));
            let operational_exposure = vuln.operational_exposure;
            if (isActivationDelayVuln(vuln.config.id) && redundancyActivationExposure) {
              operational_exposure = redundancyActivationExposure;
            } else if (vuln.config.id === 'ENERGY_STRUCT_SINGLE_SERVICE_FEED' && electricSingleFeedExposure) {
              operational_exposure = electricSingleFeedExposure;
            } else if (vuln.config.id === 'IT-TRANSPORT-01' && categoryData) {
              const transportSentence = describeTransportConcentration(getTransportConcentrationInput(categoryData as Record<string, unknown>));
              if (transportSentence) operational_exposure = transportSentence;
            }
            const why_this_matters = buildContextualWhyThisMatters(
              code as CategoryCode,
              vuln.why_this_matters,
              operational_exposure,
              answers
            );
            const parts: string[] = [vuln.condition_identified, operational_exposure, why_this_matters].filter((s): s is string => Boolean(s));
            const summary = parts.length > 0 ? parts.join(' ') : `${vuln.condition_summary}${curveContext ? ` ${curveContext}` : ''}`;
            return {
              id: vuln.config.id,
              title: vuln.config.short_name,
              summary,
              citations: citationIds.length > 0 ? citationIds : undefined,
              ofcs,
              condition_identified: vuln.condition_identified,
              operational_exposure,
              why_this_matters,
              driverCategory: vuln.config.canonicalDriver,
              rootCauseKey: vuln.rootCauseKey ?? vuln.config.rootCauseKey,
            };
          })
        : questionDrivenVulns.map((v) => ({
            id: v.id,
            title: v.title,
            summary: v.summary,
            citations: v.citations,
            ofcs: (v.ofcs ?? []).slice(0, 4).map((o) => ({ id: o.id, title: o.title, text: o.text })),
          }));

    const finalVulnerabilities: EvaluatedVulnerability[] = vulnerabilities;

    // Flatten considerations from consideration library
    const allConsiderations: AnalyticalConsiderationVM[] = [];
    const seenConsiderationIds = new Set<string>();
    for (const vuln of triggeredVulnerabilities) {
      for (const consideration of vuln.considerations) {
        if (!seenConsiderationIds.has(consideration.id)) {
          seenConsiderationIds.add(consideration.id);
          
          // Extract all text and citations from paragraphs
          const heading = consideration.heading || consideration.title || 'Untitled';
          const allText = consideration.paragraphs 
            ? consideration.paragraphs.map(p => p.text).join(' ')
            : (consideration.narrative || '');
          const allCitations = consideration.paragraphs 
            ? consideration.paragraphs.flatMap(p => p.citations || [])
            : (consideration.citations || []);
          const paragraphs = consideration.paragraphs || [
            {
              text: consideration.narrative || '',
              citations: consideration.citations && consideration.citations.length > 0 ? (consideration.citations as any as CitationRef[]) : undefined,
            }
          ];
          
          allConsiderations.push({
            id: consideration.id,
            heading,
            narrative: allText, // Flatten paragraphs for legacy compatibility
            citations: allCitations as any as CitationRef[],
            paragraphs: paragraphs.map(p => ({
              text: p.text,
              citations: p.citations && p.citations.length > 0 ? (p.citations as any as CitationRef[]) : undefined,
            })),
          });
        }
      }
    }

    // Collect all citations
    for (const vuln of triggeredVulnerabilities) {
      allCitations.push(...vuln.citations);
    }

    // Build curve summary from answers; no placeholder defaults (blank = undefined)
    const timeToImpact = answers.curve_time_to_impact_hours as number | undefined;
    const lossNoBackup = answers.curve_loss_fraction_no_backup as number | undefined;
    const recoveryHr = answers.curve_recovery_time_hours as number | undefined;
    const categoryInput = answers as Parameters<typeof buildCurveWorkbookAligned>[0];
    const curvePointsRaw = buildCurveWorkbookAligned(categoryInput);
    const hasBackup = answers.curve_backup_available === true || answers.curve_backup_available === 'yes';
    const ra = (answers as Record<string, unknown>).redundancy_activation as { mode?: string; activation_delay_min?: number | null } | undefined;
    const delayMin = ra?.activation_delay_min;
    const delayHr = delayMin != null && Number.isFinite(delayMin) && delayMin > 0 ? delayMin / 60 : null;
    if (hasBackup && delayHr != null && delayHr > 0 && curvePointsRaw.length > 0) {
      const epsilon = 0.01;
      const hasPointAtDelay = curvePointsRaw.some((p) => Math.abs(p.t_hours - delayHr) < epsilon);
      if (!hasPointAtDelay) {
        throw new Error(
          `QC: activation_delay_min=${delayMin}min (${delayHr}h) but curve_points has no point at delayHr. ` +
            `Ensure transition segment is included. Points sample: ${curvePointsRaw.slice(0, 5).map((p) => `(${p.t_hours},${p.capacity_with_backup})`).join(' ')}`
        );
      }
    }
    const curve_points =
      curvePointsRaw.length > 0
        ? curvePointsRaw.map((p) => ({
            hour: p.t_hours,
            loss_pct: 100 - (hasBackup ? p.capacity_with_backup : p.capacity_without_backup),
          }))
        : undefined;
    const curveSummary: CurveSummary = {
      infra: getDisplayName(code as CategoryCode),
      severity: 'DELAYED', // Derive from curve when present
      ...(typeof timeToImpact === 'number' && !Number.isNaN(timeToImpact) && { time_to_impact_hr: timeToImpact }),
      ...(typeof lossNoBackup === 'number' && !Number.isNaN(lossNoBackup) && { loss_no_backup_pct: lossNoBackup * 100 }),
      ...(answers.curve_backup_available !== undefined && { backup_available: answers.curve_backup_available === true || answers.curve_backup_available === 'yes' }),
      ...(typeof (answers.curve_backup_duration_hours ?? (categoryData as Record<string, unknown>)?.backup_duration_hours) === 'number' &&
        !Number.isNaN((answers.curve_backup_duration_hours ?? (categoryData as Record<string, unknown>)?.backup_duration_hours) as number) && {
        backup_duration_hr: (answers.curve_backup_duration_hours ?? (categoryData as Record<string, unknown>)?.backup_duration_hours) as number,
      }),
      ...(typeof answers.curve_loss_fraction_with_backup === 'number' && !Number.isNaN(answers.curve_loss_fraction_with_backup as number) && { loss_with_backup_pct: (answers.curve_loss_fraction_with_backup as number) * 100 }),
      ...(typeof recoveryHr === 'number' && !Number.isNaN(recoveryHr) && { recovery_hr: recoveryHr }),
      ...(curve_points != null && curve_points.length > 0 && { curve_points }),
    };

    enforceNarrativeVocabulary(
      code as CategoryCode,
      [
        ...findings.map((finding) => finding.narrative),
        ...allConsiderations.map((consideration) => consideration.narrative),
      ]
    );

    const sectorResilience = resilienceBySector.get(infraId) ?? [];
    const sectionPayload: InfrastructureSection = {
      code: code as CategoryCode,
      display_name: getDisplayName(code as CategoryCode),
      curve: curveSummary,
      findings,
      analytical_considerations: allConsiderations,
      vulnerabilities: finalVulnerabilities,
      _triggered_vulnerabilities: triggeredVulnerabilities,
      resilience_notes: sectorResilience.length > 0
        ? sectorResilience.map((r) => ({ id: r.id, title: r.short_name, description: r.description }))
        : undefined,
      intro: {
        title: 'Overview',
        purpose: buildRelianceIntroSentence(code as CategoryCode, answers),
      },
    };

    if (code === 'COMMUNICATIONS' && categoryData && typeof categoryData === 'object') {
      const data = categoryData as Record<string, unknown>;
      const paceLabels = (['P', 'A', 'C', 'E'] as const).map((l) =>
        formatPaceLayerForSummary(data[`comm_pace_${l}`] as Parameters<typeof formatPaceLayerForSummary>[0])
      );
      const layerNames = ['Primary', 'Alternate', 'Contingency', 'Emergency'];
      sectionPayload.pace_summary = layerNames
        .map((name, i) => `${name}: ${paceLabels[i] ?? '—'}`)
        .join('; ');
      const paceModel = buildCommsPaceForVM(categoryData);
      if (paceModel) sectionPayload.pace = paceModel;
      const interop = data.comm_interoperability;
      const coord = data.comm_restoration_coordination;
      const parts: string[] = [];
      if (interop != null && String(interop).length > 0) parts.push(`Interoperability: ${String(interop).replace(/_/g, ' ')}`);
      if (coord != null && String(coord).length > 0) parts.push(`Restoration coordination: ${String(coord)}`);
      if (parts.length > 0) sectionPayload.coordination_summary = parts.join('. ');
    }

    if (code === 'INFORMATION_TECHNOLOGY' && categoryData && typeof categoryData === 'object') {
      const data = categoryData as Record<string, unknown>;
      const supply = data.supply as { has_alternate_source?: boolean; sources?: unknown[] } | undefined;
      const hasAlternate = supply?.has_alternate_source === true && (supply.sources?.length ?? 0) >= 2;
      const rawHrs = data.curve_backup_duration_hours ?? data.backup_duration_hours;
      const backupHrs = hasAlternate && typeof rawHrs === 'number' && Number.isFinite(rawHrs) ? rawHrs : null;
      const itConditions: ItConditions = {
        single_path: data['IT-3_multiple_connections'] !== 'yes',
        alternate_present: hasAlternate,
        alternate_short_duration: backupHrs != null && backupHrs < 24,
        alternate_sustainment_hr: backupHrs,
        primary_provider: (data.curve_primary_provider as string) ?? null,
        connection_labels: ((data['IT-4_service_connections'] as Array<{ connection_label?: string }>) ?? [])
          .map((c) => c.connection_label ?? '')
          .filter(Boolean),
      };
      const externalServices = buildItExternalServices(assessment, itConditions);
      sectionPayload.external_services = externalServices;
      sectionPayload.cascade_narrative = buildItCascadeNarrative(externalServices, itConditions);
    }

    infrastructures.push(sectionPayload);
  }

  recordCheckpoint('after_trigger_evaluation', domainCountsAndIdsFromInfrastructures(infrastructures));

  // Evaluate cross-dependency vulnerabilities
  const mergedAnswers: Record<string, unknown> = {};
  for (const [, data] of Object.entries(categorySource)) {
    if (data && typeof data === 'object') Object.assign(mergedAnswers, data);
  }
  const crossDepEval = evaluateCrossDependencyVulnerabilities({
    infraId: 'CROSS_DEPENDENCY',
    answers: mergedAnswers,
    featureFlags,
  });

  allTriggeredVulns.push({
    infra: 'CROSS_DEPENDENCY',
    vulnerabilities: crossDepEval.triggered_vulnerabilities,
  });

  // Build strictly fact-based cross-dependency findings from recorded edges/derived flags.
  const crossDepFindings = buildFactBasedCrossDependencyFindings(assessment);

  // Flatten cross-dep considerations
  const crossDepConsiderations: AnalyticalConsiderationVM[] = [];
  const seenCrossDepIds = new Set<string>();
  for (const vuln of crossDepEval.triggered_vulnerabilities) {
    for (const consideration of vuln.considerations) {
      if (!seenCrossDepIds.has(consideration.id)) {
        seenCrossDepIds.add(consideration.id);
        // Extract all text and citations from paragraphs (support both old and new formats)
        const heading = consideration.heading || consideration.title || 'Untitled';
        const allText = consideration.paragraphs 
          ? consideration.paragraphs.map(p => p.text).join(' ')
          : (consideration.narrative || '');
        const allCitations = consideration.paragraphs 
          ? consideration.paragraphs.flatMap(p => p.citations || [])
          : (consideration.citations || []);
        const paragraphs = consideration.paragraphs || [
          {
            text: consideration.narrative || '',
            citations: consideration.citations && consideration.citations.length > 0 ? (consideration.citations as any as CitationRef[]) : undefined,
          }
        ];
        
        crossDepConsiderations.push({
          id: consideration.id,
          heading,
          narrative: allText,
          citations: allCitations as any as CitationRef[],
          paragraphs: paragraphs.map(p => ({
            text: p.text,
            citations: p.citations && p.citations.length > 0 ? (p.citations as any as CitationRef[]) : undefined,
          })),
        });
      }
    }
  }

  // Extract key risk drivers from all triggered vulnerabilities
  const curveSummaries = infrastructures.map((i) => i.curve);
  let keyRiskDrivers = filterBlendedDrivers(
    extractKeyRiskDrivers(allTriggeredVulns, curveSummaries)
  );
  // When hosted services exist but survivability is not evaluated, add driver (no vulnerability)
  if (normalizedConditions?.INFORMATION_TECHNOLOGY?.hosted_continuity_unevaluated) {
    keyRiskDrivers = [
      ...keyRiskDrivers,
      {
        title: 'Hosted continuity not evaluated',
        narrative:
          'One or more hosted dependencies do not have a continuity assessment. Evaluate survivability (no survivability, manual fallback, or local mirror) for each primary hosted service.',
        severity: 'MODERATE',
        infrastructures: ['INFORMATION_TECHNOLOGY'] as const,
      },
    ];
  }

  // Build synthesis section from key risk drivers and normalized conditions
  const synthesis = buildSynthesis({
    drivers: keyRiskDrivers,
    allTriggered: allTriggeredVulns.flatMap((tv) => tv.vulnerabilities),
    infraCurves: curveSummaries,
    normalizedConditions,
  });

  // Compute trigger density diagnostics (debug only)
  const isDebugMode = process.env.NEXT_PUBLIC_REPORT_DEBUG === '1';
  const triggerDensity = isDebugMode
    ? computeTriggerDensitySummary({
        triggeredVulns: allTriggeredVulns.flatMap((tv) => tv.vulnerabilities),
        keyRiskDrivers,
      })
    : undefined;

  // Deduplicate all citations
  const dedupedCitations = deduplicateCitations(allCitations);

  // Extract module findings if modules are enabled
  const moduleFindings: ModuleFinding[] = [];
  const modulesState = mergeModulesState(assessment.modules as ModulesState | undefined);
  for (const mod of CROSS_DEPENDENCY_MODULES) {
    const state = modulesState[mod.module_code];
    if (!state?.enabled) continue;

    // Derive module findings
    if (mod.module_code === 'MODULE_OT_ICS_RESILIENCE') {
      const derivedMod = deriveOtIcsModule(state.answers ?? {});
      for (const vuln of derivedMod.vulnerabilities) {
        moduleFindings.push({
          module_name: mod.title,
          title: vuln.title,
          narrative: vuln.text,
          citations: [], // Module findings don't currently have citations
        });
      }
    }
  }

  // Count findings by type
  const findingsCount = computeFindingsCount(allTriggeredVulns.flatMap(tv => tv.vulnerabilities));

  // Count citations coverage from report vulnerabilities (question-driven + legacy)
  const reportVulns = infrastructures.flatMap((i) => i.vulnerabilities ?? []);
  const citationCoverage = computeCitationCoverage(reportVulns);

  // Cross-dependency confirmed edges: only when toggle is ON; map schema edges to EdgeVM
  const confirmedEdges = isCrossDependencyEnabled(assessment)
    ? mapCrossDependencyEdgesToVM(getCrossDependenciesNode(assessment).edges ?? [])
    : [];

  // Build ReportVM first
  const reportVM = {
    meta: {
      org_name: assessment.asset?.asset_name || undefined,
      site_name: assessment.asset?.asset_name || undefined,
      generated_at: now,
      version: toolVersion,
    },
    executive: {
      hotel_fact_sheet: buildHotelFactSheet(assessment),
      purpose_scope: 'This assessment evaluates the hotel\'s physical security maturity, exposure around entrances and approach paths, and vulnerabilities that could materially reduce protection of the building envelope and protected areas. The analysis integrates observed conditions, vulnerability triggers, and mitigations to define the facility\'s security posture.',
      curve_summaries: infrastructures.map((i) => i.curve),
      key_risk_drivers: keyRiskDrivers,
      vulnerabilities: infrastructures.flatMap((infra) =>
        (infra.vulnerabilities ?? []).map((v) => ({
          sector: infra.display_name,
          title: v.title,
          narrative: v.summary,
          citations: v.citations ? compileCitations(v.citations) : [],
        }))
      ),
      cross_dependency_overview: {
        confirmed_edges: confirmedEdges,
        heatmap: {
          infras: infrastructures.map((i) => i.code),
          edges: confirmedEdges,
        },
      },
      risk_posture_snapshot: buildExecutiveRiskPostureSnapshot({
        keyRiskDrivers,
        infraCurves: infrastructures.map((i) => i.curve),
      }),
    },
    snapshot: {} as Snapshot, // Will be populated below
    infrastructures,
    cross_dependency: {
      display_name: 'Cross-Dependency & Cascading Risk',
      confirmed_edges: confirmedEdges,
      cascading_conditions: crossDepFindings,
      module_findings: moduleFindings.length > 0 ? moduleFindings : undefined,
      analytical_considerations: crossDepConsiderations,
      posture_summary: [],
      _triggered_vulnerabilities: crossDepEval.triggered_vulnerabilities,
    },
    synthesis,
    methodology: {
      heading: 'Methodology',
      sections: [],
    },
    appendices: {
      curve_inputs: [], // TODO: Extract from answers
      citations_used: dedupedCitations,
      dependency_graph: {
        nodes: infrastructures.map((i) => ({ id: i.code, label: i.display_name })),
        edges: [],
      },
    },
    featureFlags,
    coverage: buildCoverageManifest(assessment),
    debug: isDebugMode
      ? {
          triggerDensity,
        }
      : undefined,
  };

  // Populate snapshot by mapping from reportVM
  const snapshotInput = {
    meta: reportVM.meta,
    executive: reportVM.executive,
    infrastructures: reportVM.infrastructures,
    cross_dependency: reportVM.cross_dependency,
    synthesis: reportVM.synthesis,
    toggles: {
      pra_sla: isPraSlaEnabled(assessment),
      cross_dependency: isCrossDependencyEnabled(assessment),
    },
    findings_count: findingsCount,
    trigger_density: triggerDensity,
    citation_coverage: citationCoverage,
  };
  reportVM.snapshot = mapEngineToSnapshot(snapshotInput);

  return reportVM;
}

/** Map schema CrossDependencyEdge to report EdgeVM; only when cross-dependency is enabled. */
function mapCrossDependencyEdgesToVM(edges: CrossDependencyEdge[]): EdgeVM[] {
  const bucketToSeverity: Record<string, SeverityLevel> = {
    immediate: 'IMMEDIATE',
    short: 'SHORT_TERM',
    medium: 'DELAYED',
    long: 'STRATEGIC',
    unknown: 'DELAYED',
  };
  return edges.map((e) => ({
    from: e.from_category,
    to: e.to_category,
    timing_sensitivity: (bucketToSeverity[e.time_to_cascade_bucket] ?? 'DELAYED') as SeverityLevel,
    rationale: e.notes ?? undefined,
  }));
}

/**
 * Build opening sentence for an infrastructure section: reliance and primary provider.
 * Each infrastructure section begins with this; no SAFE or generator language.
 */
function buildRelianceIntroSentence(code: CategoryCode, answers: Record<string, unknown>): string {
  const relies = answers.curve_requires_service !== false && answers.curve_requires_service !== undefined;
  const provider = answers.curve_primary_provider;
  const providerStr = typeof provider === 'string' && provider.trim() ? provider.trim() : '';

  const labels: Record<CategoryCode, { rely: string; notRely: string }> = {
    ELECTRIC_POWER: { rely: 'electric power', notRely: 'electric power for core operations' },
    COMMUNICATIONS: { rely: 'primary voice/telephony service', notRely: 'communications (voice/telephony) for core operations' },
    INFORMATION_TECHNOLOGY: { rely: 'internet/data connectivity', notRely: 'information technology (internet/data) for core operations' },
    WATER: { rely: 'water', notRely: 'water for core operations' },
    WASTEWATER: { rely: 'wastewater', notRely: 'wastewater for core operations' },
    CRITICAL_PRODUCTS: { rely: 'critical products', notRely: 'critical products for core operations' },
  };
  const { rely, notRely } = labels[code] ?? { rely: 'this infrastructure', notRely: 'this infrastructure for core operations' };

  if (!relies) {
    return `This facility does not rely on ${notRely}.`;
  }
  if (providerStr) {
    return `This facility relies on ${rely}. Primary provider: ${providerStr}.`;
  }
  return `This facility relies on ${rely}.`;
}

function buildHotelFactSheet(assessment: Assessment): {
  sections: Array<{ heading: string; lines: string[] }>;
} {
  const categories = assessment.categories ?? {};
  const sec = categories.ELECTRIC_POWER as Record<string, unknown> | undefined;
  const comms = categories.COMMUNICATIONS as Record<string, unknown> | undefined;
  const it = categories.INFORMATION_TECHNOLOGY as Record<string, unknown> | undefined;
  const water = categories.WATER as Record<string, unknown> | undefined;
  const ww = categories.WASTEWATER as Record<string, unknown> | undefined;

  const text = (...values: unknown[]): string => {
    for (const v of values) {
      if (v == null) continue;
      const s = String(v).trim();
      if (s) return s;
    }
    return 'Not provided';
  };

  const yesNo = (v: unknown): string => {
    if (v === true) return 'Yes';
    if (v === false) return 'No';
    const s = String(v ?? '').trim();
    return s ? s : 'Not provided';
  };

  const num = (v: unknown): string => {
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    const s = String(v ?? '').trim();
    return s ? s : 'Not provided';
  };

  const sections: Array<{ heading: string; lines: string[] }> = [];
  const assetName = text(assessment.asset?.asset_name, (assessment.asset as { name?: string } | undefined)?.name, (assessment.asset as { facility_name?: string } | undefined)?.facility_name);

  sections.push({
    heading: 'Property Profile',
    lines: [
      `Property name: ${assetName}`,
      'Assessment focus: Physical security maturity and low-resistance access paths',
    ],
  });

  sections.push({
    heading: 'Entrances and Envelope',
    lines: [
      `Perimeter barriers: ${yesNo(sec?.has_perimeter_barriers)}`,
      `Street standoff distance: ${num(sec?.standoff_street_distance)}`,
      `Electronic locking system present: ${yesNo(sec?.els_present)}`,
      `Dedicated VIP entrance: ${text(sec?.vip_entrance_type)}`,
      `VIP access control method: ${text(sec?.vip_access_control)}`,
      `Monitoring hours: ${text(sec?.monitoring_hours)}`,
    ],
  });

  sections.push({
    heading: 'Parking and Vehicle Approach',
    lines: [
      `Surface parking control: ${text(sec?.surface_parking_control)}`,
      `Garage parking control: ${text(sec?.garage_parking_control)}`,
      `Surface parking lighting: ${text(sec?.surface_parking_lighting)}`,
      `Garage parking lighting: ${text(sec?.garage_parking_lighting)}`,
      `Vehicle barrier coverage: ${text(sec?.standoff_vehicle_barriers, sec?.vehicle_barrier_rating)}`,
    ],
  });

  sections.push({
    heading: 'Vertical Circulation and Public Areas',
    lines: [
      `Elevator security: ${yesNo(sec?.els_present)}`,
      `Stairwell security: ${yesNo(sec?.els_present)}`,
      `Lobby monitoring: ${text(sec?.vss_monitored_by)}`,
      `Public area monitoring: ${text(sec?.vss_monitored_by)}`,
      `Guest room access control: ${yesNo(sec?.els_present)}`,
    ],
  });

  const lowResistance: string[] = [];
  if (sec?.has_perimeter_barriers === 'No' || sec?.has_perimeter_barriers === false) lowResistance.push('no perimeter barriers');
  if (sec?.surface_parking_control === 'Open Access') lowResistance.push('open surface parking');
  if (sec?.garage_parking_control === 'None') lowResistance.push('uncontrolled garage access');
  if (typeof sec?.standoff_street_distance === 'number' && Number(sec.standoff_street_distance) < 25) lowResistance.push('short street standoff');
  if (sec?.monitoring_hours === 'Business Hours' || sec?.monitoring_hours === 'On-Demand') lowResistance.push('limited monitoring hours');
  if (sec?.els_present === 'No' || sec?.els_present === false) lowResistance.push('no electronic access control');

  sections.push({
    heading: 'Path of Least Resistance',
    lines: [
      lowResistance.length > 0
        ? `Likely low-resistance approach conditions: ${lowResistance.join(', ')}.`
        : 'Not enough physical-security detail is captured to isolate a single low-resistance path.',
    ],
  });

  const support: string[] = [];
  if (comms?.vss_monitored_by || it?.vss_monitored_by) support.push('video surveillance monitoring');
  if (it?.secforce_247) support.push('24/7 security force presence');
  if (water?.W_Q17_pump_alarming || ww?.WW_Q11_pump_alarming) support.push('utility alarm coverage');
  if (support.length > 0) {
    sections.push({
      heading: 'Supporting Security Systems',
      lines: support.map((s) => `Present or indicated: ${s}.`),
    });
  }

  return { sections };
}

const CURVE_ANSWER_KEYS = [
  'curve_requires_service',
  'curve_time_to_impact_hours',
  'curve_loss_fraction_no_backup',
  'curve_backup_available',
  'curve_backup_duration_hours',
  'curve_loss_fraction_with_backup',
  'curve_recovery_time_hours',
] as const;

/**
 * Normalize category data so curve_* keys are present for report/display.
 * Promotes answers.curve_* to top when top.curve_* is missing (so IT and all categories
 * use curve values from answers for curve build and QC).
 */
function normalizeCategoryToCurveAnswers(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  const answers = (out.answers as Record<string, unknown> | undefined) ?? {};
  for (const key of CURVE_ANSWER_KEYS) {
    if (out[key] === undefined && answers[key] !== undefined) {
      (out as Record<string, unknown>)[key] = answers[key];
    }
  }
  // So curve builder sees activation_delay_min for QC (point at delayHr)
  if (out.redundancy_activation === undefined && answers.redundancy_activation !== undefined) {
    (out as Record<string, unknown>).redundancy_activation = answers.redundancy_activation;
  }
  if (out.curve_requires_service === undefined && out.requires_service !== undefined) {
    out.curve_requires_service = out.requires_service;
  }
  if (out.curve_time_to_impact_hours === undefined && out.time_to_impact_hours !== undefined) {
    out.curve_time_to_impact_hours = out.time_to_impact_hours;
  }
  if (out.curve_loss_fraction_no_backup === undefined && out.loss_fraction_no_backup !== undefined) {
    out.curve_loss_fraction_no_backup = out.loss_fraction_no_backup;
  }
  const backup = out.curve_backup_available ?? out.has_backup_any ?? out.has_backup;
  if (out.curve_backup_available === undefined && backup !== undefined) {
    out.curve_backup_available = backup;
  }
  if (out.curve_backup_duration_hours === undefined && out.backup_duration_hours !== undefined) {
    out.curve_backup_duration_hours = out.backup_duration_hours;
  }
  if (out.curve_loss_fraction_with_backup === undefined && out.loss_fraction_with_backup !== undefined) {
    out.curve_loss_fraction_with_backup = out.loss_fraction_with_backup;
  }
  if (out.curve_recovery_time_hours === undefined && out.recovery_time_hours !== undefined) {
    out.curve_recovery_time_hours = out.recovery_time_hours;
  }
  return out;
}

/**
 * Build minimal curve context sentence from answers.
 */
function buildCurveContextFromAnswers(answers: Record<string, unknown>): string {
  const parts: string[] = [];

  const timeToImpact = answers.curve_time_to_impact_hours as number | undefined;
  const lossNoBackup = answers.curve_loss_fraction_no_backup as number | undefined;

  if (typeof timeToImpact === 'number') {
    parts.push(`Time to impact: ${formatHours(timeToImpact)}.`);
  }

  if (typeof lossNoBackup === 'number') {
    const pct = Math.round(lossNoBackup * 100);
    parts.push(`Loss without backup: ${pct}%.`);
  }

  return parts.join(' ');
}

function buildFactBasedCrossDependencyFindings(
  assessment: Assessment
): Array<{ title: string; narrative: string; citations?: CitationRef[] }> {
  const node = getCrossDependenciesNode(assessment);
  if (!node.edges || node.edges.length === 0) return [];

  const derived = node.derived ?? computeDerivedFlags(node.edges);
  const findings: Array<{ title: string; narrative: string; citations?: CitationRef[] }> = [];

  for (const cycle of derived.circular_dependencies ?? []) {
    if (!cycle.path || cycle.path.length < 2) continue;
    findings.push({
      title: 'Circular Dependency Confirmed',
      narrative: `Confirmed cycle from recorded edges: ${formatCircularPath(cycle.path)}.`,
    });
  }

  for (const spof of derived.common_mode_spof ?? []) {
    const supporting = node.edges.filter(
      (edge) =>
        edge.from_category === spof.upstream_category &&
        edge.criticality === 'critical' &&
        (edge.single_path === 'yes' || edge.single_path === 'unknown')
    );
    const affected = Array.from(new Set(supporting.map((edge) => edge.to_category)));
    if (supporting.length === 0 || affected.length === 0) continue;
    findings.push({
      title: 'Common-Mode Single Point of Failure (SPoF)',
      narrative: `${spof.upstream_category.replace(/_/g, ' ')} has ${supporting.length} critical single-path edge(s) affecting ${affected
        .map((cat) => cat.replace(/_/g, ' '))
        .join(', ')}.`,
    });
  }

  const fastCascadeEdges = node.edges
    .filter((edge) => edge.criticality === 'critical' && (edge.time_to_cascade_bucket === 'immediate' || edge.time_to_cascade_bucket === 'short'))
    .slice(0, 3);
  for (const edge of fastCascadeEdges) {
    findings.push({
      title: 'Fast Cascading Dependency Confirmed',
      narrative: `${edge.from_category.replace(/_/g, ' ')} → ${edge.to_category.replace(/_/g, ' ')} is marked critical with ${edge.time_to_cascade_bucket} cascade timing.`,
    });
  }

  const chains = detectCascadeChains(node.edges, 4).slice(0, 3);
  for (const chain of chains) {
    findings.push({
      title: 'Downstream Cascading Path Confirmed',
      narrative: `Confirmed dependency chain from recorded edges: ${formatCascadeChain(chain)}.`,
    });
  }

  return findings;
}

function isGenericWhyThisMatters(text: string | undefined): boolean {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return true;
  return (
    t.includes('support continuity planning') ||
    t.includes('improves recovery time') ||
    t.includes('reduces concentrated failure exposure') ||
    t.includes('reduces operational exposure') ||
    t.includes('extends operational tolerance') ||
    t.includes('supports recovery')
  );
}

function buildContextualWhyThisMatters(
  infraCode: CategoryCode,
  rawWhy: string | undefined,
  operationalExposure: string | undefined,
  answers: Record<string, unknown>
): string | undefined {
  const display = getDisplayName(infraCode);
  const tti = typeof answers.curve_time_to_impact_hours === 'number' ? answers.curve_time_to_impact_hours : undefined;
  const recovery = typeof answers.curve_recovery_time_hours === 'number' ? answers.curve_recovery_time_hours : undefined;
  const loss = typeof answers.curve_loss_fraction_no_backup === 'number' ? Math.round(answers.curve_loss_fraction_no_backup * 100) : undefined;
  const baseline = (rawWhy ?? '').trim();
  const includeBaseline = baseline.length > 0 && !isGenericWhyThisMatters(baseline);

  const urgency =
    typeof tti === 'number'
      ? tti <= 1
        ? 'This is an immediate resilience priority.'
        : tti <= 4
          ? 'This is a near-term resilience priority.'
          : 'This is a material resilience priority.'
      : 'This is a material resilience priority.';

  const metricParts: string[] = [];
  if (typeof tti === 'number') metricParts.push(`severe impact can begin in ${formatHours(tti)}`);
  if (typeof loss === 'number') metricParts.push(`modeled loss can reach about ${loss}% without alternate capability`);
  if (typeof recovery === 'number') metricParts.push(`recovery can require about ${formatHours(recovery)} after restoration`);
  const metricSentence = metricParts.length > 0 ? `${display}: ${metricParts.join('; ')}.` : '';

  const exposure = (operationalExposure ?? '').trim().toLowerCase();
  const exposureLever =
    exposure.includes('single') || exposure.includes('concentration')
      ? 'adding path diversity and reducing single-point dependence'
      : exposure.includes('alternate') || exposure.includes('backup')
        ? 'adding validated alternate capability'
        : exposure.includes('coordination') || exposure.includes('restoration')
          ? 'tightening restoration coordination and escalation readiness'
          : 'closing this gap with tested continuity measures';
  const valueHooksByInfra: Record<CategoryCode, Record<string, string>> = {
    ELECTRIC_POWER: {
      single: 'Single-feed power risk can stall mission-critical functions before manual workarounds can stabilize operations.',
      alternate: 'Validated alternate power pathways protect critical loads and preserve continuity of operations during upstream outages.',
      coordination: 'Faster restoration coordination reduces prolonged load shedding and limits compounding operational disruption.',
      default: 'Power resilience controls directly affect facility uptime, life-safety support systems, and recovery tempo.',
    },
    COMMUNICATIONS: {
      single: 'Single-path communications failures can delay command decisions and degrade incident coordination across stakeholders.',
      alternate: 'Alternate transport paths improve communications survivability when primary carrier routes fail.',
      coordination: 'Clear provider coordination and escalation routes reduce outage duration and handoff friction.',
      default: 'Communications resilience drives decision speed, coordination reliability, and operational control during disruption.',
    },
    INFORMATION_TECHNOLOGY: {
      single: 'Single-route IT dependencies can interrupt application access and identity workflows at the worst possible moment.',
      alternate: 'Alternate connectivity and continuity controls protect access to hosted systems when primary paths fail.',
      coordination: 'Provider and internal escalation readiness reduces restoration uncertainty for critical digital services.',
      default: 'IT resilience preserves application availability and operational decision support during disruption.',
    },
    WATER: {
      single: 'Water dependency gaps can force early curtailment of water-reliant operations and degrade service delivery.',
      alternate: 'Alternate water capability extends operating time and reduces forced shutdown risk during utility interruption.',
      coordination: 'Clear restoration coordination shortens disruption windows for water-dependent processes.',
      default: 'Water resilience determines how long essential operations can continue before service quality drops.',
    },
    WASTEWATER: {
      single: 'Wastewater constraints can quickly force operational curtailment when discharge pathways are unavailable.',
      alternate: 'Alternate wastewater capability lowers compliance and shutdown risk during extended service outages.',
      coordination: 'Restoration and authority coordination reduces uncertainty around interim discharge operations.',
      default: 'Wastewater resilience protects operational continuity and reduces escalation risk during service disruption.',
    },
    CRITICAL_PRODUCTS: {
      single: 'Single-source product dependencies can stop operations even when core infrastructure remains available.',
      alternate: 'Validated alternate suppliers and substitution plans improve throughput continuity under disruption.',
      coordination: 'Supplier coordination and escalation readiness reduce procurement latency during constrained periods.',
      default: 'Critical product resilience prevents avoidable throughput collapse during external disruptions.',
    },
  };
  const leverKey =
    exposureLever.includes('single-point') ? 'single'
      : exposureLever.includes('alternate capability') ? 'alternate'
        : exposureLever.includes('coordination') ? 'coordination'
          : 'default';
  const valueHook =
    valueHooksByInfra[infraCode]?.[leverKey] ??
    valueHooksByInfra[infraCode]?.default ??
    'This condition materially affects continuity performance under disruption.';

  const pieces = [includeBaseline ? baseline : '', urgency, metricSentence, valueHook]
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
  return pieces.join(' ');
}

/**
 * Helper: Get display name for infrastructure code.
 */
function getDisplayName(code: CategoryCode): string {
  const names: Record<CategoryCode, string> = {
    ELECTRIC_POWER: 'Electric Power',
    COMMUNICATIONS: 'Communications',
    INFORMATION_TECHNOLOGY: 'Information Technology',
    WATER: 'Water',
    WASTEWATER: 'Wastewater',
    CRITICAL_PRODUCTS: 'Critical Products',
  };
  return names[code] ?? code;
}

/**
 * Helper: Count findings by type.
 */

/**
 * Helper: Count findings by type.
 */
function computeFindingsCount(vulnerabilities: TriggeredVulnerability[]): {
  structural: number;
  foundational: number;
  cross_cutting: number;
  total: number;
} {
  let structural = 0;
  let foundational = 0;
  let cross_cutting = 0;

  for (const vuln of vulnerabilities) {
    // Classify based on category or other metadata
    // For now, all are counted as structural
    structural++;
  }

  return {
    structural,
    foundational,
    cross_cutting,
    total: structural + foundational + cross_cutting,
  };
}

/**
 * Helper: Count citation coverage from report vulnerabilities.
 * Uses vuln.citations (array of citation IDs); question-driven vulns have citations, legacy may not.
 */
function computeCitationCoverage(vulnerabilities: EvaluatedVulnerability[]): {
  findings_with_citations: number;
  findings_total: number;
} {
  const withCitations = vulnerabilities.filter(
    (v) => Array.isArray(v.citations) && v.citations.length > 0
  ).length;
  return {
    findings_with_citations: withCitations,
    findings_total: vulnerabilities.length,
  };
}

/**
 * Helper: Deduplicate citations by key.
 */
function deduplicateCitations(citations: CitationRef[]): CitationRef[] {
  const seen = new Set<string>();
  return citations.filter((c) => {
    if (seen.has(c.key)) return false;
    seen.add(c.key);
    return true;
  });
}
