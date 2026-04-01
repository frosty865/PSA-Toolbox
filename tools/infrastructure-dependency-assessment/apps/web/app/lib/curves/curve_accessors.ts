import type { Assessment, CategoryCode, CategoryInput, InfrastructureNode, InfrastructureState } from 'schema';
import {
  CATEGORY_TO_INFRASTRUCTURE,
  CURVE_KEYS,
  CurveKey,
  CurveNamespace,
  INFRASTRUCTURE_KEYS,
  INFRASTRUCTURE_TO_CATEGORY,
  InfrastructureKey,
  cloneCurve,
  curveNamespaceToCategoryPatch,
  deriveCurveValuesFromCategoryInput,
  extractLegacyCurveValues,
  hasCurveValues,
  normalizeCurveStorage,
  stripLegacyCurveKeys,
  toCurveNamespace,
} from '@/app/lib/assessment/normalize_curve_storage';

function sanitizeUpdateValue(key: CurveKey, value: unknown): boolean | number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (key === 'requires_service') {
    if (value === true || value === false) return value;
    if (value === 'yes' || value === 'true' || value === '1') return true;
    if (value === 'no' || value === 'false' || value === '0') return false;
    return undefined;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }
  return undefined;
}

function ensureCurveNamespace(node: InfrastructureNode | undefined): CurveNamespace {
  if (!node) return {};
  return toCurveNamespace(node.curve);
}

function ensureInfrastructureState(assessment: Assessment): InfrastructureState {
  return (assessment.infrastructure ?? {}) as InfrastructureState;
}

function readCurveValue(curve: CurveNamespace, key: CurveKey): boolean | number | null | undefined {
  switch (key) {
    case 'requires_service':
      return curve.requires_service;
    case 'time_to_impact':
      return curve.time_to_impact;
    case 'loss_no_backup':
      return curve.loss_no_backup;
    case 'backup_duration':
      return curve.backup_duration;
    case 'loss_with_backup':
      return curve.loss_with_backup;
    case 'recovery_time':
      return curve.recovery_time;
    default:
      return undefined;
  }
}

function assignCurveValue(curve: CurveNamespace, key: CurveKey, value: boolean | number | null): void {
  switch (key) {
    case 'requires_service':
      curve.requires_service = value as boolean;
      break;
    case 'time_to_impact':
      curve.time_to_impact = value as number | null;
      break;
    case 'loss_no_backup':
      curve.loss_no_backup = value as number | null;
      break;
    case 'backup_duration':
      curve.backup_duration = value as number | null;
      break;
    case 'loss_with_backup':
      curve.loss_with_backup = value as number | null;
      break;
    case 'recovery_time':
      curve.recovery_time = value as number | null;
      break;
  }
}

function deleteCurveKey(curve: CurveNamespace, key: CurveKey): void {
  switch (key) {
    case 'requires_service':
      delete curve.requires_service;
      break;
    case 'time_to_impact':
      delete curve.time_to_impact;
      break;
    case 'loss_no_backup':
      delete curve.loss_no_backup;
      break;
    case 'backup_duration':
      delete curve.backup_duration;
      break;
    case 'loss_with_backup':
      delete curve.loss_with_backup;
      break;
    case 'recovery_time':
      delete curve.recovery_time;
      break;
  }
}

function curveKeyPresent(curve: CurveNamespace, key: CurveKey): boolean {
  switch (key) {
    case 'requires_service':
      return curve.requires_service !== undefined;
    case 'time_to_impact':
      return curve.time_to_impact !== undefined;
    case 'loss_no_backup':
      return curve.loss_no_backup !== undefined;
    case 'backup_duration':
      return curve.backup_duration !== undefined;
    case 'loss_with_backup':
      return curve.loss_with_backup !== undefined;
    case 'recovery_time':
      return curve.recovery_time !== undefined;
    default:
      return false;
  }
}

/** Map a category code to its infrastructure key (if applicable). */
export function categoryCodeToInfrastructure(category: CategoryCode): InfrastructureKey | undefined {
  return CATEGORY_TO_INFRASTRUCTURE[category];
}

/** Return the normalized curve namespace for an infrastructure key. */
export function getCurveNamespaceForInfrastructure(assessment: Assessment, infra: InfrastructureKey): CurveNamespace {
  const infraState = assessment.infrastructure as Record<string, InfrastructureNode> | undefined;
  const node = infraState?.[infra];
  return toCurveNamespace(node?.curve);
}

/** Read a single curve value for an infrastructure. */
export function getCurveValue(
  assessment: Assessment,
  infra: InfrastructureKey,
  key: CurveKey
): boolean | number | null | undefined {
  const curve = getCurveNamespaceForInfrastructure(assessment, infra);
  return readCurveValue(curve, key);
}

/** Convert stored curve values for an infrastructure into CategoryInput-style patch for UI defaults. */
export function getCurvePatchForCategory(assessment: Assessment, category: CategoryCode): Partial<CategoryInput> {
  const infra = categoryCodeToInfrastructure(category);
  if (!infra) return {};
  const curve = getCurveNamespaceForInfrastructure(assessment, infra);
  if (!hasCurveValues(curve)) return {};
  return curveNamespaceToCategoryPatch(curve);
}

/**
 * When encountering legacy curve_* fields at the root, migrate them into the requested infrastructure
 * node before continuing. This keeps backward compatibility for older saved progress files.
 */
export function migrateLegacyCurveIfPresent(assessment: Assessment, infra: InfrastructureKey): Assessment {
  const legacy = extractLegacyCurveValues(assessment);
  if (!hasCurveValues(legacy)) {
    return stripLegacyCurveKeys(assessment);
  }

  const stripped = stripLegacyCurveKeys(assessment);
  const infraState = ensureInfrastructureState(stripped);
  const existingCurve = ensureCurveNamespace(infraState[infra]);
  if (hasCurveValues(existingCurve)) {
    return stripped;
  }

  const updatedInfra = {
    ...infraState,
    [infra]: {
      ...infraState[infra],
      curve: cloneCurve(legacy),
    },
  };

  return {
    ...stripped,
    infrastructure: updatedInfra,
  };
}

export type CurveUpdates = Partial<Record<CurveKey, boolean | number | null | undefined>>;

/**
 * Persist curve values for an infrastructure. The update is merged with the existing namespace,
 * removing keys when explicitly set to undefined.
 */
export function setCurveValues(
  assessment: Assessment,
  infra: InfrastructureKey,
  updates: CurveUpdates
): Assessment {
  let next = migrateLegacyCurveIfPresent(assessment, infra);
  next = normalizeCurveStorage(next);

  const infraState = ensureInfrastructureState(next);
  const node: InfrastructureNode = infraState[infra] ?? ({} as InfrastructureNode);
  const currentCurve = toCurveNamespace(node.curve);
  const mergedCurve: CurveNamespace = { ...currentCurve };
  let changed = false;

  for (const key of CURVE_KEYS) {
    if (!(key in updates)) continue;
    const rawValue = updates[key];
    if (rawValue === undefined) {
      if (curveKeyPresent(mergedCurve, key)) {
        deleteCurveKey(mergedCurve, key);
        changed = true;
      }
      continue;
    }
    const normalized = sanitizeUpdateValue(key, rawValue);
    if (normalized === undefined) continue;
    if (readCurveValue(mergedCurve, key) !== normalized) {
      assignCurveValue(mergedCurve, key, normalized);
      changed = true;
    }
  }

  if (!changed) {
    return next;
  }

  const updatedInfra: InfrastructureState = {
    ...infraState,
    [infra]: {
      ...node,
      curve: cloneCurve(mergedCurve),
    },
  };

  return {
    ...next,
    infrastructure: updatedInfra,
  };
}

/** Convenience wrapper for single-field updates. */
export function setCurveValue(
  assessment: Assessment,
  infra: InfrastructureKey,
  key: CurveKey,
  value: boolean | number | null | undefined
): Assessment {
  return setCurveValues(assessment, infra, { [key]: value });
}

/** Curve answer keys that may live under answers and must be at top level for chart/curve build. */
const CURVE_ANSWER_KEYS = [
  'curve_requires_service',
  'curve_time_to_impact_hours',
  'curve_loss_fraction_no_backup',
  'curve_backup_available',
  'curve_backup_duration_hours',
  'curve_loss_fraction_with_backup',
  'curve_recovery_time_hours',
] as const;

/** Merge stored curve values into an assessment category input for UI defaults. Promotes answers.curve_* to top so chart sees backup and with-backup loss. */
export function mergeCurveIntoCategory(
  assessment: Assessment,
  category: CategoryCode,
  base: Partial<CategoryInput>
): Partial<CategoryInput> {
  const curvePatch = getCurvePatchForCategory(assessment, category);
  const baseRecord = base as Record<string, unknown>;
  const answers = (baseRecord.answers as Record<string, unknown> | undefined) ?? {};
  const answersPromoted: Record<string, unknown> = {};
  for (const key of CURVE_ANSWER_KEYS) {
    if (baseRecord[key] === undefined && answers[key] !== undefined) {
      answersPromoted[key] = answers[key];
    }
  }
  return { ...base, ...curvePatch, ...answersPromoted } as Partial<CategoryInput>;
}

/** Rebuild the infrastructure namespace from categories (used when regenerating defaults). */
export function rebuildInfrastructureFromCategories(assessment: Assessment): Assessment {
  let next = assessment;
  for (const infra of INFRASTRUCTURE_KEYS) {
    const categoryCode = INFRASTRUCTURE_TO_CATEGORY[infra];
    const categoryInput = assessment.categories?.[categoryCode];
    if (!categoryInput) continue;
    const derived = deriveCurveValuesFromCategoryInput(categoryInput);
    if (!hasCurveValues(derived)) continue;
    next = setCurveValues(next, infra, derived);
  }
  return next;
}