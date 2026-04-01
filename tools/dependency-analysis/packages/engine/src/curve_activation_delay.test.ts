/**
 * Tests for redundancy activation delay (manual/vendor transition window).
 */
import { describe, it, expect } from 'vitest';
import { buildCurveWorkbookAligned } from './curve';
import type { CategoryInput } from 'schema';

describe('curve activation delay', () => {
  it('AUTOMATIC mode: no transition window, backup effective from t=0', () => {
    const input: CategoryInput = {
      requires_service: true,
      time_to_impact_hours: 0,
      loss_fraction_no_backup: 0.9,
      has_backup_any: true,
      has_backup: true,
      backup_duration_hours: 12,
      loss_fraction_with_backup: 0.2,
      recovery_time_hours: 24,
      redundancy_activation: {
        mode: 'AUTOMATIC',
        activation_delay_min: 0,
      },
    } as CategoryInput;
    const points = buildCurveWorkbookAligned(input);
    const at0 = points.find((p) => p.t_hours === 0);
    expect(at0).toBeDefined();
    expect(at0!.capacity_with_backup).toBe(80); // 100 - 20 (L_with) — no transition
  });

  it('MANUAL_ONSITE + 30min delay: transition window 0–0.5h uses L_no', () => {
    const input: CategoryInput = {
      requires_service: true,
      time_to_impact_hours: 0,
      loss_fraction_no_backup: 0.9,
      has_backup_any: true,
      has_backup: true,
      backup_duration_hours: 12,
      loss_fraction_with_backup: 0.2,
      recovery_time_hours: 24,
      redundancy_activation: {
        mode: 'MANUAL_ONSITE',
        activation_delay_min: 30,
      },
    } as CategoryInput;
    const points = buildCurveWorkbookAligned(input);
    const at0 = points.find((p) => p.t_hours === 0);
    expect(at0).toBeDefined();
    expect(at0!.capacity_with_backup).toBe(10); // 100 - 90 (L_no) during transition
    const at1 = points.find((p) => p.t_hours >= 0.5 && p.t_hours <= 12);
    expect(at1).toBeDefined();
    expect(at1!.capacity_with_backup).toBe(80); // 100 - 20 (L_with) after activation
  });

  it('VENDOR_REQUIRED + 8hr delay: long initial degradation then sustainment', () => {
    const input: CategoryInput = {
      requires_service: true,
      time_to_impact_hours: 0,
      loss_fraction_no_backup: 0.85,
      has_backup_any: true,
      has_backup: true,
      backup_duration_hours: 24,
      loss_fraction_with_backup: 0.25,
      recovery_time_hours: 24,
      redundancy_activation: {
        mode: 'VENDOR_REQUIRED',
        activation_delay_min: 480, // 8 hours
      },
    } as CategoryInput;
    const points = buildCurveWorkbookAligned(input);
    const duringTransition = points.find((p) => p.t_hours >= 0 && p.t_hours < 8);
    expect(duringTransition).toBeDefined();
    expect(duringTransition!.capacity_with_backup).toBe(15); // 100 - 85 (L_no)
    const afterActivation = points.find((p) => p.t_hours >= 8 && p.t_hours <= 24);
    expect(afterActivation).toBeDefined();
    expect(afterActivation!.capacity_with_backup).toBe(75); // 100 - 25 (L_with)
  });

  it('UNKNOWN mode: treated as AUTOMATIC (no transition)', () => {
    const input: CategoryInput = {
      requires_service: true,
      time_to_impact_hours: 0,
      loss_fraction_no_backup: 0.9,
      has_backup_any: true,
      has_backup: true,
      backup_duration_hours: 6,
      loss_fraction_with_backup: 0.3,
      recovery_time_hours: 24,
      redundancy_activation: {
        mode: 'UNKNOWN',
        activation_delay_min: 60,
      },
    } as CategoryInput;
    const points = buildCurveWorkbookAligned(input);
    const at0 = points.find((p) => p.t_hours === 0);
    expect(at0).toBeDefined();
    expect(at0!.capacity_with_backup).toBe(70); // 100 - 30 (L_with) — UNKNOWN = no transition
  });
});
