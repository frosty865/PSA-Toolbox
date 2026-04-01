/**
 * Build PACE model for Communications VM payload.
 * Maps comm_pace_P/A/C/E or legacy curve to explicit PACE layers.
 * Used by view_model for report display; Python reporter builds its own from raw assessment.
 */
import type { CategoryInput } from 'schema';
import { buildCurveWorkbookAligned } from '@/app/lib/charts/curveClient';

/** Single PACE layer curve point. */
export type PaceCurvePoint = { t_hours: number; capacity_pct: number };

/** PACE layer definition (Communications only). */
export type PaceLayerVM = {
  present: boolean;
  label?: string;
  curve?: PaceCurvePoint[];
};

/** PACE model for Communications (explicit P/A/C/E degraded operational levels). */
export type CommsPaceVM = {
  enabled: boolean;
  layers: {
    PRIMARY: PaceLayerVM;
    ALTERNATE: PaceLayerVM;
    CONTINGENCY: PaceLayerVM;
    EMERGENCY: PaceLayerVM;
  };
};

const HORIZON_HOURS = 96;
const LAYER_LABELS: Record<string, string> = {
  PRIMARY: 'Primary',
  ALTERNATE: 'Alternate',
  CONTINGENCY: 'Contingency',
  EMERGENCY: 'Emergency',
};

function toNum(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(String(v).trim().replace('%', ''));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function effectiveHasBackup(input: CategoryInput): boolean {
  const anyInput = input as Record<string, unknown>;
  if (input.has_backup_any !== undefined) return input.has_backup_any === true;
  if (input.has_backup === true) return true;
  return anyInput.curve_backup_available === true || anyInput.curve_backup_available === 'yes';
}

type CommPaceLayerRaw = {
  system_type?: string | null;
  sustain_hours?: number | null;
  effective_capacity_pct?: number | null;
  activate_after_hours?: number | null;
};

function isLayerViable(layer: CommPaceLayerRaw | undefined): boolean {
  const st = layer?.system_type;
  return !!(st && st !== 'NONE' && st !== 'UNKNOWN');
}

function primaryCapacityAtHour(h: number, timeToImpact: number, capacityAfterImpact: number): number {
  return h < timeToImpact ? 100 : capacityAfterImpact;
}

function layerCapacityAtHour(
  h: number,
  activateAfter: number,
  sustainHours: number | null,
  capacityPct: number,
  horizon: number
): number {
  const cap = clamp(capacityPct, 0, 100);
  if (cap <= 0) return 0;
  if (h < activateAfter) return 0;
  if (sustainHours == null) return cap;
  const end = activateAfter + sustainHours;
  if (h > end) return 0;
  return cap;
}

function ensureCurveEndpoints(points: PaceCurvePoint[], horizon: number): PaceCurvePoint[] {
  const sorted = [...points].sort((a, b) => a.t_hours - b.t_hours);
  const out: PaceCurvePoint[] = [];
  for (const p of sorted) {
    const t = clamp(Math.round(p.t_hours), 0, horizon);
    const cap = clamp(p.capacity_pct, 0, 100);
    out.push({ t_hours: t, capacity_pct: cap });
  }
  if (out.length === 0) return out;
  if (out[0].t_hours > 0) {
    out.unshift({ t_hours: 0, capacity_pct: out[0].capacity_pct });
  }
  if (out[out.length - 1].t_hours < horizon) {
    out.push({ t_hours: horizon, capacity_pct: out[out.length - 1].capacity_pct });
  }
  return out;
}

/**
 * Build PACE model from comm_pace_P/A/C/E when viable.
 * Returns null if no PACE data; caller uses legacy adapter.
 */
function buildFromPaceLayers(data: Record<string, unknown>): CommsPaceVM | null {
  const req = data.requires_service ?? data.curve_requires_service;
  if (!req) return null;

  const pRaw = (data.comm_pace_P ?? {}) as CommPaceLayerRaw;
  const aRaw = (data.comm_pace_A ?? {}) as CommPaceLayerRaw;
  const cRaw = (data.comm_pace_C ?? {}) as CommPaceLayerRaw;
  const eRaw = (data.comm_pace_E ?? {}) as CommPaceLayerRaw;

  const hasPace = [pRaw, aRaw, cRaw, eRaw].some(isLayerViable);
  if (!hasPace) return null;

  const tImpact = clamp(
    toNum(data.time_to_impact_hours ?? data.curve_time_to_impact_hours, 0),
    0,
    HORIZON_HOURS
  );
  const lossNo = clamp(
    toNum(data.loss_fraction_no_backup ?? data.curve_loss_fraction_no_backup, 0) * 100,
    0,
    100
  );
  const capAfter = 100 - lossNo;

  const primaryCurve: PaceCurvePoint[] = [];
  for (let h = 0; h <= HORIZON_HOURS; h++) {
    primaryCurve.push({
      t_hours: h,
      capacity_pct: primaryCapacityAtHour(h, tImpact, capAfter),
    });
  }

  function buildLayer(raw: CommPaceLayerRaw, key: string): PaceLayerVM {
    if (!isLayerViable(raw)) {
      return {
        present: false,
        label: LAYER_LABELS[key] ?? key,
        curve: [],
      };
    }
    const activate = clamp(toNum(raw.activate_after_hours, 0), 0, HORIZON_HOURS);
    const cap = clamp(toNum(raw.effective_capacity_pct, 0), 0, 100);
    const sustainRaw = raw.sustain_hours;
    const sustain =
      key === 'EMERGENCY' && (sustainRaw == null || sustainRaw === 0)
        ? null
        : sustainRaw != null && Number.isFinite(sustainRaw)
          ? clamp(sustainRaw, 0, 96)
          : null;
    if (key !== 'EMERGENCY' && sustain != null && sustain <= 0) {
      return { present: false, label: LAYER_LABELS[key] ?? key, curve: [] };
    }
    const pts: PaceCurvePoint[] = [];
    for (let h = 0; h <= HORIZON_HOURS; h++) {
      pts.push({
        t_hours: h,
        capacity_pct: layerCapacityAtHour(h, activate, sustain, cap, HORIZON_HOURS),
      });
    }
    return {
      present: true,
      label: LAYER_LABELS[key] ?? key,
      curve: ensureCurveEndpoints(pts, HORIZON_HOURS),
    };
  }

  return {
    enabled: true,
    layers: {
      PRIMARY: {
        present: true,
        label: LAYER_LABELS.PRIMARY,
        curve: ensureCurveEndpoints(primaryCurve, HORIZON_HOURS),
      },
      ALTERNATE: buildLayer(aRaw, 'ALTERNATE'),
      CONTINGENCY: buildLayer(cRaw, 'CONTINGENCY'),
      EMERGENCY: buildLayer(eRaw, 'EMERGENCY'),
    },
  };
}

/**
 * Legacy adapter: build PACE from curve_points or buildCurveWorkbookAligned when pace missing.
 * Primary = without backup; Alternate = with backup (if has_backup); C/E = not present.
 */
function buildFromLegacyCurve(input: CategoryInput): CommsPaceVM {
  const curvePoints = buildCurveWorkbookAligned(input);
  if (curvePoints.length === 0) {
    return {
      enabled: false,
      layers: {
        PRIMARY: { present: false, label: 'Primary', curve: [] },
        ALTERNATE: { present: false, label: 'Alternate', curve: [] },
        CONTINGENCY: { present: false, label: 'Contingency', curve: [] },
        EMERGENCY: { present: false, label: 'Emergency', curve: [] },
      },
    };
  }

  const primaryCurve: PaceCurvePoint[] = curvePoints.map((p) => ({
    t_hours: p.t_hours,
    capacity_pct: clamp(p.capacity_without_backup, 0, 100),
  }));

  const hasBackup = effectiveHasBackup(input);
  const alternateCurve: PaceCurvePoint[] = hasBackup
    ? curvePoints.map((p) => ({
        t_hours: p.t_hours,
        capacity_pct: clamp(p.capacity_with_backup, 0, 100),
      }))
    : [];

  return {
    enabled: true,
    layers: {
      PRIMARY: {
        present: true,
        label: 'Primary',
        curve: ensureCurveEndpoints(primaryCurve, HORIZON_HOURS),
      },
      ALTERNATE: {
        present: hasBackup,
        label: 'Alternate',
        curve: hasBackup ? ensureCurveEndpoints(alternateCurve, HORIZON_HOURS) : [],
      },
      CONTINGENCY: { present: false, label: 'Contingency', curve: [] },
      EMERGENCY: { present: false, label: 'Emergency', curve: [] },
    },
  };
}

/**
 * Build PACE model for Communications VM.
 * Uses comm_pace_P/A/C/E when viable; otherwise adapts from legacy curve (points_without/points_with).
 */
export function buildCommsPaceForVM(categoryData: unknown): CommsPaceVM | undefined {
  if (!categoryData || typeof categoryData !== 'object') return undefined;

  const data = categoryData as Record<string, unknown>;
  const req = data.requires_service ?? data.curve_requires_service;
  if (!req) return undefined;

  const fromPace = buildFromPaceLayers(data);
  if (fromPace) return fromPace;

  const fromLegacy = buildFromLegacyCurve(data as CategoryInput);
  if (fromLegacy.enabled) return fromLegacy;

  return undefined;
}
