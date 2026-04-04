/**
 * Reusable PACE layer model for multi-line capacity curves.
 * Generic, usable across Communications and other infrastructure tabs.
 */

export type PaceLayerKey = 'PRIMARY' | 'ALTERNATE' | 'CONTINGENCY' | 'EMERGENCY';

export interface PaceLayerInput {
  key: PaceLayerKey;

  /** When does this layer become usable (relative to outage start)? 0 = immediately. */
  activate_after_hours: number; // [0..96], clamp

  /** How long can this layer be sustained once active (without resupply/external restoration)?
   * null/undefined => treat as unlimited within horizon for EMERGENCY; otherwise 0 (not sustaining). */
  sustainment_hours?: number | null; // [0..96], clamp; curve horizon uses 96

  /** Capacity retained while this layer is sustaining (0..100). */
  capacity_pct: number; // clamp 0..100

  /** Optional ramp: linearly interpolate from 0 to capacity_pct over ramp_hours. Default 0 = step. */
  ramp_hours?: number; // [0..24], default 0
}

export interface PaceCurveInputs {
  horizon_hours: number; // 96
  layers: PaceLayerInput[]; // 1..4
}

export interface ChartPoint {
  t_hours: number;
  capacity_pct: number;
}

export interface PaceCurvesResult {
  perLayer: Record<PaceLayerKey, ChartPoint[]>;
  effective: ChartPoint[];
}
