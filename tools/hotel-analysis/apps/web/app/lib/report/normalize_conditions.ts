/**
 * Normalize captured facts into standardized dependency conditions.
 * Uses QUESTION_CONDITION_MAP as the ONLY source of truth.
 * Outputs accounting: mappedKeys, unmappedKeys, missingRequiredKeys.
 */
import type { Assessment } from 'schema';
import {
  QUESTION_CONDITION_MAP,
  MAP_BY_SECTOR,
  type SectorKey,
  type ConditionKey,
} from './conditions/question_condition_map';
import { getHostedServiceProfile } from './it/hosted_service_registry';
import { migrateHostedResilienceEntry } from './it/hosted_resilience_migration';

export type Tri = 'YES' | 'NO' | 'UNKNOWN';
export type Conf = 'CONFIRMED' | 'UNCONFIRMED' | 'UNKNOWN';
export type Div = 'SINGLE' | 'MULTIPLE' | 'UNKNOWN';
export type DurClass = 'NONE' | 'SHORT' | 'MODERATE' | 'LONG';
export type RecClass = 'SHORT' | 'MODERATE' | 'LONG';
export type PaceDepth = 'NONE' | 'P' | 'PA' | 'PAC' | 'PACE';

export type SectorConditions = {
  requires_service: boolean;
  provider_confirmed: Conf;
  single_provider_or_path: Tri;
  entry_diversity: Div;
  corridor_colocated: Tri;
  alternate_present: boolean;
  alternate_duration_hours: number | null;
  alternate_duration_class: DurClass;
  alternate_materially_reduces_loss: Tri;
  /** From redundancy_activation.mode when alternate exists. */
  redundancy_initiation_mode: 'AUTOMATIC' | 'MANUAL_ONSITE' | 'MANUAL_REMOTE' | 'VENDOR_REQUIRED' | 'UNKNOWN';
  restoration_priority_established: Tri;
  recovery_hours: number | null;
  recovery_duration_class: RecClass;
  pace_depth: PaceDepth;
  pace_missing_layers: string[];
};

export type PaceConditions = {
  depth: PaceDepth;
  layers_present: { P: boolean; A: boolean; C: boolean; E: boolean };
  labels?: { P?: string; A?: string; C?: string; E?: string };
};

/** IT-specific derived flags from IT-2_upstream_assets and transport/resilience questions. */
export type ItDerivedConditions = {
  external_services_documented?: boolean;
  external_services_include_identity_access?: boolean;
  external_services_include_backup_storage?: boolean;
  /** True when at least one hosted dependency has no workable continuity (NO_CONTINUITY or legacy NONE). Undefined does not trigger. */
  hosted_continuity_weakness?: boolean;
  /** True when at least one hosted dependency has survivability UNKNOWN (LOW structural driver only). */
  hosted_continuity_unknown?: boolean;
  /** True when at least one hosted dependency has survivability undefined (not yet evaluated). */
  hosted_continuity_unevaluated?: boolean;
  /** True when circuit_count ONE or carrier/entry diversity not strong (for IT-TRANSPORT-01). */
  it_transport_single_path_exposure?: boolean;
  /** True when no designated incident response owner (for IT-IR-01). */
  no_it_incident_response_owner?: boolean;
  /** True when network segmentation is documented (for IT-SEGMENT-01 trigger when false). */
  network_segmentation?: boolean;
};

export type NormalizedConditions = {
  ELECTRIC_POWER: SectorConditions;
  COMMUNICATIONS: SectorConditions & { pace?: PaceConditions };
  INFORMATION_TECHNOLOGY: SectorConditions & ItDerivedConditions;
  WATER: SectorConditions;
  WASTEWATER: SectorConditions;
};

export type NormalizeAccounting = {
  mappedKeys: string[];
  unmappedKeys: string[];
  missingRequiredKeys: string[];
};

const ALTERNATE_THRESHOLDS = { SHORT: 12, MODERATE: 48 } as const;
const RECOVERY_THRESHOLDS = { SHORT: 12, MODERATE: 24 } as const;

function hasValue(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string' && v.trim() === '') return false;
  return true;
}

function getValueFromMap(
  data: Record<string, unknown>,
  sector: SectorKey,
  conditionKey: ConditionKey
): unknown {
  const entries = MAP_BY_SECTOR[sector].filter((e) => e.mapsTo === conditionKey);
  const answers = data.answers as Record<string, unknown> | undefined;
  for (const e of entries) {
    const v = data[e.questionId] ?? answers?.[e.questionId];
    if (hasValue(v)) return v;
  }
  return undefined;
}

function getValuesFromMap(
  data: Record<string, unknown>,
  sector: SectorKey,
  conditionKey: ConditionKey
): unknown[] {
  const entries = MAP_BY_SECTOR[sector].filter((e) => e.mapsTo === conditionKey);
  const answers = data.answers as Record<string, unknown> | undefined;
  const out: unknown[] = [];
  for (const e of entries) {
    const v = data[e.questionId] ?? answers?.[e.questionId];
    if (hasValue(v)) out.push(v);
  }
  return out;
}

function toBoolYesNo(v: unknown): boolean | undefined {
  if (v === true || v === 'yes' || v === 'Yes' || v === 'YES' || v === 'true' || v === 'TRUE') return true;
  if (v === false || v === 'no' || v === 'No' || v === 'NO' || v === 'false' || v === 'FALSE') return false;
  return undefined;
}

function resolveAlternatePresent(
  data: Record<string, unknown>,
  sector: SectorKey
): boolean {
  const answers = data.answers as Record<string, unknown> | undefined;
  const read = (key: string): unknown => data[key] ?? answers?.[key];

  const mappedSignals = getValuesFromMap(data, sector, 'alternate_present')
    .map(toBoolYesNo)
    .filter((v): v is boolean => v !== undefined);
  const hasMappedTrue = mappedSignals.includes(true);
  const hasMappedFalse = mappedSignals.includes(false);

  let strongTrue = false;
  let strongFalse = false;

  const explicitKeysBySector: Record<SectorKey, string[]> = {
    ELECTRIC_POWER: ['E-8_backup_power_available', 'E-8_backup_available'],
    COMMUNICATIONS: ['CO-8_backup_available'],
    INFORMATION_TECHNOLOGY: ['IT-8_backup_available'],
    WATER: ['W_Q8_backup_available', 'W_Q8_alternate_source'],
    WASTEWATER: ['WW_Q7_backup_available'],
  };

  for (const key of explicitKeysBySector[sector]) {
    const b = toBoolYesNo(read(key));
    if (b === true) strongTrue = true;
    if (b === false) strongFalse = true;
  }

  const backupDuration = read('backup_duration_hours');
  if (typeof backupDuration === 'number' && Number.isFinite(backupDuration) && backupDuration > 0) {
    strongTrue = true;
  }
  const curveBackupDuration = read('curve_backup_duration_hours');
  if (typeof curveBackupDuration === 'number' && Number.isFinite(curveBackupDuration) && curveBackupDuration > 0) {
    strongTrue = true;
  }

  const ra = read('redundancy_activation') as { mode?: string | null } | undefined;
  if (ra?.mode && ra.mode !== 'UNKNOWN') {
    strongTrue = true;
  }

  if (sector === 'ELECTRIC_POWER') {
    const hasGenerator = toBoolYesNo(read('has_backup_generator'));
    if (hasGenerator === true) strongTrue = true;
    const assets = read('E-8_backup_assets');
    if (Array.isArray(assets) && assets.length > 0) {
      strongTrue = true;
    }
  }

  if (strongTrue) return true;
  if (strongFalse && !hasMappedTrue) return false;
  if (hasMappedTrue) return true;
  if (hasMappedFalse) return false;
  return false;
}

function toTri(v: unknown): Tri {
  if (v === true || v === 'yes' || v === 'Yes' || v === 'YES') return 'YES';
  if (v === false || v === 'no' || v === 'No' || v === 'NO') return 'NO';
  return 'UNKNOWN';
}

function alternateDurationClass(backupHrs: number, hasBackup: boolean): DurClass {
  if (!hasBackup || backupHrs <= 0) return 'NONE';
  if (backupHrs < ALTERNATE_THRESHOLDS.SHORT) return 'SHORT';
  if (backupHrs <= ALTERNATE_THRESHOLDS.MODERATE) return 'MODERATE';
  return 'LONG';
}

function recoveryDurationClass(recoveryHrs: number): RecClass {
  if (recoveryHrs <= 0) return 'SHORT';
  if (recoveryHrs <= RECOVERY_THRESHOLDS.SHORT) return 'SHORT';
  if (recoveryHrs <= RECOVERY_THRESHOLDS.MODERATE) return 'MODERATE';
  return 'LONG';
}

function clampHours(n: number): number {
  return Math.max(0, Math.min(168, Math.round(n)));
}

function clampPercent(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function derivePaceFromLayers(data: Record<string, unknown>): {
  depth: PaceDepth;
  layers_present: { P: boolean; A: boolean; C: boolean; E: boolean };
  missing: string[];
} {
  const labels: Record<string, string> = { P: 'PRIMARY', A: 'ALTERNATE', C: 'CONTINGENCY', E: 'EMERGENCY' };
  const layers = ['P', 'A', 'C', 'E'] as const;
  const present: { P: boolean; A: boolean; C: boolean; E: boolean } = { P: false, A: false, C: false, E: false };
  const missing: string[] = [];
  let lastPresent = -1;

  for (let i = 0; i < layers.length; i++) {
    const layer = data[`comm_pace_${layers[i]}`] as Record<string, unknown> | undefined;
    const viable =
      layer &&
      typeof layer === 'object' &&
      layer.system_type &&
      layer.system_type !== 'NONE' &&
      layer.system_type !== 'UNKNOWN';
    if (viable) {
      present[layers[i]] = true;
      lastPresent = i;
    } else {
      missing.push(labels[layers[i]]);
    }
  }

  const depth: PaceDepth = lastPresent >= 0 ? (['P', 'PA', 'PAC', 'PACE'] as PaceDepth[])[lastPresent] : 'NONE';
  return { depth, layers_present: present, missing };
}

function normalizeSectorFromMap(
  data: Record<string, unknown>,
  sector: SectorKey
): SectorConditions & { pace?: PaceConditions } & Partial<ItDerivedConditions> {
  const req = getValueFromMap(data, sector, 'requires_service');
  const requiresService = req === true || req === 'yes' || req === 'Yes' || req === 'YES';

  const hasBackup = resolveAlternatePresent(data, sector);

  const altHrsVal = getValueFromMap(data, sector, 'alternate_duration_hours');
  const backupHrs = typeof altHrsVal === 'number' ? clampHours(altHrsVal) : 0;
  const alternate_duration_hours = hasBackup ? backupHrs : null;

  const lossNoVal = data.loss_fraction_no_backup ?? data.curve_loss_fraction_no_backup ?? getValueFromMap(data, sector, 'alternate_materially_reduces_loss');
  const lossNoBackup = typeof lossNoVal === 'number' ? clampPercent(lossNoVal) : 0;
  const lossWithVal = data.loss_fraction_with_backup ?? data.curve_loss_fraction_with_backup;
  const lossWithBackup = typeof lossWithVal === 'number' ? clampPercent(lossWithVal) : 0;

  const ra = data.redundancy_activation as { mode?: string } | undefined;
  const raMode = (ra?.mode ?? 'UNKNOWN') as SectorConditions['redundancy_initiation_mode'];
  const redundancy_initiation_mode =
    raMode && ['AUTOMATIC', 'MANUAL_ONSITE', 'MANUAL_REMOTE', 'VENDOR_REQUIRED', 'UNKNOWN'].includes(raMode)
      ? raMode
      : 'UNKNOWN';

  let alternate_materially_reduces_loss: Tri = 'UNKNOWN';
  if (hasBackup && Number.isFinite(lossNoBackup) && Number.isFinite(lossWithBackup)) {
    const delta = (lossNoBackup - lossWithBackup) * 100;
    if (delta >= 10) alternate_materially_reduces_loss = 'YES';
    else if (delta <= 5) alternate_materially_reduces_loss = 'NO';
  }

  const providerVal = getValueFromMap(data, sector, 'provider_confirmed');
  let provider_confirmed: Conf = 'UNKNOWN';
  if (providerVal === true || providerVal === 'yes' || providerVal === 'Yes') {
    provider_confirmed = 'CONFIRMED';
  } else if (providerVal === false || providerVal === 'no' || providerVal === 'No' || providerVal === 'NO') {
    provider_confirmed = 'UNCONFIRMED';
  } else if (typeof providerVal === 'string' && providerVal.trim().length > 0) {
    provider_confirmed = 'CONFIRMED';
  }

  const singleVal = getValueFromMap(data, sector, 'single_provider_or_path');
  let single_provider_or_path: Tri = 'UNKNOWN';
  if (singleVal === false || singleVal === 'no' || singleVal === 'No') {
    single_provider_or_path = 'YES';
  } else if (singleVal === true || singleVal === 'yes' || singleVal === 'Yes') {
    single_provider_or_path = 'NO';
  } else if (typeof singleVal === 'number') {
    single_provider_or_path = singleVal <= 1 ? 'YES' : 'NO';
  }

  const entryVal = getValueFromMap(data, sector, 'entry_diversity');
  let entry_diversity: Div = 'UNKNOWN';
  if (entryVal === true || entryVal === 'yes' || (typeof entryVal === 'number' && entryVal >= 2) || (Array.isArray(entryVal) && entryVal.length >= 2)) {
    entry_diversity = 'MULTIPLE';
  } else if (entryVal === false || entryVal === 'no' || (typeof entryVal === 'number' && entryVal <= 1) || (Array.isArray(entryVal) && entryVal.length <= 1)) {
    entry_diversity = 'SINGLE';
  }

  const corridorVal = getValueFromMap(data, sector, 'corridor_colocated');
  let corridor_colocated: Tri = 'UNKNOWN';
  if (sector === 'ELECTRIC_POWER' || sector === 'INFORMATION_TECHNOLOGY') {
    const sep = data['E-4_physically_separated'] ?? data['IT-4_physically_separated'] ?? corridorVal;
    corridor_colocated = sep === true || sep === 'yes' ? 'NO' : sep === false || sep === 'no' ? 'YES' : 'UNKNOWN';
  } else if (sector === 'WATER' || sector === 'WASTEWATER') {
    const col = data['W_Q4_collocated_corridor'] ?? data['WW_Q4_collocated_corridor'] ?? corridorVal;
    corridor_colocated = col === true || col === 'yes' ? 'YES' : col === false || col === 'no' ? 'NO' : 'UNKNOWN';
  } else {
    corridor_colocated = corridorVal === true || corridorVal === 'yes' ? 'YES' : corridorVal === false || corridorVal === 'no' ? 'NO' : 'UNKNOWN';
  }

  const restorationVal = getValueFromMap(data, sector, 'restoration_priority_established');
  const restoration_priority_established = toTri(restorationVal);

  const recVal = getValueFromMap(data, sector, 'recovery_hours');
  const recovery_hours = typeof recVal === 'number' ? clampHours(recVal) : null;
  const recovery_duration_class = recoveryDurationClass(recovery_hours ?? 0);

  let pace_depth: PaceDepth = 'NONE';
  let pace_missing_layers: string[] = [];
  let pace: PaceConditions | undefined;

  if (sector === 'COMMUNICATIONS') {
    const paceData = derivePaceFromLayers(data);
    pace_depth = paceData.depth;
    pace_missing_layers = paceData.missing;
    pace = {
      depth: pace_depth,
      layers_present: paceData.layers_present,
    };
  }

  const base: SectorConditions = {
    requires_service: requiresService,
    provider_confirmed,
    single_provider_or_path,
    entry_diversity,
    corridor_colocated,
    alternate_present: hasBackup,
    alternate_duration_hours,
    alternate_duration_class: alternateDurationClass(backupHrs, hasBackup),
    alternate_materially_reduces_loss,
    redundancy_initiation_mode: hasBackup ? redundancy_initiation_mode : 'UNKNOWN',
    restoration_priority_established,
    recovery_hours,
    recovery_duration_class,
    pace_depth,
    pace_missing_layers,
  };

  if (sector === 'COMMUNICATIONS' && pace) {
    return { ...base, pace };
  }

  if (sector === 'INFORMATION_TECHNOLOGY') {
    const requiresService = base.requires_service === true;
    const supply = data.supply as { has_alternate_source?: boolean; sources?: unknown[] } | undefined;
    const sourcesLength = Array.isArray(supply?.sources) ? supply.sources.length : 0;
    const transport = data.it_transport_resilience as {
      circuit_count?: string;
      carrier_diversity?: string;
      building_entry_diversity?: string;
      transport_connection_count?: number | null;
      transport_building_entry_diversity?: 'SAME_ENTRY' | 'SEPARATE_ENTRY' | 'UNKNOWN';
      transport_route_independence?: 'CONFIRMED' | 'NOT_CONFIRMED' | 'UNKNOWN';
    } | undefined;
    let single = base.single_provider_or_path;
    if (transport?.circuit_count === 'ONE') {
      single = 'YES';
    } else if (transport?.circuit_count === 'TWO' || transport?.circuit_count === 'THREE_PLUS') {
      single = 'NO';
    }
    // Transport vulnerability: use ONLY physical fields. Provider count must NOT be used as evidence of independence.
    const connCount = transport?.transport_connection_count ?? (transport?.circuit_count === 'ONE' ? 1 : transport?.circuit_count === 'TWO' ? 2 : transport?.circuit_count === 'THREE_PLUS' ? 3 : null);
    const entryDiv = transport?.transport_building_entry_diversity ?? (transport?.building_entry_diversity === 'SEPARATE_ENTRIES' ? 'SEPARATE_ENTRY' : (transport?.building_entry_diversity === 'SAME_ENTRY' || transport?.building_entry_diversity === 'UNKNOWN' ? transport.building_entry_diversity : 'UNKNOWN'));
    const routeInd = transport?.transport_route_independence ?? 'UNKNOWN';
    const physicalSinglePath =
      connCount === 1 ||
      (connCount != null && connCount >= 2 && (routeInd !== 'CONFIRMED' || entryDiv !== 'SEPARATE_ENTRY')) ||
      (connCount == null && transport?.circuit_count === 'ONE');
    const itTransportSinglePathExposure = requiresService && physicalSinglePath;

    const assets = (data['IT-2_upstream_assets'] as Array<Record<string, unknown>> | undefined) ?? [];
    const hostedResilience = (data.it_hosted_resilience as Record<string, import('schema').ItHostedResilienceEntry> | undefined) ?? {};
    let external_services_documented = assets.length > 0;
    let external_services_include_identity_access = false;
    let external_services_include_backup_storage = false;
    let hosted_continuity_weakness = false;
    let hosted_continuity_unknown = false; // LOW structural driver when any service is UNKNOWN
    let hosted_continuity_unevaluated = false;
    for (const row of assets) {
      const catalogId = (row.service_id ?? '').toString().trim();
      if (!catalogId) continue;
      const catalogIdLower = catalogId.toLowerCase();
      if (catalogIdLower !== 'other') {
        const profile = getHostedServiceProfile(catalogIdLower);
        if (profile) {
          if (profile.category === 'IDENTITY_ACCESS') external_services_include_identity_access = true;
          if (profile.category === 'BACKUP_STORAGE') external_services_include_backup_storage = true;
        }
      }
      const dependencyKey = catalogIdLower === 'other' ? `other_${(row.service_other ?? '').toString().trim() || 'other'}` : catalogIdLower;
      const rawEntry = hostedResilience[dependencyKey];
      const entry = migrateHostedResilienceEntry(rawEntry);
      if (entry.survivability === 'NO_CONTINUITY') {
        hosted_continuity_weakness = true;
      }
      if (entry.survivability === 'UNKNOWN') {
        hosted_continuity_unknown = true;
      }
      if (entry.survivability === undefined) {
        hosted_continuity_unevaluated = true;
      }
    }
    const irOwner = data.it_incident_response_owner ?? data['IT-10_incident_response_owner'];
    const noItIncidentResponseOwner: boolean | undefined =
      irOwner === 'no' || irOwner === false ? true : irOwner === 'yes' || irOwner === true ? false : undefined;
    const seg = data.network_segmentation ?? data['IT-5_survivability'];
    const networkSegmentation: boolean | undefined =
      seg === true || seg === 'yes' ? true : seg === false || seg === 'no' ? false : undefined;
    return {
      ...base,
      single_provider_or_path: single,
      external_services_documented,
      external_services_include_identity_access,
      external_services_include_backup_storage,
      hosted_continuity_weakness,
      hosted_continuity_unknown,
      hosted_continuity_unevaluated,
      it_transport_single_path_exposure: itTransportSinglePathExposure === true,
      no_it_incident_response_owner: noItIncidentResponseOwner,
      network_segmentation: networkSegmentation,
    };
  }

  return base;
}

const REQUIRED_CONDITION_KEYS: ConditionKey[] = [
  'requires_service',
  'provider_confirmed',
  'single_provider_or_path',
  'entry_diversity',
  'corridor_colocated',
  'alternate_present',
  'alternate_duration_hours',
  'alternate_materially_reduces_loss',
  'restoration_priority_established',
  'recovery_hours',
  'pace_depth',
  'pace_layers_present',
];

const MAPPED_QUESTION_IDS = new Set(QUESTION_CONDITION_MAP.map((e) => e.questionId));

/** Deprecated/removed question keys still allowed in stored assessments (not reported as unmapped). */
const DEPRECATED_ALLOWED_KEYS: Record<SectorKey, Set<string>> = {
  ELECTRIC_POWER: new Set(['E-1_can_identify_providers', 'E-1_utility_providers']),
  COMMUNICATIONS: new Set(),
  INFORMATION_TECHNOLOGY: new Set(),
  WATER: new Set(['W_Q5_provider_upstream_identified']),
  WASTEWATER: new Set(['WW_Q5_provider_upstream_identified']),
};

/** PRA/SLA overlay keys: present in assessment but not part of base report condition mapping. Do not report as unmapped. */
const NON_REPORT_KEYS = new Set<string>([
  'INFORMATION_TECHNOLOGY:pra_sla',
  'INFORMATION_TECHNOLOGY:it_pra_sla_providers',
]);

/** Report-only legacy keys: live in sessions.derived, not categories. Do not throw; do not render from categories. */
const REPORT_ONLY_LEGACY_KEYS = new Set<string>(['report_themed_findings']);

/**
 * Produce normalized conditions with accounting.
 */
export function normalizeDependencyConditions(assessment: Assessment): {
  normalized: NormalizedConditions;
  accounting: NormalizeAccounting;
} {
  const categories = assessment.categories ?? {};
  const mappedKeys: string[] = [];
  const unmappedKeys: string[] = [];
  const missingRequiredKeys: string[] = [];

  const sectors: SectorKey[] = [
    'ELECTRIC_POWER',
    'COMMUNICATIONS',
    'INFORMATION_TECHNOLOGY',
    'WATER',
    'WASTEWATER',
  ];

  const normalized: NormalizedConditions = {
    ELECTRIC_POWER: {} as SectorConditions,
    COMMUNICATIONS: {} as SectorConditions & { pace?: PaceConditions },
    INFORMATION_TECHNOLOGY: {} as SectorConditions,
    WATER: {} as SectorConditions,
    WASTEWATER: {} as SectorConditions,
  };

  for (const sector of sectors) {
    const cat = categories[sector] as Record<string, unknown> | undefined;
    const data: Record<string, unknown> = cat
      ? { ...cat, ...(cat.answers as Record<string, unknown>) }
      : {};
    if (cat && typeof cat === 'object') {
      delete (data as Record<string, unknown>).answers;
    }
    // IT: derive single IT-11_restoration_coordination from per-ISP pra_sla.providers (primary) for condition map
    if (sector === 'INFORMATION_TECHNOLOGY' && cat) {
      const praSla = cat.pra_sla as { providers?: Array<{ restoration_coordination?: string }> } | undefined;
      const providers = praSla?.providers;
      if (Array.isArray(providers) && providers.length > 0 && providers[0].restoration_coordination != null) {
        data['IT-11_restoration_coordination'] = providers[0].restoration_coordination;
      }
    }

    const sectorMapped = new Set<string>();
    const sectorQuestionIds = new Set(MAP_BY_SECTOR[sector].map((e) => e.questionId));
    const deprecatedAllowed = DEPRECATED_ALLOWED_KEYS[sector];
    for (const k of Object.keys(data)) {
      if (sectorQuestionIds.has(k)) {
        sectorMapped.add(k);
      } else if (hasValue(data[k]) && k !== 'answers') {
        if (deprecatedAllowed?.has(k)) continue; // backward compat: allow removed question keys
        if (REPORT_ONLY_LEGACY_KEYS.has(k)) continue; // report output in sessions.derived; do not crash
        const fullKey = `${sector}:${k}`;
        if (NON_REPORT_KEYS.has(fullKey)) continue; // PRA/SLA overlay etc.: not part of base report
        unmappedKeys.push(fullKey);
      }
    }
    mappedKeys.push(...Array.from(sectorMapped).map((k) => `${sector}:${k}`));

    const cond = normalizeSectorFromMap(data, sector);
    (normalized as Record<string, unknown>)[sector] = cond;

    if (cat && hasValue(cat.requires_service) ? cat.requires_service !== false : true) {
      for (const req of REQUIRED_CONDITION_KEYS) {
        if (req === 'pace_depth' || req === 'pace_layers_present') {
          if (sector !== 'COMMUNICATIONS') continue;
        }
        const val = getValueFromMap(data, sector, req);
        if (!hasValue(val) && req !== 'alternate_duration_hours' && req !== 'recovery_hours') {
          const entries = MAP_BY_SECTOR[sector].filter((e) => e.mapsTo === req);
          if (entries.length > 0) {
            missingRequiredKeys.push(`${sector}:${req}`);
          }
        }
      }
    }
  }

  return {
    normalized,
    accounting: {
      mappedKeys: [...new Set(mappedKeys)],
      unmappedKeys,
      missingRequiredKeys: [...new Set(missingRequiredKeys)],
    },
  };
}

/** Backward-compat: return only normalized (for callers that don't need accounting). */
export function normalizeDependencyConditionsLegacy(assessment: Assessment): Partial<NormalizedConditions> {
  const { normalized } = normalizeDependencyConditions(assessment);
  const out: Partial<NormalizedConditions> = {};
  for (const k of Object.keys(normalized) as (keyof NormalizedConditions)[]) {
    const v = normalized[k];
    if (v && typeof v === 'object' && 'requires_service' in v) {
      out[k] = v as SectorConditions;
    }
  }
  return out;
}

/** Legacy type alias for alternate_present (was AlternatePresent YES|NO). */
export type AlternatePresent = 'YES' | 'NO';
export type ProviderConfidence = Conf;
export type YesNoUnknown = Tri;
export type EntryDiversity = Div;
export type AlternateDurationClass = DurClass;
export type RecoveryDurationClass = RecClass;

/**
 * Merge normalized conditions into answer map for catalog evaluator compatibility.
 */
export function mergeNormalizedIntoAnswers(
  raw: Record<string, unknown>,
  conditions: SectorConditions | undefined,
  sector: keyof NormalizedConditions
): Record<string, unknown> {
  const out = { ...raw };
  if (!conditions) return out;

  const q = (k: string, v: unknown) => {
    if (out[k] === undefined) out[k] = v;
  };

  const altPresent = conditions.alternate_present ? 'YES' : 'NO';

  if (conditions.provider_confirmed !== 'CONFIRMED') {
    if (sector === 'ELECTRIC_POWER') q('E-2', 'no');
    if (sector === 'COMMUNICATIONS') q('CO-1_provider_identified', 'no');
    if (sector === 'INFORMATION_TECHNOLOGY') q('IT-1', 'no');
  }
  if (conditions.single_provider_or_path === 'YES') {
    if (sector === 'ELECTRIC_POWER') q('E-3', 1);
    if (sector === 'COMMUNICATIONS') q('CO-2_single_path', true);
    if (sector === 'INFORMATION_TECHNOLOGY') q('IT-3_redundancy_present', false);
    if (sector === 'WATER') q('W_Q2_connection_count', 1);
    if (sector === 'WASTEWATER') q('WW_Q2_connection_count', 1);
  }
  if (conditions.entry_diversity === 'SINGLE') {
    if (sector === 'ELECTRIC_POWER') q('E-4', []);
    if (sector === 'COMMUNICATIONS') q('CO-4_same_geographic_location', true);
    if (sector === 'INFORMATION_TECHNOLOGY') q('IT-4_geographically_separated', false);
    if (sector === 'WATER') q('W_Q3_same_geographic_location', true);
  }
  if (conditions.corridor_colocated === 'YES') {
    if (sector === 'ELECTRIC_POWER') q('E-4', []);
    if (sector === 'COMMUNICATIONS') q('CO-4_same_geographic_location', true);
  }
  if (altPresent === 'NO') {
    if (sector === 'ELECTRIC_POWER') q('E-8', []);
    if (sector === 'COMMUNICATIONS') q('comm_alternate_present', false);
    if (sector === 'INFORMATION_TECHNOLOGY') q('IT-5_backup', false);
    if (sector === 'WATER') q('W_Q4_backup', false);
    if (sector === 'WASTEWATER') q('WW_Q4_backup', false);
  }
  if (conditions.alternate_duration_class === 'SHORT') {
    if (sector === 'ELECTRIC_POWER') q('E-9', false);
  }
  if (conditions.alternate_materially_reduces_loss === 'NO') {
    if (sector === 'ELECTRIC_POWER') q('E-5', false);
  }
  if (conditions.restoration_priority_established !== 'YES') {
    if (sector === 'ELECTRIC_POWER') q('E-11', false);
    if (sector === 'COMMUNICATIONS') q('comm_restoration_coordination', false);
    if (sector === 'INFORMATION_TECHNOLOGY') q('IT-11', false);
    if (sector === 'WATER') q('W_Q6', false);
    if (sector === 'WASTEWATER') q('WW_Q6', false);
  }

  return out;
}
