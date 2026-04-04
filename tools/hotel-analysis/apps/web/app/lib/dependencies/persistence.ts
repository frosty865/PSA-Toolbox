/**
 * Unified ENERGY and COMMUNICATIONS persistence interface for web and standalone.
 * Uses localStorage (persistent: survives browser restarts and navigation).
 * If a future API is added, branch here.
 */
import type { EnergyAnswers, YesNoUnknown } from './infrastructure/energy_spec';
import { getDefaultEnergyAnswers } from './infrastructure/energy_spec';
import type { CommsAnswers, CommPaceLayer } from './infrastructure/comms_spec';
import { getDefaultCommsAnswers, clearLayerForSystemType } from './infrastructure/comms_spec';
import { mapLegacyCommsToNew } from './comms_to_category_input';

/** Yes/No/Unknown or N/A for E-4 and similar. Defined here to avoid depending on energy_spec export. */
type YesNoUnknownOrNa = 'yes' | 'no' | 'unknown' | 'na';
import {
  loadEnergyFromLocal,
  saveEnergyToLocal,
  type EnergyStoragePayload,
} from './energy_storage';

export type { EnergyStoragePayload };

const TRI_STATE_KEYS: (keyof EnergyAnswers)[] = [
  'E-2_can_identify_substations',
  'E-3_more_than_one_connection',
  'E-4_physically_separated',
  'E-5_single_supports_core_ops',
  'E-6_exterior_protected',
  'E-7_vehicle_impact_exposure',
  'E-7a_vehicle_impact_protection',
  'E-8_backup_power_available',
  'E-9_refuel_sustainment_established',
  'E-10_tested_under_load',
  'E-11_provider_restoration_coordination',
];

function toYesNoUnknown(v: unknown): YesNoUnknown {
  if (v === true) return 'yes';
  if (v === false) return 'no';
  if (v === 'yes' || v === 'no' || v === 'unknown') return v;
  return 'unknown';
}

function toYesNoUnknownOrNa(key: keyof EnergyAnswers, v: unknown): YesNoUnknown | YesNoUnknownOrNa {
  if (key === 'E-4_physically_separated' && v === 'na') return 'na';
  return toYesNoUnknown(v);
}

/** Migrate E-9 sustainment from legacy supplier_names/estimated_resupply_timeframe to suppliers array. */
function migrateE9Sustainment(val: unknown): unknown {
  if (val == null || typeof val !== 'object') return val;
  const o = val as Record<string, unknown>;
  if (Array.isArray(o.suppliers)) return val;
  const names = Array.isArray(o.supplier_names) ? (o.supplier_names as string[]) : [];
  const singleTimeframe = typeof o.estimated_resupply_timeframe === 'string' ? o.estimated_resupply_timeframe : undefined;
  const suppliers = names.length
    ? names.map((name, i) => ({
        supplier_name: name,
        estimated_resupply_timeframe: i === 0 ? singleTimeframe : undefined,
        contracted_sla: undefined,
      }))
    : singleTimeframe
      ? [{ supplier_name: '', estimated_resupply_timeframe: singleTimeframe, contracted_sla: undefined }]
      : [];
  return { ...o, suppliers };
}

/** Normalize stored answers so legacy boolean values become yes/no/unknown and E-9 uses suppliers array. */
function normalizeStoredAnswers(answers: Record<string, unknown>): EnergyAnswers {
  const out = { ...answers } as Record<string, unknown>;
  for (const key of TRI_STATE_KEYS) {
    if (key in out) out[key] = toYesNoUnknownOrNa(key, out[key]);
  }
  if ('E-7_mitigation_when_no' in out) {
    delete out['E-7_mitigation_when_no'];
  }
  if ('backup_supported_capacity_percent' in out) {
    delete out['backup_supported_capacity_percent'];
  }
  if (out['E-9_sustainment'] != null) {
    out['E-9_sustainment'] = migrateE9Sustainment(out['E-9_sustainment']) as EnergyAnswers['E-9_sustainment'];
  }
  return out as EnergyAnswers;
}

/** Load saved ENERGY answers and derived findings (assessment-scoped; single flow). */
export function loadEnergyAnswers(assessmentId?: string): EnergyStoragePayload | null {
  const record = loadEnergyFromLocal();
  if (typeof window !== 'undefined') {
    console.info(
      '[energy] load: assessmentId=',
      assessmentId ?? '(none)',
      'hasRecord=',
      Boolean(record),
      'defaultsUsed=',
      Boolean(!record)
    );
  }
  return record;
}

/**
 * Returns ENERGY answers safe for UI: defaults merged with stored so all question keys exist.
 * Migrates legacy boolean values to yes/no/unknown.
 */
export function getEnergyAnswersForUI(assessmentId?: string): EnergyStoragePayload['answers'] {
  const defaults = getDefaultEnergyAnswers();
  const stored = loadEnergyAnswers(assessmentId);
  if (!stored?.answers) return defaults;
  const normalized = normalizeStoredAnswers(stored.answers as Record<string, unknown>);
  return { ...defaults, ...normalized };
}

/** Persist ENERGY answers and derived findings. */
export function saveEnergyAnswers(
  payload: Omit<EnergyStoragePayload, 'saved_at_iso'>,
  _assessmentId?: string
): void {
  saveEnergyToLocal(payload);
}

// ─── COMMUNICATIONS ──────────────────────────────────────────────────────
export interface CommsStoragePayload {
  answers: CommsAnswers;
  derived?: any;
  saved_at_iso?: string;
}

const LEGACY_COMMS_KEYS = [
  'CO-backup_adequacy',
  'CO-backup_tested',
  'CO-restoration_coordination',
  'CO_backup_adequacy',
  'CO_backup_tested',
  'CO_restoration_coordination',
] as const;

function normalizeCommsStoredAnswers(answers: Record<string, unknown>): CommsAnswers {
  const defaults = getDefaultCommsAnswers();
  const legacyMapped = mapLegacyCommsToNew(answers);
  const out = { ...defaults, ...legacyMapped } as Record<string, unknown>;
  for (const legacyKey of LEGACY_COMMS_KEYS) {
    if (legacyKey in out) delete out[legacyKey];
  }
  for (const k of Object.keys(answers)) {
    if (k in defaults || k.startsWith('comm_') || k.startsWith('curve_')) {
      out[k] = (answers as Record<string, unknown>)[k];
    }
  }
  if ('CO-7_mitigation_when_no' in out) delete out['CO-7_mitigation_when_no'];
  if ('backup_supported_capacity_percent' in out) delete out['backup_supported_capacity_percent'];
  for (const layerKey of ['comm_pace_P', 'comm_pace_A', 'comm_pace_C', 'comm_pace_E'] as const) {
    const layer = out[layerKey] as CommPaceLayer | undefined;
    if (layer && typeof layer === 'object') {
      let st = layer.system_type;
      if ((st as string) === 'CELLULAR_PTT') st = 'PUSH_TO_TALK_CELLULAR';
      const cleaned = clearLayerForSystemType(layer, st);
      out[layerKey] = cleaned;
    }
  }
  return out as CommsAnswers;
}

function loadCommsFromLocal(): CommsStoragePayload | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('comms:storage');
  if (!stored) return null;
  try {
    return JSON.parse(stored) as CommsStoragePayload;
  } catch {
    return null;
  }
}

function saveCommsToLocal(payload: Omit<CommsStoragePayload, 'saved_at_iso'>): void {
  if (typeof window === 'undefined') return;
  const toStore: CommsStoragePayload = {
    ...payload,
    saved_at_iso: new Date().toISOString(),
  };
  localStorage.setItem('comms:storage', JSON.stringify(toStore));
}

/** Return raw comms storage for progress file export. */
export function getCommsStorageForExport(): CommsStoragePayload | null {
  return loadCommsFromLocal();
}

export function loadCommsAnswers(assessmentId?: string): CommsStoragePayload | null {
  const record = loadCommsFromLocal();
  if (typeof window !== 'undefined') {
    console.info(
      '[comms] load: assessmentId=',
      assessmentId ?? '(none)',
      'hasRecord=',
      Boolean(record),
      'defaultsUsed=',
      Boolean(!record)
    );
  }
  return record;
}

export function getCommsAnswersForUI(assessmentId?: string): CommsStoragePayload['answers'] {
  const defaults = getDefaultCommsAnswers();
  const stored = loadCommsAnswers(assessmentId);
  if (!stored?.answers) return defaults;
  const normalized = normalizeCommsStoredAnswers(stored.answers as Record<string, unknown>);
  return { ...defaults, ...normalized };
}

export function saveCommsAnswers(
  payload: Omit<CommsStoragePayload, 'saved_at_iso'>,
  _assessmentId?: string
): void {
  saveCommsToLocal(payload);
}

// ─── WATER ─────────────────────────────────────────────────────────────────
import type { WaterAnswers } from './infrastructure/water_spec';
import { getDefaultWaterAnswers } from './infrastructure/water_spec';
import { loadWaterSession, saveWaterSession } from '@/app/lib/io/water_storage';
import { deriveWaterFindings } from './derive_water_findings';

export function loadWaterAnswers(): { answers: WaterAnswers; derived: ReturnType<typeof deriveWaterFindings> } | null {
  const session = loadWaterSession();
  if (!session?.answers) return null;
  return {
    answers: { ...getDefaultWaterAnswers(), ...session.answers } as WaterAnswers,
    derived: (session.derived as ReturnType<typeof deriveWaterFindings>) ?? { vulnerabilities: [], ofcs: [] },
  };
}

export function getWaterAnswersForUI(): WaterAnswers {
  const defaults = getDefaultWaterAnswers();
  const stored = loadWaterAnswers();
  if (!stored?.answers) return defaults;
  return { ...defaults, ...stored.answers };
}

export function saveWaterAnswers(answers: WaterAnswers): void {
  const derived = deriveWaterFindings(answers);
  saveWaterSession({ answers, derived, saved_at_iso: new Date().toISOString() });
}

// ─── WASTEWATER ────────────────────────────────────────────────────────────
import type { WastewaterAnswers } from './infrastructure/wastewater_spec';
import { getDefaultWastewaterAnswers } from './infrastructure/wastewater_spec';
import { loadWastewaterSession, saveWastewaterSession } from '@/app/lib/io/wastewater_storage';
import { deriveWastewaterFindings } from './derive_wastewater_findings';

export function loadWastewaterAnswers(): { answers: WastewaterAnswers; derived: ReturnType<typeof deriveWastewaterFindings> } | null {
  const session = loadWastewaterSession();
  if (!session?.answers) return null;
  return {
    answers: { ...getDefaultWastewaterAnswers(), ...session.answers } as WastewaterAnswers,
    derived: (session.derived as ReturnType<typeof deriveWastewaterFindings>) ?? { vulnerabilities: [], ofcs: [] },
  };
}

export function getWastewaterAnswersForUI(): WastewaterAnswers {
  const defaults = getDefaultWastewaterAnswers();
  const stored = loadWastewaterAnswers();
  if (!stored?.answers) return defaults;
  return { ...defaults, ...stored.answers };
}

export function saveWastewaterAnswers(answers: WastewaterAnswers): void {
  const derived = deriveWastewaterFindings(answers);
  saveWastewaterSession({ answers, derived, saved_at_iso: new Date().toISOString() });
}

// ─── IT ───────────────────────────────────────────────────────────────────
import type { ItAnswers } from './infrastructure/it_spec';
import { getDefaultItAnswers } from './infrastructure/it_spec';
import { loadItSession, saveItSession } from '@/app/lib/io/it_storage';
import { deriveItFindings } from './derive_it_findings';

export function loadItAnswers(): { answers: ItAnswers; derived: ReturnType<typeof deriveItFindings> } | null {
  const session = loadItSession();
  if (!session?.answers) return null;
  return {
    answers: { ...getDefaultItAnswers(), ...session.answers } as ItAnswers,
    derived: (session.derived as ReturnType<typeof deriveItFindings>) ?? { vulnerabilities: [], ofcs: [] },
  };
}

/** Migrate legacy IT-2 rows (asset_name_or_id) to service_id + service_other. */
function migrateIt2UpstreamAssets(answers: Record<string, unknown>): void {
  const assets = answers['IT-2_upstream_assets'];
  if (!Array.isArray(assets)) return;
  for (let i = 0; i < assets.length; i++) {
    const row = assets[i];
    if (row == null || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (r.service_id != null && String(r.service_id).trim() !== '') continue;
    const legacyName = r.asset_name_or_id;
    if (legacyName != null && String(legacyName).trim() !== '') {
      (assets[i] as Record<string, unknown>).service_id = 'other';
      (assets[i] as Record<string, unknown>).service_other = String(legacyName).trim();
      (assets[i] as Record<string, unknown>).service_provider =
        r.service_provider ?? r.provider ?? '';
      delete (assets[i] as Record<string, unknown>).asset_name_or_id;
    }
  }
}

export function getItAnswersForUI(): ItAnswers {
  const defaults = getDefaultItAnswers();
  const stored = loadItAnswers();
  if (!stored?.answers) return defaults;
  const cleaned = { ...(stored.answers as Record<string, unknown>) };
  if ('backup_supported_capacity_percent' in cleaned) {
    delete cleaned['backup_supported_capacity_percent'];
  }
  migrateIt2UpstreamAssets(cleaned);
  return { ...defaults, ...cleaned } as ItAnswers;
}

export function saveItAnswers(answers: ItAnswers): void {
  const derived = deriveItFindings(answers);
  saveItSession({ answers, derived, saved_at_iso: new Date().toISOString() });
}
