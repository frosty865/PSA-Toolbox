/**
 * PACE curve math: per-layer capacity with activation, sustainment, ramp.
 * Effective envelope = max(active-layer capacities) at each time.
 */
import type { PaceCurveInputs, PaceLayerInput, PaceLayerKey, PaceCurvesResult, ChartPoint } from './pace_types';

const HORIZON = 96;
const SUSTAIN_MAX = 96;
const CAPACITY_MIN = 0;
const CAPACITY_MAX = 100;
const RAMP_MAX = 24;

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Build t grid using step resolution (1h for spans ≤20h, 3h for longer). */
function buildTGrid(horizon: number): number[] {
  const points: number[] = [];
  const step = 1;
  for (let t = 0; t <= horizon; t += step) {
    points.push(t);
  }
  if (points[points.length - 1] !== horizon) {
    points.push(horizon);
  }
  return [...new Set(points)].sort((a, b) => a - b);
}

/** Capacity at time t for a single layer. */
function layerCapacityAt(layer: PaceLayerInput, t: number, horizon: number): number {
  const activate = clamp(layer.activate_after_hours, 0, horizon);
  const sustain = layer.sustainment_hours != null
    ? clamp(layer.sustainment_hours, 0, SUSTAIN_MAX)
    : null;
  const cap = clamp(layer.capacity_pct, CAPACITY_MIN, CAPACITY_MAX);
  const ramp = clamp(layer.ramp_hours ?? 0, 0, RAMP_MAX);

  // Active window: t >= activate AND (sustain null => EMERGENCY unlimited; else t <= activate + sustain)
  const isEmergency = layer.key === 'EMERGENCY';
  const activeEnd = sustain != null ? activate + sustain : (isEmergency ? horizon + 1 : activate);
  const isActive = t >= activate && t <= Math.min(activeEnd, horizon);

  if (!isActive) return 0;

  if (ramp > 0) {
    const rampStart = activate;
    const rampEnd = activate + ramp;
    if (t < rampStart) return 0;
    if (t <= rampEnd) {
      const frac = (t - rampStart) / ramp;
      return cap * clamp(frac, 0, 1);
    }
  }
  return cap;
}

export function buildPaceCurves(inputs: PaceCurveInputs, tGrid?: number[]): PaceCurvesResult {
  const horizon = clamp(inputs.horizon_hours, 1, HORIZON);
  const grid = tGrid ?? buildTGrid(horizon);

  const perLayer: Record<PaceLayerKey, ChartPoint[]> = {
    PRIMARY: [],
    ALTERNATE: [],
    CONTINGENCY: [],
    EMERGENCY: [],
  };

  const layerKeys: PaceLayerKey[] = ['PRIMARY', 'ALTERNATE', 'CONTINGENCY', 'EMERGENCY'];

  for (const layer of inputs.layers) {
    const key = layer.key;
    if (!layerKeys.includes(key)) continue;

    const points: ChartPoint[] = [];
    for (const t of grid) {
      const cap = layerCapacityAt(layer, t, horizon);
      points.push({ t_hours: t, capacity_pct: cap });
    }
    perLayer[key] = points;
  }

  const effective: ChartPoint[] = grid.map((t) => {
    let maxCap = 0;
    for (const layer of inputs.layers) {
      const cap = layerCapacityAt(layer, t, horizon);
      if (cap > maxCap) maxCap = cap;
    }
    return { t_hours: t, capacity_pct: maxCap };
  });

  return { perLayer, effective };
}
