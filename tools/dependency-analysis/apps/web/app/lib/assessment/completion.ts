/**
 * Assessment Completion Evaluator
 *
 * Computes completion % from VISIBLE REQUIRED questions only.
 * Does NOT use NormalizedConditions, mapping tables, or representation contracts.
 * Source of truth: same question specs and visibility rules that drive the UI.
 */
import type { Assessment } from 'schema';
import { shouldShowQuestion } from '@/lib/dependencies/question-visibility';
import { isPraSlaEnabled } from '@/lib/pra-sla-enabled';
import {
  WATER_CURVE_QUESTIONS,
  WATER_QUESTIONS,
  type WaterQuestionDef,
} from '@/app/lib/dependencies/infrastructure/water_spec';
import {
  WASTEWATER_CURVE_QUESTIONS,
  WASTEWATER_QUESTIONS,
  type WastewaterQuestionDef,
} from '@/app/lib/dependencies/infrastructure/wastewater_spec';
import { COMMUNICATIONS_QUESTIONS } from '@/app/lib/dependencies/infrastructure/comms_spec';
import type { CommsAnswers } from '@/app/lib/dependencies/infrastructure/comms_spec';
import { ENERGY_CURVE_QUESTIONS, ENERGY_QUESTIONS } from '@/app/lib/dependencies/infrastructure/energy_spec';
import { IT_CURVE_QUESTIONS, IT_QUESTIONS, validateHostedContinuityRequired } from '@/app/lib/dependencies/infrastructure/it_spec';
import { CURVE_ID_ALIASES } from '@/app/lib/dependencies/canonical_question_order';

export type SectorKey =
  | 'ELECTRIC_POWER'
  | 'COMMUNICATIONS'
  | 'INFORMATION_TECHNOLOGY'
  | 'WATER'
  | 'WASTEWATER';

export type SectorCompletion = {
  pct: number;
  requiredTotal: number;
  requiredAnswered: number;
  missing: string[];
};

export type CompletionResult = {
  overallPct: number;
  bySector: Record<SectorKey, SectorCompletion>;
  isComplete: boolean;
};

/** Question ID -> storage key(s) to check. First key with value counts as answered. */
const ENERGY_QUESTION_TO_KEYS: Record<string, string[]> = {
  curve_requires_service: ['curve_requires_service', 'requires_service'],
  curve_primary_provider: ['curve_primary_provider'],
  curve_time_to_impact: ['curve_time_to_impact_hours'],
  curve_loss_no_backup: ['curve_loss_fraction_no_backup'],
  curve_backup_available: ['curve_backup_available', 'has_backup_any', 'has_backup'],
  curve_backup_duration: ['curve_backup_duration_hours'],
  curve_loss_with_backup: ['curve_loss_fraction_with_backup'],
  curve_recovery_time: ['curve_recovery_time_hours'],
  'E-2': ['E-2_can_identify_substations', 'E-2_substations', 'E-2'],
  'E-3': ['E-3_more_than_one_connection', 'E-3_service_connection_count', 'E-3'],
  'E-4': ['E-4_physically_separated', 'E-4_service_connections', 'E-4'],
  'E-5': ['E-5_single_supports_core_ops', 'E-5_core_ops_capable', 'E-5'],
  'E-6': ['E-6_exterior_protected', 'E-6_exterior_protections', 'E-6'],
  'E-7': ['E-7_vehicle_impact_exposure', 'E-7'],
  'E-7a': ['E-7a_vehicle_impact_protection', 'E-7a'],
  'E-8': ['E-8_backup_power_available', 'E-8_backup_assets', 'E-8'],
  'E-9': ['E-9_refuel_sustainment_established', 'E-9_sustainment', 'E-9'],
  'E-10': ['E-10_tested_under_load', 'E-10_testing', 'E-10'],
  'E-11': ['E-11_provider_restoration_coordination', 'E-11_priority_restoration', 'E-11'],
};

const WATER_QUESTION_TO_KEYS: Record<string, string[]> = {
  curve_requires_service: ['curve_requires_service', 'requires_service'],
  curve_primary_provider: ['curve_primary_provider'],
  curve_time_to_impact: ['curve_time_to_impact_hours'],
  curve_loss_no_backup: ['curve_loss_fraction_no_backup'],
  curve_backup_available: ['curve_backup_available', 'has_backup_any', 'has_backup'],
  curve_backup_duration: ['curve_backup_duration_hours'],
  curve_loss_with_backup: ['curve_loss_fraction_with_backup'],
  curve_recovery_time: ['curve_recovery_time_hours'],
  W_Q1: ['W_Q1_municipal_supply'],
  W_Q2: ['W_Q2_connection_count'],
  W_Q3: ['W_Q3_same_geographic_location'],
  W_Q4: ['W_Q4_collocated_corridor'],
  W_Q6: ['W_Q6_priority_restoration'],
  W_Q7: ['W_Q7_contingency_plan'],
  W_Q8: ['W_Q8_alternate_source', 'W_Q8_backup_available'],
  W_Q9: ['W_Q9_alternate_supports_core'],
  W_Q10: ['W_Q10_alternate_depends_on_power'],
  W_Q11: ['W_Q11_water_based_suppression'],
  W_Q12: ['W_Q12_fire_secondary_supply'],
  W_Q13: ['W_Q13_fire_impact_evaluated'],
  W_Q14: ['W_Q14_onsite_pumping'],
  W_Q15: ['W_Q15_backup_power_pumps'],
  W_Q16: ['W_Q16_manual_override'],
  W_Q17: ['W_Q17_pump_alarming'],
  W_Q18: ['W_Q18_dual_source_parts'],
};

const WASTEWATER_QUESTION_TO_KEYS: Record<string, string[]> = {
  curve_requires_service: ['curve_requires_service', 'requires_service'],
  curve_primary_provider: ['curve_primary_provider'],
  curve_time_to_impact: ['curve_time_to_impact_hours'],
  curve_loss_no_backup: ['curve_loss_fraction_no_backup'],
  curve_backup_available: ['curve_backup_available', 'has_backup_any', 'has_backup'],
  curve_backup_duration: ['curve_backup_duration_hours'],
  curve_loss_with_backup: ['curve_loss_fraction_with_backup'],
  curve_recovery_time: ['curve_recovery_time_hours'],
  WW_Q1: ['WW_Q1_discharge_to_sewer'],
  WW_Q2: ['WW_Q2_connection_count'],
  WW_Q3: ['WW_Q3_same_geographic_location'],
  WW_Q4: ['WW_Q4_collocated_corridor'],
  WW_Q6: ['WW_Q6_priority_restoration'],
  WW_Q7: ['WW_Q7_contingency_plan'],
  WW_Q8: ['WW_Q8_onsite_pumping'],
  WW_Q9: ['WW_Q9_backup_power_pumps'],
  WW_Q10: ['WW_Q10_manual_override'],
  WW_Q11: ['WW_Q11_pump_alarming'],
  WW_Q12: ['WW_Q12_dual_source_parts'],
  WW_Q13: ['WW_Q13_holding_capacity'],
  WW_Q14: ['WW_Q14_constraints_evaluated'],
};

const COMMS_QUESTION_TO_KEYS: Record<string, string[]> = {
  'COMM-0': ['comm_voice_functions'],
  curve_requires_service: ['curve_requires_service', 'requires_service'],
  curve_primary_provider: ['curve_primary_provider'],
  curve_time_to_impact_hours: ['curve_time_to_impact_hours'],
  curve_loss_fraction_no_backup: ['curve_loss_fraction_no_backup'],
  curve_backup_available: ['curve_backup_available'],
  curve_backup_duration_hours: ['curve_backup_duration_hours'],
  curve_loss_fraction_with_backup: ['curve_loss_fraction_with_backup'],
  curve_recovery_time_hours: ['curve_recovery_time_hours'],
  'COMM-SP1': ['comm_single_point_voice_failure'],
  'COMM-SP2': ['comm_interoperability'],
  'COMM-SP3': ['comm_restoration_coordination'],
};

const IT_QUESTION_TO_KEYS: Record<string, string[]> = {
  curve_requires_service: ['curve_requires_service', 'requires_service'],
  curve_primary_provider: ['curve_primary_provider'],
  curve_time_to_impact: ['curve_time_to_impact_hours'],
  curve_loss_no_backup: ['curve_loss_fraction_no_backup'],
  curve_backup_available: ['curve_backup_available'],
  curve_loss_with_backup: ['curve_loss_fraction_with_backup'],
  curve_recovery_time: ['curve_recovery_time_hours'],
  'IT-1': ['IT-1_can_identify_providers', 'IT-1_service_providers', 'IT-1'],
  'IT-2': ['IT-2_can_identify_assets', 'IT-2_upstream_assets', 'IT-2'],
  'IT-3': ['IT-3_redundancy_present', 'IT-3_multiple_connections', 'IT-3'],
  'IT-4': ['IT-4_physically_separated', 'IT-4_service_connections', 'IT-4'],
  'IT-5': ['IT-5_survivability'],
  'IT-6': ['IT-6_components_protected', 'IT-6_protections'],
  'IT-7': ['IT-7_vehicle_impact_exposure', 'IT-7_installation_location'],
  'IT-7a': ['IT-7a_vehicle_impact_protection'],
  'IT-11': ['IT-11_restoration_coordination', 'IT-11', 'it_pra_sla_providers'],
};

function isFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return true;
  if (Array.isArray(value)) return true;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function getValue(data: Record<string, unknown>, keys: string[]): unknown {
  const answers = data.answers as Record<string, unknown> | undefined;
  const merged = { ...data, ...answers };
  for (const k of keys) {
    const v = merged[k];
    if (isFilled(v)) return v;
  }
  return undefined;
}

function isAnswered(data: Record<string, unknown>, questionId: string, keyMap: Record<string, string[]>): boolean {
  const keys = keyMap[questionId];
  if (!keys) return false;
  return getValue(data, keys) !== undefined;
}

/** Energy: visible slots mirror getVisibleQuestionSlots in EnergyQuestionnaireSection */
function getEnergyVisibleQuestionIds(data: Record<string, unknown>): string[] {
  const requiresService = data.curve_requires_service === true || data.requires_service === true;
  const hasBackup =
    data.curve_backup_available === 'yes' ||
    data.has_backup_any === true ||
    data.has_backup === true;
  const moreThanOneConnection = data['E-3_more_than_one_connection'] === 'yes';

  const ids: string[] = [];
  ids.push('curve_requires_service');
  if (requiresService) ids.push('curve_primary_provider');
  if (requiresService) {
    ids.push('curve_time_to_impact', 'curve_loss_no_backup', 'curve_backup_available');
    if (hasBackup) ids.push('curve_backup_duration', 'curve_loss_with_backup');
    ids.push('curve_recovery_time');
  }

  if (!requiresService) return ids;

  for (let e = 2; e <= 11; e++) {
    if ((e === 9 || e === 10) && !hasBackup) continue;
    if (e === 4 && !moreThanOneConnection) continue;
    // E-11 (restoration coordination) is optional for completion so export is not blocked
    if (e === 11) continue;
    ids.push(`E-${e}`);
    if (e === 7 && data['E-7_vehicle_impact_exposure'] === 'yes') ids.push('E-7a');
  }
  return ids;
}

/** Comms: use showWhen from COMMUNICATIONS_QUESTIONS */
function getCommsVisibleQuestionIds(data: Record<string, unknown>): string[] {
  const answers = data as CommsAnswers;
  const ids: string[] = [];
  for (const q of COMMUNICATIONS_QUESTIONS) {
    if (q.showWhen && !q.showWhen(answers)) continue;
    ids.push(q.id);
  }
  return ids;
}

/** IT: same curve gating as Energy. IT-11 (PRA/SLA) only when overlay enabled. */
function getItVisibleQuestionIds(data: Record<string, unknown>, praSlaEnabled?: boolean): string[] {
  const requiresService = data.curve_requires_service === true || data.requires_service === true;
  const hasBackup = data.curve_backup_available === 'yes' || data.has_backup_any === true || data.has_backup === true;

  const ids: string[] = [];
  ids.push('curve_requires_service');
  if (requiresService) ids.push('curve_primary_provider');
  if (requiresService) {
    ids.push('curve_time_to_impact', 'curve_loss_no_backup', 'curve_backup_available');
    if (hasBackup) ids.push('curve_loss_with_backup');
    ids.push('curve_recovery_time');
  }
  if (!requiresService) return ids;

  const itIds = ['IT-1', 'IT-2', 'IT-3', 'IT-4', 'IT-5', 'IT-6', 'IT-7', 'IT-7a'];
  if (praSlaEnabled === true) itIds.push('IT-11');
  ids.push(...itIds);
  return ids;
}

/** Water: mirror WaterQuestionnaireSection filter logic. curve_backup_duration/curve_loss_with_backup gated by W_Q8_alternate_source. */
function getWaterVisibleQuestionIds(
  data: Record<string, unknown>,
  praSlaEnabled: boolean
): string[] {
  const requiresService = data.curve_requires_service === true || data.requires_service === true;
  const hasAlternate = data.W_Q8_alternate_source === 'yes';
  const ids: string[] = [];

  ids.push('curve_requires_service');
  if (requiresService) ids.push('curve_primary_provider');
  if (requiresService) {
    ids.push('curve_time_to_impact', 'curve_loss_no_backup', 'curve_backup_available');
    if (hasAlternate) ids.push('curve_backup_duration', 'curve_loss_with_backup');
    ids.push('curve_recovery_time');
  }
  if (!requiresService) return ids;

  const baseline = ['W_Q1', 'W_Q2', 'W_Q3', 'W_Q4', 'W_Q6', 'W_Q7'];
  const physical = ['W_Q8', 'W_Q9', 'W_Q10'];
  const coordination = ['W_Q11', 'W_Q12', 'W_Q13', 'W_Q14', 'W_Q15', 'W_Q16', 'W_Q17', 'W_Q18'];

  for (const q of WATER_QUESTIONS) {
    if (!baseline.includes(q.id) && !physical.includes(q.id) && !coordination.includes(q.id)) continue;
    if (!shouldShowQuestion(q.id, (q as WaterQuestionDef).scope, praSlaEnabled)) continue;
    if (q.id === 'W_Q2' && data.W_Q1_municipal_supply === 'no') continue;
    if (q.id === 'W_Q3' && data.W_Q1_municipal_supply === 'no') continue;
    if (q.id === 'W_Q4' && data.W_Q1_municipal_supply === 'no') continue;
    if (q.id === 'W_Q6' && data.W_Q1_municipal_supply === 'no') continue;
    if (q.id === 'W_Q7' && data.W_Q1_municipal_supply === 'no') continue;
    if (q.id === 'W_Q9' && data.W_Q8_alternate_source !== 'yes') continue;
    if (q.id === 'W_Q10' && data.W_Q8_alternate_source !== 'yes') continue;
    if (q.id === 'W_Q12' && data.W_Q11_water_based_suppression !== 'yes') continue;
    if (q.id === 'W_Q13' && data.W_Q11_water_based_suppression !== 'yes') continue;
    if (q.id === 'W_Q15' && data.W_Q14_onsite_pumping !== 'yes') continue;
    if (q.id === 'W_Q16' && data.W_Q14_onsite_pumping !== 'yes') continue;
    if (q.id === 'W_Q17' && data.W_Q14_onsite_pumping !== 'yes') continue;
    if (q.id === 'W_Q18' && data.W_Q14_onsite_pumping !== 'yes') continue;
    ids.push(q.id);
  }
  return ids;
}

/** Wastewater: mirror WastewaterQuestionnaireSection filter logic. curve_backup_duration/curve_loss_with_backup gated by WW_Q13_holding_capacity. */
function getWastewaterVisibleQuestionIds(
  data: Record<string, unknown>,
  praSlaEnabled: boolean
): string[] {
  const requiresService = data.curve_requires_service === true || data.requires_service === true;
  const hasBackup = data.WW_Q13_holding_capacity === 'yes';
  const ids: string[] = [];

  ids.push('curve_requires_service');
  if (requiresService) ids.push('curve_primary_provider');
  if (requiresService) {
    ids.push('curve_time_to_impact', 'curve_loss_no_backup', 'curve_backup_available');
    if (hasBackup) ids.push('curve_backup_duration', 'curve_loss_with_backup');
    ids.push('curve_recovery_time');
  }
  if (!requiresService) return ids;

  const baseline = ['WW_Q1', 'WW_Q2', 'WW_Q3', 'WW_Q4', 'WW_Q6', 'WW_Q7'];
  const physical = ['WW_Q8', 'WW_Q9', 'WW_Q10'];
  const coordination = ['WW_Q11', 'WW_Q12', 'WW_Q13', 'WW_Q14'];

  for (const q of WASTEWATER_QUESTIONS) {
    if (!baseline.includes(q.id) && !physical.includes(q.id) && !coordination.includes(q.id)) continue;
    if (!shouldShowQuestion(q.id, (q as WastewaterQuestionDef).scope, praSlaEnabled)) continue;
    if (q.id === 'WW_Q2' && data.WW_Q1_discharge_to_sewer === 'no') continue;
    if (q.id === 'WW_Q3' && data.WW_Q1_discharge_to_sewer === 'no') continue;
    if (q.id === 'WW_Q4' && data.WW_Q1_discharge_to_sewer === 'no') continue;
    if (q.id === 'WW_Q6' && data.WW_Q1_discharge_to_sewer === 'no') continue;
    if (q.id === 'WW_Q7' && data.WW_Q1_discharge_to_sewer === 'no') continue;
    if (q.id === 'WW_Q9' && data.WW_Q8_onsite_pumping !== 'yes') continue;
    if (q.id === 'WW_Q10' && data.WW_Q8_onsite_pumping !== 'yes') continue;
    if (q.id === 'WW_Q11' && data.WW_Q8_onsite_pumping !== 'yes') continue;
    if (q.id === 'WW_Q12' && data.WW_Q8_onsite_pumping !== 'yes') continue;
    if (q.id === 'WW_Q13' && data.WW_Q1_discharge_to_sewer === 'no') continue;
    if (q.id === 'WW_Q14' && data.WW_Q1_discharge_to_sewer === 'no') continue;
    ids.push(q.id);
  }
  return ids;
}

function resolveQuestionIdToKeys(questionId: string, keyMap: Record<string, string[]>): string[] {
  const direct = keyMap[questionId];
  if (direct) return direct;
  const aliased = CURVE_ID_ALIASES[questionId as keyof typeof CURVE_ID_ALIASES];
  if (aliased) return keyMap[aliased] ?? [questionId];
  return [questionId];
}

/** True when category has no reliance/curve data and no sector answers (user never interacted). */
function isCategoryEffectivelyEmpty(
  data: Record<string, unknown>,
  sector: SectorKey
): boolean {
  const hasReliance = data.curve_requires_service !== undefined || data.requires_service !== undefined;
  if (hasReliance) return false;
  const keys = Object.keys(data).filter(
    (k) => k.startsWith('curve_') || k.startsWith('WW_Q') || k.startsWith('W_Q')
  );
  return keys.length === 0;
}

function computeSectorCompletion(
  data: Record<string, unknown>,
  sector: SectorKey,
  getVisibleIds: (data: Record<string, unknown>, praSlaEnabled?: boolean) => string[],
  keyMap: Record<string, string[]>,
  praSlaEnabled: boolean
): SectorCompletion {
  const visibleIds = getVisibleIds(data, praSlaEnabled);
  let requiredTotal = visibleIds.length;
  const missing: string[] = [];
  let requiredAnswered = 0;

  for (const qId of visibleIds) {
    const keys = resolveQuestionIdToKeys(qId, keyMap);
    const answered = getValue(data, keys) !== undefined;
    if (answered) {
      requiredAnswered++;
    } else {
      missing.push(qId);
    }
  }

  // When the only required question is curve_requires_service and the category is empty,
  // treat as complete (user did not require this sector; no need to block export).
  if (
    (sector === 'WASTEWATER' || sector === 'WATER') &&
    requiredTotal === 1 &&
    missing.length === 1 &&
    missing[0] === 'curve_requires_service' &&
    isCategoryEffectivelyEmpty(data, sector)
  ) {
    requiredAnswered = 1;
    missing.length = 0;
  }

  const pct = requiredTotal === 0 ? 100 : Math.round((requiredAnswered / requiredTotal) * 100);
  return { pct, requiredTotal, requiredAnswered, missing };
}

/**
 * Compute assessment completion from visible required questions only.
 * Does NOT use NormalizedConditions or representation contracts.
 */
export function computeCompletion(assessment: Assessment): CompletionResult {
  const categories = assessment.categories ?? {};
  const praSlaEnabled = isPraSlaEnabled(assessment);

  const sectors: SectorKey[] = [
    'ELECTRIC_POWER',
    'COMMUNICATIONS',
    'INFORMATION_TECHNOLOGY',
    'WATER',
    'WASTEWATER',
  ];

  const bySector = {} as Record<SectorKey, SectorCompletion>;
  let totalRequired = 0;
  let totalAnswered = 0;

  for (const sector of sectors) {
    const cat = categories[sector] as Record<string, unknown> | undefined;
    const data: Record<string, unknown> = cat
      ? { ...cat, ...(cat.answers as Record<string, unknown>) }
      : {};
    if (cat && typeof cat === 'object') delete (data as Record<string, unknown>).answers;

    let result: SectorCompletion;
    switch (sector) {
      case 'ELECTRIC_POWER':
        result = computeSectorCompletion(
          data,
          sector,
          (d) => getEnergyVisibleQuestionIds(d),
          ENERGY_QUESTION_TO_KEYS,
          praSlaEnabled
        );
        break;
      case 'COMMUNICATIONS':
        result = computeSectorCompletion(
          data,
          sector,
          (d) => getCommsVisibleQuestionIds(d),
          COMMS_QUESTION_TO_KEYS,
          praSlaEnabled
        );
        break;
      case 'INFORMATION_TECHNOLOGY':
        result = computeSectorCompletion(
          data,
          sector,
          (d, pra) => getItVisibleQuestionIds(d, pra ?? false),
          IT_QUESTION_TO_KEYS,
          praSlaEnabled
        );
        break;
      case 'WATER':
        result = computeSectorCompletion(
          data,
          sector,
          (d, pra) => getWaterVisibleQuestionIds(d, pra ?? false),
          WATER_QUESTION_TO_KEYS,
          praSlaEnabled
        );
        break;
      case 'WASTEWATER':
        result = computeSectorCompletion(
          data,
          sector,
          (d, pra) => getWastewaterVisibleQuestionIds(d, pra ?? false),
          WASTEWATER_QUESTION_TO_KEYS,
          praSlaEnabled
        );
        break;
      default:
        result = { pct: 100, requiredTotal: 0, requiredAnswered: 0, missing: [] };
    }

    bySector[sector] = result;
    totalRequired += result.requiredTotal;
    totalAnswered += result.requiredAnswered;
  }

  const overallPct = totalRequired === 0 ? 100 : Math.round((totalAnswered / totalRequired) * 100);
  const isComplete = totalRequired === 0 || totalAnswered >= totalRequired;

  return {
    overallPct,
    bySector,
    isComplete,
  };
}

export const SECTOR_LABELS: Record<SectorKey, string> = {
  ELECTRIC_POWER: 'Electric Power',
  COMMUNICATIONS: 'Communications',
  INFORMATION_TECHNOLOGY: 'Information Technology',
  WATER: 'Water',
  WASTEWATER: 'Wastewater',
};

/** Sector-specific label map: `${sector}:${questionId}` -> prompt. Prevents Water/Wastewater curve labels from colliding. */
function buildSectorQuestionLabelMap(): Record<string, string> {
  const map: Record<string, string> = {};
  const add = (sector: SectorKey, items: Array<{ id: string; prompt: string }>) => {
    for (const q of items) map[`${sector}:${q.id}`] = q.prompt;
  };
  add('ELECTRIC_POWER', ENERGY_CURVE_QUESTIONS);
  add('ELECTRIC_POWER', ENERGY_QUESTIONS);
  add('COMMUNICATIONS', COMMUNICATIONS_QUESTIONS);
  add('INFORMATION_TECHNOLOGY', IT_CURVE_QUESTIONS);
  add('INFORMATION_TECHNOLOGY', IT_QUESTIONS);
  add('WATER', WATER_CURVE_QUESTIONS);
  add('WATER', WATER_QUESTIONS);
  add('WASTEWATER', WASTEWATER_CURVE_QUESTIONS);
  add('WASTEWATER', WASTEWATER_QUESTIONS);
  const curveTime = 'Time to impact (hours)';
  map['ELECTRIC_POWER:curve_time_to_impact'] = curveTime;
  map['INFORMATION_TECHNOLOGY:curve_time_to_impact'] = curveTime;
  map['WATER:curve_time_to_impact'] = curveTime;
  map['WASTEWATER:curve_time_to_impact'] = curveTime;
  return map;
}

const SECTOR_QUESTION_LABEL_MAP = buildSectorQuestionLabelMap();

export type FirstMissingInfo = {
  sector: SectorKey;
  sectorLabel: string;
  questionId: string;
  label: string;
};

/**
 * Export preflight: returns explicit errors that block export.
 * Export allowed when errors array is empty.
 */
export type ExportPreflightErrorDetail = {
  message: string;
  sector?: SectorKey;
};

export type ExportPreflightResult = {
  canExport: boolean;
  errors: string[];
  /** Same as errors but with optional sector for linking to the missing section. */
  errorDetails: ExportPreflightErrorDetail[];
};

export function computeExportPreflight(
  assessment: Assessment,
  completion: CompletionResult,
  templateReady: boolean
): ExportPreflightResult {
  const errors: string[] = [];
  const errorDetails: ExportPreflightErrorDetail[] = [];

  if (!templateReady) {
    const msg = 'Report template is not ready. Upload a template with required anchors.';
    errors.push(msg);
    errorDetails.push({ message: msg });
  }

  const categories = assessment.categories ?? {};
  const sectorToInfra: Record<SectorKey, string> = {
    ELECTRIC_POWER: 'Electric Power',
    COMMUNICATIONS: 'Communications',
    INFORMATION_TECHNOLOGY: 'Information Technology',
    WATER: 'Water',
    WASTEWATER: 'Wastewater',
  };

  for (const sector of ['ELECTRIC_POWER', 'COMMUNICATIONS', 'INFORMATION_TECHNOLOGY', 'WATER', 'WASTEWATER'] as SectorKey[]) {
    const cat = categories[sector] as Record<string, unknown> | undefined;
    const data = cat ? { ...cat, ...(cat?.answers as Record<string, unknown>) } : {};
    if (cat && typeof cat === 'object') delete (data as Record<string, unknown>).answers;

    const requiresService =
      data.curve_requires_service === true ||
      data.requires_service === true ||
      (typeof data.curve_requires_service === 'string' && data.curve_requires_service.toLowerCase() === 'yes');

    if (!requiresService) continue;

    const timeToImpact = data.curve_time_to_impact_hours ?? data.time_to_impact_hours;
    const lossNoBackup = data.curve_loss_fraction_no_backup ?? data.loss_fraction_no_backup;
    const recoveryTime = data.curve_recovery_time_hours ?? data.recovery_time_hours;
    const backupDuration = data.curve_backup_duration_hours ?? data.backup_duration_hours;
    const hasTimeToImpact =
      timeToImpact !== undefined && timeToImpact !== null && typeof timeToImpact === 'number';
    const hasLoss =
      lossNoBackup !== undefined && lossNoBackup !== null && typeof lossNoBackup === 'number';
    const hasRecovery =
      recoveryTime !== undefined && recoveryTime !== null && typeof recoveryTime === 'number';
    const hasBackupDuration =
      backupDuration !== undefined && backupDuration !== null && typeof backupDuration === 'number';

    const hasAnyCurvePoint = hasTimeToImpact || hasLoss || hasRecovery || hasBackupDuration;
    if (!hasAnyCurvePoint) {
      const msg = `Missing curve points for ${sectorToInfra[sector]}: provide time to impact, loss, or recovery time.`;
      errors.push(msg);
      errorDetails.push({ message: msg, sector });
    }
  }

  // IT: require hosted continuity for each selected hosted service
  const itCat = categories.INFORMATION_TECHNOLOGY as Record<string, unknown> | undefined;
  if (itCat && typeof itCat === 'object') {
    const continuityErrors = validateHostedContinuityRequired({
      'IT-2_upstream_assets': itCat['IT-2_upstream_assets'] as Array<{ service_id?: string; service_other?: string }> | undefined,
      it_hosted_resilience: itCat.it_hosted_resilience as Record<string, { survivability?: string }> | undefined,
    });
    for (const msg of continuityErrors) {
      errors.push(msg);
      errorDetails.push({ message: msg, sector: 'INFORMATION_TECHNOLOGY' });
    }
  }

  return {
    canExport: errors.length === 0,
    errors,
    errorDetails,
  };
}

/** Returns the first missing required question for actionable messaging. */
export function getFirstMissingInfo(completion: CompletionResult): FirstMissingInfo | null {
  const sectors: SectorKey[] = [
    'ELECTRIC_POWER',
    'COMMUNICATIONS',
    'INFORMATION_TECHNOLOGY',
    'WATER',
    'WASTEWATER',
  ];
  for (const sector of sectors) {
    const sc = completion.bySector[sector];
    if (!sc || sc.missing.length === 0) continue;
    const questionId = sc.missing[0];
    const label =
      SECTOR_QUESTION_LABEL_MAP[`${sector}:${questionId}`] ??
      SECTOR_QUESTION_LABEL_MAP[`${sector}:${CURVE_ID_ALIASES[questionId as keyof typeof CURVE_ID_ALIASES] ?? questionId}`] ??
      questionId;
    return {
      sector,
      sectorLabel: SECTOR_LABELS[sector],
      questionId,
      label,
    };
  }
  return null;
}
