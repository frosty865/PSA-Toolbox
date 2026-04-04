/**
 * Centralized predicates for Visual Analysis section gating.
 * Zero-safe: timeToImpact=0 and loss=0 are valid; do not use truthy checks.
 */

import type { Assessment } from 'schema';
import { getCrossDependenciesNode } from '@/app/lib/cross-dependencies/normalize';
import {
  INFRASTRUCTURE_KEYS,
  INFRASTRUCTURE_TO_CATEGORY,
  deriveCurveValuesFromCategoryInput,
  type CurveNamespace,
} from '@/app/lib/assessment/normalize_curve_storage';
import { getCurveNamespaceForInfrastructure } from '@/app/lib/curves/curve_accessors';

function isNumberOrNull(v: unknown): v is number | null {
  return v === null || (typeof v === 'number' && !Number.isNaN(v));
}

/** True if curve has reliance (requires_service) and at least one curve input; treats 0 as valid. */
function curveHasMinimalData(curve: CurveNamespace): boolean {
  if (curve.requires_service !== true) return false;
  return (
    (curve.time_to_impact !== undefined && isNumberOrNull(curve.time_to_impact)) ||
    (curve.loss_no_backup !== undefined && isNumberOrNull(curve.loss_no_backup)) ||
    (curve.recovery_time !== undefined && isNumberOrNull(curve.recovery_time)) ||
    (curve.backup_duration !== undefined && isNumberOrNull(curve.backup_duration)) ||
    (curve.loss_with_backup !== undefined && isNumberOrNull(curve.loss_with_backup))
  );
}

/**
 * Returns true if ANY infrastructure has: relyOn === true AND minimal curve inputs
 * (timeToImpact, functional loss, or recovery). Treats 0 as valid (e.g. immediate impact).
 * Checks both assessment.infrastructure curve and assessment.categories (questionnaire) so
 * data is found whether stored in curve namespace or category input.
 */
export function hasAnyCurveData(assessment: Assessment | null | undefined): boolean {
  if (!assessment) return false;
  for (const infra of INFRASTRUCTURE_KEYS) {
    let curve = getCurveNamespaceForInfrastructure(assessment, infra);
    if (!curveHasMinimalData(curve)) {
      const categoryCode = INFRASTRUCTURE_TO_CATEGORY[infra];
      curve = deriveCurveValuesFromCategoryInput(assessment.categories?.[categoryCode]);
    }
    if (curveHasMinimalData(curve)) return true;
  }
  return false;
}

/**
 * Returns true when there is at least one confirmed cross-dependency edge.
 * Use only when cross-dependency is enabled; callers must gate by isCrossDependencyEnabled first.
 */
export function hasMatrixData(assessment: Assessment | null | undefined): boolean {
  if (!assessment) return false;
  const node = getCrossDependenciesNode(assessment);
  const edges = node?.edges ?? [];
  return Array.isArray(edges) && edges.length > 0;
}

/**
 * Human-readable reason when curves are not shown (for placeholder / debug empty state).
 */
export function getCurveEmptyReason(assessment: Assessment | null | undefined): string {
  if (!assessment) return 'No assessment data.';
  let anyReliance = false;
  for (const infra of INFRASTRUCTURE_KEYS) {
    let curve = getCurveNamespaceForInfrastructure(assessment, infra);
    if (!curve.requires_service) {
      const categoryCode = INFRASTRUCTURE_TO_CATEGORY[infra];
      curve = deriveCurveValuesFromCategoryInput(assessment.categories?.[categoryCode]);
    }
    if (curve.requires_service === true) anyReliance = true;
    if (curveHasMinimalData(curve)) return ''; // has data; not empty
  }
  if (anyReliance) return 'Reliance selected but curve inputs incomplete (e.g. time to impact or loss).';
  return 'No infrastructure reliance selected.';
}
