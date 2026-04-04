import { describe, it, expect } from 'vitest';
import {
  buildCommunicationsPaceCurve,
  HORIZON_HOURS,
  DEFAULT_CARRIER_SURVIVABILITY_HOURS,
} from './communications_pace_curve';

describe('buildCommunicationsPaceCurve', () => {
  it('returns flat 100% when requires_service is false', () => {
    const result = buildCommunicationsPaceCurve({
      curve_requires_service: false,
      curve_time_to_impact_hours: 2,
      curve_loss_fraction_no_backup: 0.6,
    });
    expect(result.points.length).toBeGreaterThanOrEqual(2);
    expect(result.points[0].capacity).toBe(100);
    expect(result.points[result.points.length - 1].capacity).toBe(100);
    expect(result.segments.length).toBe(0);
  });

  it('green curve segments start at t=0 (no time offset)', () => {
    const input = {
      curve_requires_service: true,
      curve_time_to_impact_hours: 1,
      curve_loss_fraction_no_backup: 0.5,
      comm_pace_P: {
        system_type: 'LANDLINE_VOIP_TRUNK',
        sustain_hours: 12,
        effective_capacity_pct: 100,
        regional_survivability: 'LIKELY_REMAIN_OPERATIONAL',
      },
    };
    const result = buildCommunicationsPaceCurve(input, { time_horizon: HORIZON_HOURS });
    expect(result.segments.length).toBeGreaterThanOrEqual(1);
    const first = result.segments[0];
    expect(first.t_start).toBe(0);
    expect(result.points.some((p) => p.t === 0)).toBe(true);
  });

  it('produces multiple inflection points when multiple layers have sustain and capacity', () => {
    const input = {
      curve_requires_service: true,
      curve_time_to_impact_hours: 2,
      curve_loss_fraction_no_backup: 0.6,
      comm_pace_P: {
        system_type: 'LANDLINE_VOIP_TRUNK',
        sustain_hours: 12,
        effective_capacity_pct: 85,
        regional_survivability: 'LIKELY_REMAIN_OPERATIONAL',
      },
      comm_pace_A: {
        system_type: 'CELLULAR_VOICE',
        sustain_hours: 24,
        effective_capacity_pct: 70,
        regional_survivability: 'LIKELY_REMAIN_OPERATIONAL',
      },
      comm_pace_C: {
        system_type: 'PUBLIC_SAFETY_RADIO_NETWORK',
        sustain_hours: 18,
        effective_capacity_pct: 55,
        regional_survivability: 'LIKELY_REMAIN_OPERATIONAL',
      },
    };
    const result = buildCommunicationsPaceCurve(input, { time_horizon: 72 });
    const capacities = result.points.map((p) => p.capacity);
    const uniqueCapacities = [...new Set(capacities)];
    expect(uniqueCapacities.length).toBeGreaterThan(2);
    expect(result.segments.length).toBeGreaterThanOrEqual(2);
  });

  it('Alternate contributes when sustain > 0 and capacity differs from Primary', () => {
    const input = {
      curve_requires_service: true,
      curve_time_to_impact_hours: 1,
      curve_loss_fraction_no_backup: 0.8,
      comm_pace_P: {
        system_type: 'LANDLINE_VOIP_TRUNK',
        sustain_hours: 6,
        effective_capacity_pct: 90,
        regional_survivability: 'LIKELY_REMAIN_OPERATIONAL',
      },
      comm_pace_A: {
        system_type: 'CELLULAR_VOICE',
        sustain_hours: 12,
        effective_capacity_pct: 60,
        regional_survivability: 'LIKELY_REMAIN_OPERATIONAL',
      },
    };
    const result = buildCommunicationsPaceCurve(input, { time_horizon: 72 });
    const has70 = result.points.some((p) => Math.abs(p.capacity - 90) < 1);
    const has60 = result.points.some((p) => Math.abs(p.capacity - 60) < 1);
    expect(has70).toBe(true);
    expect(has60).toBe(true);
    const alternateSegment = result.segments.find((s) => s.layer === 'A');
    expect(alternateSegment).toBeDefined();
    expect(alternateSegment!.capacity).toBe(60);
  });

  it('excludes layer with sustain_hours 0 from curve', () => {
    const input = {
      curve_requires_service: true,
      curve_time_to_impact_hours: 0,
      curve_loss_fraction_no_backup: 0.5,
      comm_pace_P: {
        system_type: 'CELLULAR_VOICE',
        sustain_hours: 0,
        effective_capacity_pct: 80,
      },
      comm_pace_A: {
        system_type: 'MANUAL_RUNNER',
        sustain_hours: 24,
        effective_capacity_pct: 40,
      },
    };
    const result = buildCommunicationsPaceCurve(input);
    const pDebug = result.debug.layers.find((l) => l.layer === 'P');
    expect(pDebug?.viable).toBe(false);
    expect(pDebug?.reason).toMatch(/sustain|Excluded/i);
    const aSegment = result.segments.find((s) => s.layer === 'A');
    expect(aSegment).toBeDefined();
  });

  it('caps cellular primary to DEFAULT_CARRIER_SURVIVABILITY_HOURS when power_scope is DEVICE_ONLY', () => {
    const input = {
      curve_requires_service: true,
      curve_time_to_impact_hours: 0,
      curve_loss_fraction_no_backup: 0.6,
      comm_pace_P: {
        system_type: 'CELLULAR_VOICE',
        sustain_hours: 24,
        effective_capacity_pct: 100,
        power_scope: 'DEVICE_ONLY',
        regional_survivability: 'LIKELY_REMAIN_OPERATIONAL',
      },
      comm_pace_A: {
        system_type: 'RADIO_DIGITAL',
        sustain_hours: 48,
        effective_capacity_pct: 70,
        power_scope: 'INFRASTRUCTURE_ASSESSED',
        regional_survivability: 'LIKELY_REMAIN_OPERATIONAL',
      },
    };
    const result = buildCommunicationsPaceCurve(input, { time_horizon: HORIZON_HOURS });
    const primarySeg = result.segments.find((s) => s.layer === 'P');
    const alternateSeg = result.segments.find((s) => s.layer === 'A');
    expect(primarySeg).toBeDefined();
    expect(primarySeg!.t_start).toBe(0);
    expect(primarySeg!.t_end).toBe(DEFAULT_CARRIER_SURVIVABILITY_HOURS);
    expect(primarySeg!.capacity).toBe(100);
    expect(primarySeg!.capped).toBe(true);
    expect(alternateSeg).toBeDefined();
    expect(alternateSeg!.t_start).toBe(DEFAULT_CARRIER_SURVIVABILITY_HOURS);
    expect(alternateSeg!.t_end).toBe(8 + 48);
    expect(alternateSeg!.capacity).toBe(70);
    expect(alternateSeg!.capped).toBeFalsy();
    const maxT = Math.max(...result.points.map((p) => p.t));
    expect(maxT).toBe(HORIZON_HOURS);
    const pDebug = result.debug.layers.find((l) => l.layer === 'P');
    expect(pDebug!.sustain_hours).toBe(24);
    expect(pDebug!.effective_sustain_hours).toBe(DEFAULT_CARRIER_SURVIVABILITY_HOURS);
    expect(pDebug!.power_scope_display).toBe('Device only');
    expect(pDebug!.reason).toBe('Conditional');
  });

  it('treats missing power_scope as DEVICE_ONLY for carrier-dependent (legacy)', () => {
    const input = {
      curve_requires_service: true,
      curve_time_to_impact_hours: 0,
      curve_loss_fraction_no_backup: 0.5,
      comm_pace_P: {
        system_type: 'CELLULAR_VOICE',
        sustain_hours: 24,
        effective_capacity_pct: 100,
        // no power_scope - legacy
      },
      comm_pace_A: {
        system_type: 'RADIO_DIGITAL',
        sustain_hours: 48,
        effective_capacity_pct: 70,
        regional_survivability: 'LIKELY_REMAIN_OPERATIONAL',
      },
    };
    const result = buildCommunicationsPaceCurve(input, { time_horizon: 72 });
    const pDebug = result.debug.layers.find((l) => l.layer === 'P');
    expect(pDebug!.effective_sustain_hours).toBe(DEFAULT_CARRIER_SURVIVABILITY_HOURS);
    expect(pDebug!.power_scope_display).toMatch(/Unknown|Device only/);
    const primarySeg = result.segments.find((s) => s.layer === 'P');
    expect(primarySeg!.t_end).toBe(8);
    const aSeg = result.segments.find((s) => s.layer === 'A');
    expect(aSeg!.t_end).toBe(8 + 48);
  });
});
