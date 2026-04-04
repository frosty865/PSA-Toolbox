/**
 * Tests for Communications PACE mapper.
 */
import { describe, it, expect } from 'vitest';
import { mapCommunicationsToPace } from '../communications_pace_mapper';
import { buildPaceCurves } from '../pace_curve_math';

describe('communications_pace_mapper', () => {
  it('no data => no curves', () => {
    const result = mapCommunicationsToPace(null);
    expect(result).toBeNull();
  });

  it('requires_service false => no curves', () => {
    const result = mapCommunicationsToPace({
      requires_service: false,
      comm_pace_P: { system_type: 'CELLULAR_VOICE', sustain_hours: 24, effective_capacity_pct: 80 },
    });
    expect(result).toBeNull();
  });

  it('primary only => effective equals primary', () => {
    const assessment = {
      requires_service: true,
      comm_pace_P: {
        system_type: 'CELLULAR_VOICE',
        sustain_hours: 24,
        effective_capacity_pct: 80,
        activate_after_hours: 0,
      },
    };
    const result = mapCommunicationsToPace(assessment);
    expect(result).not.toBeNull();
    expect(result!.layers.length).toBe(1);
    expect(result!.layers[0].key).toBe('PRIMARY');
    expect(result!.layers[0].capacity_pct).toBe(80);
    expect(result!.layers[0].activate_after_hours).toBe(0);
    expect(result!.layers[0].sustainment_hours).toBe(24);

    const { effective, perLayer } = buildPaceCurves(result!);
    const eff0 = effective.find((p) => p.t_hours === 0);
    const prim0 = perLayer.PRIMARY.find((p) => p.t_hours === 0);
    expect(eff0?.capacity_pct).toBe(80);
    expect(prim0?.capacity_pct).toBe(80);
    expect(eff0?.capacity_pct).toBe(prim0?.capacity_pct);
  });

  it('primary + alternate => effective is max at each t', () => {
    const assessment = {
      requires_service: true,
      comm_pace_P: {
        system_type: 'CELLULAR_VOICE',
        sustain_hours: 12,
        effective_capacity_pct: 80,
        activate_after_hours: 0,
      },
      comm_pace_A: {
        system_type: 'RADIO_DIGITAL',
        sustain_hours: 24,
        effective_capacity_pct: 60,
        activate_after_hours: 12,
      },
    };
    const result = mapCommunicationsToPace(assessment);
    expect(result).not.toBeNull();
    expect(result!.layers.length).toBe(2);

    const { effective, perLayer } = buildPaceCurves(result!);
    const eff0 = effective.find((p) => p.t_hours === 0);
    const eff12 = effective.find((p) => p.t_hours === 12);
    const eff13 = effective.find((p) => p.t_hours === 13);
    expect(eff0?.capacity_pct).toBe(80);
    // At t=12: primary still active (0..12 inclusive), alternate active from 12; effective = max(80,60) = 80
    expect(eff12?.capacity_pct).toBe(80);
    // At t=13: primary ended, alternate only; effective = 60
    expect(eff13?.capacity_pct).toBe(60);
  });

  it('omits layer without sustainment', () => {
    const assessment = {
      requires_service: true,
      comm_pace_P: {
        system_type: 'CELLULAR_VOICE',
        sustain_hours: undefined,
        effective_capacity_pct: 80,
      },
    };
    const result = mapCommunicationsToPace(assessment);
    expect(result).toBeNull();
  });

  it('emergency sustainment optional', () => {
    const assessment = {
      requires_service: true,
      comm_pace_E: {
        system_type: 'MANUAL_RUNNER',
        effective_capacity_pct: 15,
        activate_after_hours: 0,
      },
    };
    const result = mapCommunicationsToPace(assessment);
    expect(result).not.toBeNull();
    expect(result!.layers.length).toBe(1);
    expect(result!.layers[0].key).toBe('EMERGENCY');
    expect(result!.layers[0].sustainment_hours).toBeNull();
  });
});
