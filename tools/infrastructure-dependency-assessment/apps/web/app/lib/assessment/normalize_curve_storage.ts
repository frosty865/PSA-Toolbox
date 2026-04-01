import type { Assessment, CategoryCode, CategoryInput } from 'schema';

export const INFRASTRUCTURE_KEYS = ['energy', 'communications', 'information_technology', 'water', 'wastewater'] as const;
export type InfrastructureKey = (typeof INFRASTRUCTURE_KEYS)[number];

export const INFRASTRUCTURE_TO_CATEGORY: Record<InfrastructureKey, CategoryCode> = {
  energy: 'ELECTRIC_POWER',
  communications: 'COMMUNICATIONS',
  information_technology: 'INFORMATION_TECHNOLOGY',
  water: 'WATER',
  wastewater: 'WASTEWATER',
};

export const CATEGORY_TO_INFRASTRUCTURE: Partial<Record<CategoryCode, InfrastructureKey>> = {
  ELECTRIC_POWER: 'energy',
  COMMUNICATIONS: 'communications',
  INFORMATION_TECHNOLOGY: 'information_technology',
  WATER: 'water',
  WASTEWATER: 'wastewater',
};

export const CURVE_KEYS = ['requires_service', 'time_to_impact', 'loss_no_backup', 'backup_duration', 'loss_with_backup', 'recovery_time'] as const;
export type CurveKey = (typeof CURVE_KEYS)[number];
export type CurveNamespace = {
  requires_service?: boolean;
  time_to_impact?: number | null;
  loss_no_backup?: number | null;
  backup_duration?: number | null;
  loss_with_backup?: number | null;
  recovery_time?: number | null;
};

const LEGACY_CURVE_KEY_MAP: Record<string, CurveKey> = {
  curve_requires_service: 'requires_service',
  curve_time_to_impact: 'time_to_impact',
  curve_time_to_impact_hours: 'time_to_impact',
  curve_loss_no_backup: 'loss_no_backup',
  curve_loss_fraction_no_backup: 'loss_no_backup',
  curve_backup_duration: 'backup_duration',
  curve_backup_duration_hours: 'backup_duration',
  curve_loss_with_backup: 'loss_with_backup',
  curve_loss_fraction_with_backup: 'loss_with_backup',
  curve_recovery_time: 'recovery_time',
  curve_recovery_time_hours: 'recovery_time',
};

function toBoolean(value: unknown): boolean | undefined {
  if (value === true) return true;
  if (value === false) return false;
  if (value === 'yes' || value === 'true' || value === '1') return true;
  if (value === 'no' || value === 'false' || value === '0') return false;
  return undefined;
}

function toNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }
  return undefined;
}

/**
 * Guard: warn if a loss fraction appears to be in wrong scale.
 * Loss fractions should be 0..1 (fractional form).
 * If a value looks like a percentage (>1), warn about potential rescaling issue.
 */
function validateLossFractionScale(key: string, value: number | null | undefined): void {
  if (value && typeof value === 'number' && (key === 'loss_no_backup' || key === 'loss_with_backup') && value > 1 && value <= 100) {
    console.warn(
      `[CurveStorage] Suspicious "${key}" value: ${value}. Appears to be a percentage (0..100) stored in fraction field. ` +
      `Loss fractions should be 0..1. If this is intentional, verify buildCurveDeterministic receives the correct scale.`
    );
  }
}

function sanitizeCurveValue(key: CurveKey, value: unknown): boolean | number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (key === 'requires_service') {
    return toBoolean(value);
  }
  return toNumber(value);
}

export function toCurveNamespace(source?: unknown): CurveNamespace {
  if (!source || typeof source !== 'object') return {};
  const out: CurveNamespace = {};
  for (const key of CURVE_KEYS) {
    const normalized = sanitizeCurveValue(key, (source as Record<string, unknown>)[key]);
    if (normalized === undefined) continue;
    switch (key) {
      case 'requires_service':
        out.requires_service = normalized as boolean;
        break;
      case 'time_to_impact':
        out.time_to_impact = normalized as number | null;
        break;
      case 'loss_no_backup':
        out.loss_no_backup = normalized as number | null;
        break;
      case 'backup_duration':
        out.backup_duration = normalized as number | null;
        break;
      case 'loss_with_backup':
        out.loss_with_backup = normalized as number | null;
        break;
      case 'recovery_time':
        out.recovery_time = normalized as number | null;
        break;
    }
  }
  return out;
}

export function hasCurveValues(curve: CurveNamespace): boolean {
  return (
    curve.requires_service !== undefined ||
    curve.time_to_impact !== undefined ||
    curve.loss_no_backup !== undefined ||
    curve.backup_duration !== undefined ||
    curve.loss_with_backup !== undefined ||
    curve.recovery_time !== undefined
  );
}

function curvesEqual(a: CurveNamespace, b: CurveNamespace): boolean {
  return (
    (a.requires_service ?? undefined) === (b.requires_service ?? undefined) &&
    (a.time_to_impact ?? undefined) === (b.time_to_impact ?? undefined) &&
    (a.loss_no_backup ?? undefined) === (b.loss_no_backup ?? undefined) &&
    (a.backup_duration ?? undefined) === (b.backup_duration ?? undefined) &&
    (a.loss_with_backup ?? undefined) === (b.loss_with_backup ?? undefined) &&
    (a.recovery_time ?? undefined) === (b.recovery_time ?? undefined)
  );
}

export function cloneCurve(curve: CurveNamespace): CurveNamespace {
  const out: CurveNamespace = {};
  if (curve.requires_service !== undefined) out.requires_service = curve.requires_service;
  if (curve.time_to_impact !== undefined) out.time_to_impact = curve.time_to_impact;
  if (curve.loss_no_backup !== undefined) out.loss_no_backup = curve.loss_no_backup;
  if (curve.backup_duration !== undefined) out.backup_duration = curve.backup_duration;
  if (curve.loss_with_backup !== undefined) out.loss_with_backup = curve.loss_with_backup;
  if (curve.recovery_time !== undefined) out.recovery_time = curve.recovery_time;
  return out;
}

/** Read number from category, including curve_* keys (Comms/IT use curve_*). Treat 0 as valid. */
function readCurveNumber(
  category: Partial<CategoryInput> & Record<string, unknown>,
  flatKey: string,
  curveKey: string
): number | null | undefined {
  const v = (category as Record<string, unknown>)[flatKey];
  const fromFlat = toNumber(v);
  if (fromFlat !== undefined) return fromFlat;
  return toNumber((category as Record<string, unknown>)[curveKey]);
}

/** Derive curve namespace values from a category input payload. Uses flat and curve_* keys; 0 is valid. */
export function deriveCurveValuesFromCategoryInput(category?: Partial<CategoryInput> | null): CurveNamespace {
  if (!category) return {};
  const cat = category as Record<string, unknown>;
  const out: CurveNamespace = {};

  const requiresServiceRaw = category.requires_service ?? cat.curve_requires_service;
  const requiresService = typeof requiresServiceRaw === 'boolean' ? requiresServiceRaw : toBoolean(requiresServiceRaw);
  if (requiresService !== undefined) {
    out.requires_service = requiresService;
  }

  if (requiresService === false) {
    out.time_to_impact = 0;
    out.loss_no_backup = 0;
    out.backup_duration = null;
    out.loss_with_backup = null;
    out.recovery_time = 0;
    return out;
  }

  const timeToImpact = readCurveNumber(category as Partial<CategoryInput> & Record<string, unknown>, 'time_to_impact_hours', 'curve_time_to_impact_hours');
  if (timeToImpact !== undefined) out.time_to_impact = timeToImpact;

  const lossNoBackup = readCurveNumber(category as Partial<CategoryInput> & Record<string, unknown>, 'loss_fraction_no_backup', 'curve_loss_fraction_no_backup');
  if (lossNoBackup !== undefined) {
    validateLossFractionScale('loss_no_backup', lossNoBackup);
    out.loss_no_backup = lossNoBackup;
  }

  const hasBackupAny = typeof category.has_backup_any === 'boolean'
    ? category.has_backup_any
    : typeof category.has_backup === 'boolean'
      ? category.has_backup
      : (cat.curve_backup_available === true || cat.curve_backup_available === 'yes')
        ? true
        : (cat.curve_backup_available === false || cat.curve_backup_available === 'no')
          ? false
          : undefined;

  if (hasBackupAny === false) {
    out.backup_duration = null;
    out.loss_with_backup = null;
  } else if (hasBackupAny === true) {
    const backupDuration = readCurveNumber(category as Partial<CategoryInput> & Record<string, unknown>, 'backup_duration_hours', 'curve_backup_duration_hours');
    if (backupDuration !== undefined) out.backup_duration = backupDuration;
    const lossWithBackup = readCurveNumber(category as Partial<CategoryInput> & Record<string, unknown>, 'loss_fraction_with_backup', 'curve_loss_fraction_with_backup');
    if (lossWithBackup !== undefined) {
      validateLossFractionScale('loss_with_backup', lossWithBackup);
      out.loss_with_backup = lossWithBackup;
    }
  } else {
    const backupDuration = readCurveNumber(category as Partial<CategoryInput> & Record<string, unknown>, 'backup_duration_hours', 'curve_backup_duration_hours');
    if (backupDuration !== undefined) out.backup_duration = backupDuration;
    const lossWithBackup = readCurveNumber(category as Partial<CategoryInput> & Record<string, unknown>, 'loss_fraction_with_backup', 'curve_loss_fraction_with_backup');
    if (lossWithBackup !== undefined) {
      validateLossFractionScale('loss_with_backup', lossWithBackup);
      out.loss_with_backup = lossWithBackup;
    }
  }

  const recoveryTime = readCurveNumber(category as Partial<CategoryInput> & Record<string, unknown>, 'recovery_time_hours', 'curve_recovery_time_hours');
  if (recoveryTime !== undefined) out.recovery_time = recoveryTime;

  return out;
}

/** Convert curve namespace values into CategoryInput-style fields for UI merging. */
export function curveNamespaceToCategoryPatch(curve: CurveNamespace): Partial<CategoryInput> {
  const patch: Partial<CategoryInput> = {};
  if (typeof curve.requires_service === 'boolean') {
    patch.requires_service = curve.requires_service;
  }
  if (typeof curve.time_to_impact === 'number' || curve.time_to_impact === null) {
    patch.time_to_impact_hours = curve.time_to_impact;
  }
  if (typeof curve.loss_no_backup === 'number' || curve.loss_no_backup === null) {
    patch.loss_fraction_no_backup = curve.loss_no_backup;
  }
  if (typeof curve.backup_duration === 'number' || curve.backup_duration === null) {
    patch.backup_duration_hours = curve.backup_duration;
  }
  if (typeof curve.loss_with_backup === 'number' || curve.loss_with_backup === null) {
    patch.loss_fraction_with_backup = curve.loss_with_backup;
  }
  if (typeof curve.recovery_time === 'number' || curve.recovery_time === null) {
    patch.recovery_time_hours = curve.recovery_time;
  }
  return patch;
}

/** Extract legacy curve_* values stored at the top level of the assessment (pre-namespacing). */
export function extractLegacyCurveValues(assessment: Assessment): CurveNamespace {
  const record = assessment as Record<string, unknown>;
  const out: CurveNamespace = {};
  for (const [legacyKey, curveKey] of Object.entries(LEGACY_CURVE_KEY_MAP)) {
    if (!(legacyKey in record)) continue;
    const normalized = sanitizeCurveValue(curveKey, record[legacyKey]);
    if (normalized !== undefined) {
      switch (curveKey) {
        case 'requires_service':
          out.requires_service = normalized as boolean;
          break;
        case 'time_to_impact':
          out.time_to_impact = normalized as number | null;
          break;
        case 'loss_no_backup':
          out.loss_no_backup = normalized as number | null;
          break;
        case 'backup_duration':
          out.backup_duration = normalized as number | null;
          break;
        case 'loss_with_backup':
          out.loss_with_backup = normalized as number | null;
          break;
        case 'recovery_time':
          out.recovery_time = normalized as number | null;
          break;
      }
    }
  }
  return out;
}

/** Remove legacy curve_* keys from the assessment object. */
export function stripLegacyCurveKeys(assessment: Assessment): Assessment {
  const record = assessment as Record<string, unknown>;
  let needsClone = false;
  for (const legacyKey of Object.keys(LEGACY_CURVE_KEY_MAP)) {
    if (legacyKey in record) {
      needsClone = true;
      break;
    }
  }
  if (!needsClone) return assessment;

  const clone = { ...record };
  for (const legacyKey of Object.keys(LEGACY_CURVE_KEY_MAP)) {
    delete clone[legacyKey];
  }
  return clone as Assessment;
}

function normPct(v: unknown): number | null | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(100, Math.max(0, n));
}

/** Check if category has alternate/backup capability (any of the standard flags). */
function hasAlternateAvailable(cat: Record<string, unknown>, categoryCode?: string): boolean {
  if (cat.has_backup_any === true || cat.has_backup === true) return true;
  if (cat.curve_backup_available === true || cat.curve_backup_available === 'yes') return true;
  const supply = cat.supply;
  if (supply && typeof supply === 'object' && (supply as { has_alternate_source?: boolean }).has_alternate_source === true) return true;
  if (categoryCode === 'CRITICAL_PRODUCTS') {
    const rows = cat.critical_products;
    if (Array.isArray(rows) && rows.some((r: { alternate_supplier_identified?: boolean }) => r?.alternate_supplier_identified === true)) return true;
    const alt = cat.alternative_providers;
    if (alt && typeof alt === 'object' && (alt as { available?: string }).available === 'Yes') return true;
  }
  return false;
}

/** When alternate exists but redundancy_activation missing, set to UNKNOWN so synopsis avoids false precision. */
function migrateRedundancyActivation(categories: Assessment['categories']): void {
  if (!categories) return;
  for (const [code, cat] of Object.entries(categories)) {
    if (!cat || typeof cat !== 'object') continue;
    const rec = cat as Record<string, unknown>;
    if (!hasAlternateAvailable(rec, code)) continue;
    if (rec.redundancy_activation != null) continue;
    rec.redundancy_activation = {
      mode: 'UNKNOWN',
      activation_delay_min: null,
      requires_trained_personnel: null,
      trained_personnel_24_7: null,
      remote_initiation_available: null,
      vendor_dispatch_required: null,
      documented_and_tested: null,
    };
  }
}

/** Migrate backup_capacity_percent -> backup_capacity_pct (avoids export validator percent-key check).
 * Normalizes to 0–100; when no backup, forces 0 for deterministic report output. */
function migrateBackupCapacityPercent(categories: Assessment['categories']): void {
  if (!categories) return;
  for (const cat of Object.values(categories)) {
    if (!cat || typeof cat !== 'object') continue;
    const rec = cat as Record<string, unknown>;
    const legacy = rec.backup_capacity_percent;
    const current = rec.backup_capacity_pct;

    if (current === undefined && legacy !== undefined) {
      rec.backup_capacity_pct = normPct(legacy);
    }

    const hasBackup = rec.has_backup_any === true || rec.has_backup === true;
    if (!hasBackup && rec.backup_capacity_pct === undefined) {
      rec.backup_capacity_pct = 0;
    }

    if ('backup_capacity_percent' in rec) {
      delete rec.backup_capacity_percent;
    }
  }
}

/** Normalize curve storage so future saves and UI access use the namespaced infrastructure object. */
export function normalizeCurveStorage(assessment: Assessment): Assessment {
  const legacy = extractLegacyCurveValues(assessment);
  let result = stripLegacyCurveKeys(assessment);
  migrateBackupCapacityPercent(result.categories ?? undefined);
  migrateRedundancyActivation(result.categories ?? undefined);
  type InfrastructureNodeShape = { curve?: unknown } & Record<string, unknown>;
  const existingInfra = (result.infrastructure ?? {}) as Partial<Record<InfrastructureKey, InfrastructureNodeShape>>;
  const normalizedInfra: Partial<Record<InfrastructureKey, InfrastructureNodeShape>> = { ...existingInfra };
  let changed = result !== assessment;

  let legacyForMigration = hasCurveValues(legacy) ? legacy : undefined;

  for (const infra of INFRASTRUCTURE_KEYS) {
    const existingNode = existingInfra[infra];
    const existingCurve = existingNode ? toCurveNamespace(existingNode.curve) : {};
    const categoryCode = INFRASTRUCTURE_TO_CATEGORY[infra];
    const category = result.categories?.[categoryCode] as Partial<CategoryInput> | undefined;
    const derivedCurve = deriveCurveValuesFromCategoryInput(category);

    let chosenCurve: CurveNamespace;
    if (hasCurveValues(existingCurve)) {
      chosenCurve = existingCurve;
    } else if (hasCurveValues(derivedCurve)) {
      chosenCurve = derivedCurve;
    } else if (legacyForMigration) {
      chosenCurve = legacyForMigration;
      legacyForMigration = undefined;
    } else {
      chosenCurve = {};
    }

    const normalizedCurve = cloneCurve(chosenCurve);
    const hadCurveStored = hasCurveValues(existingCurve);
    const hadCurveProperty = existingNode != null && Object.prototype.hasOwnProperty.call(existingNode, 'curve');
    const shouldStoreCurve = hasCurveValues(normalizedCurve);
    if (shouldStoreCurve) {
      if (!hadCurveStored || !curvesEqual(existingCurve, normalizedCurve)) {
        const nextNode: InfrastructureNodeShape = { ...(existingNode ?? {}) };
        nextNode.curve = normalizedCurve;
        normalizedInfra[infra] = nextNode;
        changed = true;
      }
      continue;
    }

    if (hadCurveStored || hadCurveProperty) {
      const nextNode: InfrastructureNodeShape = { ...(existingNode ?? {}) };
      delete nextNode.curve;
      if (Object.keys(nextNode).length > 0) {
        normalizedInfra[infra] = nextNode;
      } else if (infra in normalizedInfra) {
        delete normalizedInfra[infra];
      }
      changed = true;
      continue;
    }

    if (existingNode && Object.keys(existingNode).length === 0 && infra in normalizedInfra) {
      delete normalizedInfra[infra];
      changed = true;
    }
  }

  const infraHasEntries = Object.keys(normalizedInfra).length > 0;
  if (!infraHasEntries) {
    if (!changed) {
      return result;
    }
    if (result.infrastructure === undefined) {
      return result;
    }
    const { infrastructure: _discard, ...rest } = result;
    return rest as Assessment;
  }

  if (!changed) {
    return result;
  }

  return {
    ...result,
    infrastructure: normalizedInfra as Assessment['infrastructure'],
  };
}
