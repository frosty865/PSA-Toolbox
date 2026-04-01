/**
 * PACE-layered Communications impact curve.
 * Replaces binary with/without backup with step-down capacity as each layer fails or degrades.
 * Voice-only; honors cellular reality (tower/backhaul outside facility control).
 */

/** Central horizon (hours). PACE timeline starts at t=0; segment ends clamped to this. Matches Excel/report. */
export const HORIZON_HOURS = 96;

/** Conservative cap (hours) when carrier/tower power is NOT assessed. Device uptime ≠ network availability. */
export const DEFAULT_CARRIER_SURVIVABILITY_HOURS = 8;

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export type CommsPaceLayerInput = {
  system_type?: string;
  sustain_hours?: number | null;
  effective_capacity_pct?: number | null;
  regional_survivability?: string;
  /** DEVICE_ONLY | INFRASTRUCTURE_ASSESSED | UNKNOWN. When carrier-dependent and DEVICE_ONLY/UNKNOWN, sustain is capped. */
  power_scope?: string;
};

export type CommsPaceCurveInput = {
  curve_requires_service?: boolean;
  curve_time_to_impact_hours?: number | null;
  curve_loss_fraction_no_backup?: number | null;
  curve_recovery_time_hours?: number | null;
  comm_pace_P?: CommsPaceLayerInput | null;
  comm_pace_A?: CommsPaceLayerInput | null;
  comm_pace_C?: CommsPaceLayerInput | null;
  comm_pace_E?: CommsPaceLayerInput | null;
};

export type CommsPaceCurveScenario = 'local' | 'regional';

export type CommsPaceCurveOptions = {
  scenario?: CommsPaceCurveScenario;
  time_horizon?: number;
};

export type PaceCurveSegment = {
  t_start: number;
  t_end: number;
  capacity: number;
  layer: 'P' | 'A' | 'C' | 'E' | 'none';
  /** True when effective sustain was capped due to DEVICE_ONLY power scope. */
  capped?: boolean;
};

export type PaceLayerDebug = {
  layer: 'P' | 'A' | 'C' | 'E';
  system_type: string;
  /** Sustain as entered by user (h). */
  sustain_hours: number;
  /** Sustain actually used in curve (h); may be capped when power scope is device-only. */
  effective_sustain_hours: number;
  capacity_pct: number;
  viable: boolean;
  reason: string;
  /** Display for "How this curve was built": Device only | Carrier/network assessed | Unknown (treated as Device only) */
  power_scope_display: string;
};

export type CommsPaceCurveResult = {
  points: Array<{ t: number; capacity: number }>;
  segments: PaceCurveSegment[];
  debug: { layers: PaceLayerDebug[]; scenario: CommsPaceCurveScenario };
};

const PACE_ORDER: ('P' | 'A' | 'C' | 'E')[] = ['P', 'A', 'C', 'E'];
const LAYER_KEYS = ['comm_pace_P', 'comm_pace_A', 'comm_pace_C', 'comm_pace_E'] as const;

const CARRIER_DEPENDENT_SYSTEM_TYPES = new Set([
  'CELLULAR_VOICE',
  'PUSH_TO_TALK_CELLULAR',
  'LANDLINE_VOIP_TRUNK',
]);

function isCarrierDependentSystemType(systemType: string | undefined): boolean {
  return Boolean(systemType && CARRIER_DEPENDENT_SYSTEM_TYPES.has(systemType));
}

function getPowerScopeDisplay(scope: string | undefined, carrierDependent: boolean): string {
  if (scope === 'INFRASTRUCTURE_ASSESSED') return 'Carrier/network assessed';
  if (scope === 'DEVICE_ONLY') return 'Device only';
  return carrierDependent ? 'Unknown (treated as Device only)' : '—';
}

function getLayer(
  input: CommsPaceCurveInput,
  layer: 'P' | 'A' | 'C' | 'E'
): CommsPaceCurveInput['comm_pace_P'] {
  return input[LAYER_KEYS[PACE_ORDER.indexOf(layer)]];
}

/** In regional scenario, layer is not viable if it likely fails regionally or depends on same upstream as primary (and primary is down). */
function isViableInScenario(
  input: CommsPaceCurveInput,
  layerKey: 'P' | 'A' | 'C' | 'E',
  layer: NonNullable<CommsPaceCurveInput['comm_pace_P']>,
  scenario: CommsPaceCurveScenario,
  primaryViable: boolean
): boolean {
  if (scenario === 'local') return true;
  const surv = layer.regional_survivability;
  if (surv === 'LIKELY_FAIL_REGIONAL') return false;
  if (surv === 'DEPENDS_ON_SAME_UPSTREAM_AS_PRIMARY' && layerKey !== 'P' && !primaryViable) return false;
  return true;
}

export function buildCommunicationsPaceCurve(
  input: CommsPaceCurveInput,
  opts: CommsPaceCurveOptions = {}
): CommsPaceCurveResult {
  const scenario = opts.scenario ?? 'regional';
  const timeHorizon = clamp(opts.time_horizon ?? HORIZON_HOURS, 1, 168);
  const requiresService = input.curve_requires_service === true;
  const tImpact = clamp(
    input.curve_time_to_impact_hours ?? 0,
    0,
    timeHorizon
  );
  const lossNoBackup = clamp(
    (input.curve_loss_fraction_no_backup ?? 0) * 100,
    0,
    100
  );
  const floorCapacity = clamp(100 - lossNoBackup, 0, 100);
  const debugLayers: PaceLayerDebug[] = [];
  const segments: PaceCurveSegment[] = [];
  const horizon = Math.min(timeHorizon, HORIZON_HOURS);

  if (!requiresService) {
    return {
      points: [{ t: 0, capacity: 100 }, { t: horizon, capacity: 100 }],
      segments: [],
      debug: { layers: [], scenario },
    };
  }

  // Evaluate each layer for viability and build debug (effective sustain may be capped for DEVICE_ONLY)
  let primaryViable = false;
  for (const layerKey of PACE_ORDER) {
    const layer = getLayer(input, layerKey);
    const st = layer?.system_type;
    const inputSustain = clamp(layer?.sustain_hours ?? 0, 0, 96);
    const carrierDependent = isCarrierDependentSystemType(st);
    const scope = layer?.power_scope;
    const treatAsDeviceOnly =
      carrierDependent &&
      (scope === 'DEVICE_ONLY' || scope === 'UNKNOWN' || scope === undefined || scope === '');
    const effectiveSustain = treatAsDeviceOnly
      ? Math.min(inputSustain, DEFAULT_CARRIER_SURVIVABILITY_HOURS)
      : inputSustain;
    const capacity = clamp(layer?.effective_capacity_pct ?? 0, 0, 100);
    const notNone = st && st !== 'NONE' && st !== 'UNKNOWN';
    const viableBase = notNone && effectiveSustain > 0 && capacity > 0;
    const viableScenario: boolean = Boolean(viableBase && isViableInScenario(input, layerKey, layer ?? {}, scenario, primaryViable));
    if (layerKey === 'P') primaryViable = viableScenario;
    let reason: string;
    if (!notNone) reason = 'Excluded (no system type)';
    else if (inputSustain <= 0) reason = 'Excluded (sustain hours = 0)';
    else if (capacity <= 0) reason = 'Excluded (capacity = 0%)';
    else if (!isViableInScenario(input, layerKey, layer ?? {}, scenario, primaryViable))
      reason = scenario === 'regional' ? 'Excluded (regional scenario: not viable)' : 'Included';
    else reason = treatAsDeviceOnly && effectiveSustain < inputSustain ? 'Conditional' : 'Included';
    debugLayers.push({
      layer: layerKey,
      system_type: st ?? '—',
      sustain_hours: inputSustain,
      effective_sustain_hours: effectiveSustain,
      capacity_pct: capacity,
      viable: viableScenario,
      reason,
      power_scope_display: getPowerScopeDisplay(scope, carrierDependent),
    });
  }

  // Build PACE segments from t=0 (no time-to-impact offset). Use effective_sustain_hours (capped when DEVICE_ONLY).
  let t0 = 0;
  for (const layerKey of PACE_ORDER) {
    const info = debugLayers.find((d) => d.layer === layerKey)!;
    if (!info.viable) continue;
    const sustain = info.effective_sustain_hours;
    const capacity = info.capacity_pct;
    const layer = getLayer(input, layerKey);
    const inputSustain = clamp(layer?.sustain_hours ?? 0, 0, 96);
    const capped = sustain < inputSustain;
    const t1 = Math.min(horizon, t0 + sustain);
    const segStart = clamp(t0, 0, horizon);
    const segEnd = clamp(t1, 0, horizon);
    if (segEnd > segStart) {
      segments.push({ t_start: segStart, t_end: segEnd, capacity, layer: layerKey, capped: capped || undefined });
    }
    t0 = t1;
    if (t0 >= horizon) break;
  }
  if (t0 < horizon) {
    segments.push({ t_start: clamp(t0, 0, horizon), t_end: horizon, capacity: floorCapacity, layer: 'none' });
  }
  // Green curve step points from segments only (no tImpact offset)
  const stepPoints: Array<{ t: number; capacity: number }> = [];
  if (segments.length === 0) {
    stepPoints.push({ t: 0, capacity: floorCapacity }, { t: horizon, capacity: floorCapacity });
  } else {
    for (const seg of segments) {
      stepPoints.push({ t: seg.t_start, capacity: seg.capacity });
      stepPoints.push({ t: seg.t_end, capacity: seg.capacity });
    }
    stepPoints.sort((a, b) => a.t - b.t || a.capacity - b.capacity);
  }

  return {
    points: stepPoints,
    segments,
    debug: { layers: debugLayers, scenario },
  };
}
