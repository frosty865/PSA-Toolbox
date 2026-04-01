/**
 * Maps Communications assessment answers to PACE curve inputs.
 * Voice/radio/dispatch transport only. Do not merge with IT.
 */
import type { PaceCurveInputs, PaceLayerInput, PaceLayerKey } from './pace_types';

const HORIZON = 96;

type CommsPaceLayer = {
  system_type?: string | null;
  sustain_hours?: number | null;
  effective_capacity_pct?: number | null;
  activate_after_hours?: number | null;
  ramp_hours?: number | null;
};

type CommsAssessment = {
  requires_service?: boolean;
  curve_requires_service?: boolean;
  comm_pace_P?: CommsPaceLayer | null;
  comm_pace_A?: CommsPaceLayer | null;
  comm_pace_C?: CommsPaceLayer | null;
  comm_pace_E?: CommsPaceLayer | null;
};

const LAYER_MAP: { key: PaceLayerKey; commKey: keyof CommsAssessment }[] = [
  { key: 'PRIMARY', commKey: 'comm_pace_P' },
  { key: 'ALTERNATE', commKey: 'comm_pace_A' },
  { key: 'CONTINGENCY', commKey: 'comm_pace_C' },
  { key: 'EMERGENCY', commKey: 'comm_pace_E' },
];

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Map Communications assessment to PaceCurveInputs.
 * - PRIMARY/ALT/CONT require sustainment_hours to be plotted (otherwise omit).
 * - EMERGENCY sustainment optional; default unlimited (null).
 * - If capacity unknown, omit layer.
 * - activate_after_hours missing => default 0.
 */
export function mapCommunicationsToPace(assessment: CommsAssessment | null | undefined): PaceCurveInputs | null {
  if (!assessment) return null;
  const req = assessment.requires_service === true || assessment.curve_requires_service === true;
  if (!req) return null;

  const layers: PaceLayerInput[] = [];

  for (const { key, commKey } of LAYER_MAP) {
    const layer = assessment[commKey] as CommsPaceLayer | undefined | null;
    if (!layer || typeof layer !== 'object') continue;

    const st = layer.system_type;
    if (!st || st === 'NONE' || st === 'UNKNOWN') continue;

    const capacity = layer.effective_capacity_pct;
    if (capacity == null || typeof capacity !== 'number' || Number.isNaN(capacity)) continue;

    const capPct = clamp(capacity, 0, 100);
    const activate = clamp(layer.activate_after_hours ?? 0, 0, HORIZON);
    const ramp = layer.ramp_hours != null ? clamp(layer.ramp_hours, 0, 24) : 0;

    if (key === 'EMERGENCY') {
      layers.push({
        key,
        activate_after_hours: activate,
        sustainment_hours: layer.sustain_hours ?? null,
        capacity_pct: capPct,
        ramp_hours: ramp > 0 ? ramp : undefined,
      });
      continue;
    }

    const sustain = layer.sustain_hours;
    if (sustain == null || sustain === undefined) continue;
    const sustainNum = clamp(Number(sustain), 0, 96);
    if (sustainNum <= 0) continue;

    layers.push({
      key,
      activate_after_hours: activate,
      sustainment_hours: sustainNum,
      capacity_pct: capPct,
      ramp_hours: ramp > 0 ? ramp : undefined,
    });
  }

  if (layers.length === 0) return null;

  return {
    horizon_hours: HORIZON,
    layers,
  };
}
