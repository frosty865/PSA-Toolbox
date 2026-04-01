/**
 * Methodology Block Builder
 *
 * Produces a compact facts block + short notes list for report methodology section.
 * No prose paragraphs. Deterministic templates only.
 */

import type { Assessment } from 'schema';
import type { NormalizedConditions } from './normalize_conditions';
import { buildCoverageManifest } from './coverage_manifest';
import { HORIZON_HOURS } from '@/app/lib/charts/chartService';
import { getCrossDependenciesNode } from '@/app/lib/cross-dependencies/normalize';
import { isCrossDependencyEnabled } from '@/lib/cross-dependency-enabled';

export type SectorKey =
  | 'ELECTRIC_POWER'
  | 'COMMUNICATIONS'
  | 'INFORMATION_TECHNOLOGY'
  | 'WATER'
  | 'WASTEWATER';

export type MethodologyBlock = {
  tool_version: string;
  template_version: string;
  assessment_created_at: string;
  horizon_hours: number;
  curve_model: string;
  vulnerability_model: string;
  cross_dependency: { enabled: boolean; edges: number };
  data_completeness_by_sector: Record<
    SectorKey,
    { captured: number; expected: number }
  >;
  notes: string[];
};

const SECTOR_ORDER: SectorKey[] = [
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
];

export type MethodologyInputs = {
  assessment: Assessment;
  normalizedConditions?: NormalizedConditions;
};

/**
 * Build methodology block from assessment and normalized conditions.
 * Deterministic output; no filler prose.
 */
export function buildMethodology(inputs: MethodologyInputs): MethodologyBlock {
  const { assessment } = inputs;
  const toolVersion = process.env.TOOL_VERSION ?? '0.1.0';
  const templateVersion = '1.0';
  const createdAt =
    (assessment.meta?.created_at_iso as string) ?? new Date().toISOString();
  const crossDepEnabled = isCrossDependencyEnabled(assessment);
  const node = getCrossDependenciesNode(assessment);
  const edges = node.edges ?? [];
  const edgeCount = edges.length;

  const coverage = buildCoverageManifest(assessment);
  const dataCompleteness: Record<SectorKey, { captured: number; expected: number }> =
    {} as Record<SectorKey, { captured: number; expected: number }>;

  const expectedBySector: Record<SectorKey, number> = {
    ELECTRIC_POWER: 15,
    COMMUNICATIONS: 12,
    INFORMATION_TECHNOLOGY: 14,
    WATER: 18,
    WASTEWATER: 14,
  };

  for (const sector of SECTOR_ORDER) {
    const captured = Object.keys(coverage.captured).filter((k) =>
      k.startsWith(`${sector}:`)
    ).length;
    dataCompleteness[sector] = {
      captured,
      expected: expectedBySector[sector],
    };
  }

  const notes: string[] = [
    `Impact curves model degradation over a 0–${HORIZON_HOURS} hour horizon.`,
    'Vulnerabilities are triggered from normalized dependency conditions.',
    `Cross-dependency links are ${crossDepEnabled ? 'enabled' : 'disabled'}; ${edgeCount} dependency edge${edgeCount === 1 ? '' : 's'} evaluated.`,
  ];

  return {
    tool_version: toolVersion,
    template_version: templateVersion,
    assessment_created_at: createdAt,
    horizon_hours: HORIZON_HOURS,
    curve_model: 'deterministic-degradation',
    vulnerability_model: 'condition-triggered-v1',
    cross_dependency: { enabled: crossDepEnabled, edges: edgeCount },
    data_completeness_by_sector: dataCompleteness,
    notes,
  };
}
