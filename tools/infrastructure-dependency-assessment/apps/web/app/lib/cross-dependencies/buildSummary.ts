/**
 * Build cross-dependency summary for Review & Export and DOCX payload.
 * Narrative bullets only; no tables.
 */
import type { Assessment, CrossDependencyEdge } from 'schema';
import { getCrossDependenciesNode } from './normalize';
import { formatCircularPath } from './deriveFlags';
import { buildDownstreamFailureIndicators } from './buildSuggestions';
import {
  CROSS_DEPENDENCY_MODULES,
  mergeModulesState,
  type ModulesState,
} from '@/app/lib/modules/registry';
import { deriveOtIcsModule, type ModuleFinding } from '@/app/lib/modules/ot_ics_resilience_derive';

const CATEGORY_LABELS: Record<string, string> = {
  ELECTRIC_POWER: 'Electric Power',
  COMMUNICATIONS: 'Communications',
  INFORMATION_TECHNOLOGY: 'Information Technology',
  WATER: 'Water',
  WASTEWATER: 'Wastewater',
  CRITICAL_PRODUCTS: 'Critical Products',
};

const PURPOSE_LABELS: Record<string, string> = {
  primary_operations: 'Primary operations',
  monitoring_control: 'Monitoring / control',
  restoration_recovery: 'Restoration / recovery',
  safety_life_safety: 'Safety / life safety',
};

const TIME_LABELS: Record<string, string> = {
  immediate: 'immediate',
  short: 'short',
  medium: 'medium',
  long: 'long',
  unknown: 'unknown',
};

function labelCat(c: string): string {
  return CATEGORY_LABELS[c] ?? c;
}

function rankEdge(e: CrossDependencyEdge): number {
  const critOrder = { critical: 4, important: 3, limited: 2, unknown: 1 };
  const timeOrder = { immediate: 5, short: 4, medium: 3, long: 2, unknown: 1 };
  return (critOrder[e.criticality] ?? 1) * 10 + (timeOrder[e.time_to_cascade_bucket] ?? 1);
}

export type CrossDependencySummary = {
  confirmed_count: number;
  top_edges: string[];
  flags: string[];
};

export type CrossDependencyModuleFinding = {
  module_code: string;
  title: string;
  summary_sentences: string[];
  vulnerabilities: ModuleFinding[];
};

export function buildCrossDependencySummary(assessment: Assessment): CrossDependencySummary | null {
  const node = getCrossDependenciesNode(assessment);
  const edges = node.edges;
  if (edges.length === 0) return null;

  const sorted = [...edges].sort((a, b) => rankEdge(b) - rankEdge(a));
  const top3 = sorted.slice(0, 3);
  const top_edges = top3.map(
    (e) =>
      `${labelCat(e.from_category)} → ${labelCat(e.to_category)} (${PURPOSE_LABELS[e.purpose] ?? e.purpose}; cascade: ${TIME_LABELS[e.time_to_cascade_bucket] ?? e.time_to_cascade_bucket}; single-path: ${e.single_path})`
  );

  const flags: string[] = [];
  const derived = node.derived;
  if (derived?.circular_dependencies?.length) {
    for (const c of derived.circular_dependencies) {
      flags.push(`Circular dependency detected: ${formatCircularPath(c.path)}`);
    }
  }
  if (derived?.common_mode_spof?.length) {
    for (const f of derived.common_mode_spof) {
      flags.push(`${labelCat(f.upstream_category)}: ${f.rationale}`);
    }
  }

  const downstreamIndicators = buildDownstreamFailureIndicators(assessment);
  for (const indicator of downstreamIndicators) {
    if (indicator.failures.length === 0) continue;
    const preview = indicator.failures.slice(0, 2).join(' ');
    const remainder = indicator.failures.length > 2 ? ` (+${indicator.failures.length - 2} more)` : '';
    flags.push(`${labelCat(indicator.category)} downstream failures: ${preview}${remainder}`);
  }

  return {
    confirmed_count: edges.length,
    top_edges,
    flags,
  };
}

export function buildCrossDependencyModuleFindings(assessment: Assessment): CrossDependencyModuleFinding[] {
  const modules = mergeModulesState(assessment.modules as ModulesState | undefined);
  const findings: CrossDependencyModuleFinding[] = [];
  for (const mod of CROSS_DEPENDENCY_MODULES) {
    const state = modules[mod.module_code];
    if (!state?.enabled) continue;
    if (mod.module_code === 'MODULE_OT_ICS_RESILIENCE') {
      const derived = deriveOtIcsModule(state.answers ?? {});
      findings.push({
        module_code: mod.module_code,
        title: mod.title,
        summary_sentences: derived.summary_sentences,
        vulnerabilities: derived.vulnerabilities,
      });
    }
  }
  return findings;
}
