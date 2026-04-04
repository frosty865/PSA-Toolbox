/**
 * PACE VM builder tests.
 * - test_comms_pace_adapter_from_legacy_curves: when old points exist and pace missing, adapter builds pace deterministically.
 */
import { describe, it, expect } from 'vitest';
import { buildCommsPaceForVM } from './comms_pace_vm';

describe('buildCommsPaceForVM', () => {
  it('returns undefined when requires_service is false', () => {
    const categoryData = {
      requires_service: false,
      curve_time_to_impact_hours: 12,
      curve_loss_fraction_no_backup: 0.5,
    };
    const result = buildCommsPaceForVM(categoryData);
    expect(result).toBeUndefined();
  });

  it('builds pace from legacy curve when comm_pace_* missing', () => {
    const categoryData = {
      requires_service: true,
      curve_requires_service: true,
      curve_time_to_impact_hours: 12,
      curve_loss_fraction_no_backup: 0.5,
      curve_backup_available: 'yes',
      curve_backup_duration_hours: 48,
      curve_loss_fraction_with_backup: 0.34,
      curve_recovery_time_hours: 6,
    };
    const result = buildCommsPaceForVM(categoryData);
    expect(result).toBeDefined();
    expect(result!.enabled).toBe(true);
    expect(result!.layers.PRIMARY.present).toBe(true);
    expect(result!.layers.PRIMARY.curve).toBeDefined();
    expect(result!.layers.PRIMARY.curve!.length).toBeGreaterThan(0);
    expect(result!.layers.ALTERNATE.present).toBe(true);
    expect(result!.layers.ALTERNATE.curve).toBeDefined();
    expect(result!.layers.CONTINGENCY.present).toBe(false);
    expect(result!.layers.EMERGENCY.present).toBe(false);
  });

  it('builds pace from comm_pace_P when viable', () => {
    const categoryData = {
      requires_service: true,
      curve_time_to_impact_hours: 8,
      curve_loss_fraction_no_backup: 0.6,
      curve_recovery_time_hours: 4,
      comm_pace_P: {
        system_type: 'LANDLINE_VOIP_TRUNK',
        sustain_hours: 72,
        effective_capacity_pct: 50,
      },
      comm_pace_A: {},
      comm_pace_C: {},
      comm_pace_E: {},
    };
    const result = buildCommsPaceForVM(categoryData);
    expect(result).toBeDefined();
    expect(result!.enabled).toBe(true);
    expect(result!.layers.PRIMARY.present).toBe(true);
    expect(result!.layers.PRIMARY.curve).toBeDefined();
    const curve = result!.layers.PRIMARY.curve!;
    expect(curve[0].t_hours).toBe(0);
    expect(curve[curve.length - 1].t_hours).toBe(96);
  });

  it('adapter from legacy curves produces deterministic Primary and Alternate', () => {
    const categoryData = {
      requires_service: true,
      curve_time_to_impact_hours: 24,
      curve_loss_fraction_no_backup: 0.5,
      curve_backup_available: 'yes',
      curve_backup_duration_hours: 24,
      curve_loss_fraction_with_backup: 0.34,
      curve_recovery_time_hours: 12,
    };
    const a = buildCommsPaceForVM(categoryData);
    const b = buildCommsPaceForVM(categoryData);
    expect(a).toEqual(b);
    expect(a!.layers.PRIMARY.curve!.map((p) => p.capacity_pct)).toEqual(
      b!.layers.PRIMARY.curve!.map((p) => p.capacity_pct)
    );
  });
});
