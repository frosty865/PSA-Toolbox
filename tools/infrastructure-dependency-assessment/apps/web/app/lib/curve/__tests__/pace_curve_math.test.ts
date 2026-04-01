/**
 * Tests for PACE curve math: activation, sustainment, effective envelope.
 */
import { describe, it, expect } from 'vitest';
import { buildPaceCurves } from '../pace_curve_math';
import type { PaceLayerInput, PaceCurveInputs } from '../pace_types';

describe('pace_curve_math', () => {
  it('step activation at t=0', () => {
    const inputs: PaceCurveInputs = {
      horizon_hours: 72,
      layers: [
        {
          key: 'PRIMARY',
          activate_after_hours: 0,
          sustainment_hours: 24,
          capacity_pct: 80,
        },
      ],
    };
    const { perLayer, effective } = buildPaceCurves(inputs);
    const p0 = perLayer.PRIMARY.find((p) => p.t_hours === 0);
    expect(p0?.capacity_pct).toBe(80);
    const e0 = effective.find((p) => p.t_hours === 0);
    expect(e0?.capacity_pct).toBe(80);
  });

  it('activation delay', () => {
    const inputs: PaceCurveInputs = {
      horizon_hours: 72,
      layers: [
        {
          key: 'PRIMARY',
          activate_after_hours: 2,
          sustainment_hours: 24,
          capacity_pct: 80,
        },
      ],
    };
    const { perLayer, effective } = buildPaceCurves(inputs);
    const p0 = perLayer.PRIMARY.find((p) => p.t_hours === 0);
    expect(p0?.capacity_pct).toBe(0);
    const p2 = perLayer.PRIMARY.find((p) => p.t_hours === 2);
    expect(p2?.capacity_pct).toBe(80);
    const e0 = effective.find((p) => p.t_hours === 0);
    expect(e0?.capacity_pct).toBe(0);
  });

  it('sustainment cutoff', () => {
    const inputs: PaceCurveInputs = {
      horizon_hours: 72,
      layers: [
        {
          key: 'PRIMARY',
          activate_after_hours: 0,
          sustainment_hours: 10,
          capacity_pct: 80,
        },
      ],
    };
    const { perLayer, effective } = buildPaceCurves(inputs);
    const p9 = perLayer.PRIMARY.find((p) => p.t_hours === 9);
    expect(p9?.capacity_pct).toBe(80);
    const p10 = perLayer.PRIMARY.find((p) => p.t_hours === 10);
    expect(p10?.capacity_pct).toBe(80);
    const p11 = perLayer.PRIMARY.find((p) => p.t_hours === 11);
    expect(p11?.capacity_pct).toBe(0);
  });

  it('emergency unlimited sustainment', () => {
    const inputs: PaceCurveInputs = {
      horizon_hours: 96,
      layers: [
        {
          key: 'EMERGENCY',
          activate_after_hours: 0,
          sustainment_hours: undefined as unknown as number,
          capacity_pct: 20,
        },
      ],
    };
    const { perLayer, effective } = buildPaceCurves(inputs);
    const p0 = perLayer.EMERGENCY.find((p) => p.t_hours === 0);
    expect(p0?.capacity_pct).toBe(20);
    const p96 = perLayer.EMERGENCY.find((p) => p.t_hours === 96);
    expect(p96?.capacity_pct).toBe(20);
    const e96 = effective.find((p) => p.t_hours === 96);
    expect(e96?.capacity_pct).toBe(20);
  });

  it('effective envelope max()', () => {
    const inputs: PaceCurveInputs = {
      horizon_hours: 72,
      layers: [
        {
          key: 'PRIMARY',
          activate_after_hours: 0,
          sustainment_hours: 24,
          capacity_pct: 80,
        },
        {
          key: 'ALTERNATE',
          activate_after_hours: 24,
          sustainment_hours: 24,
          capacity_pct: 60,
        },
      ],
    };
    const { perLayer, effective } = buildPaceCurves(inputs);
    const p0 = perLayer.PRIMARY.find((p) => p.t_hours === 0);
    const a0 = perLayer.ALTERNATE.find((p) => p.t_hours === 0);
    expect(p0?.capacity_pct).toBe(80);
    expect(a0?.capacity_pct).toBe(0);
    const e0 = effective.find((p) => p.t_hours === 0);
    expect(e0?.capacity_pct).toBe(80);

    const p25 = perLayer.PRIMARY.find((p) => p.t_hours === 25);
    const a25 = perLayer.ALTERNATE.find((p) => p.t_hours === 25);
    expect(p25?.capacity_pct).toBe(0);
    expect(a25?.capacity_pct).toBe(60);
    const e25 = effective.find((p) => p.t_hours === 25);
    expect(e25?.capacity_pct).toBe(60);
  });
});
