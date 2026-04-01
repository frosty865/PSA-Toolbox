/**
 * Tests for activation delay (transition window) in curve points.
 * altAvail=true, delay=120 min, loss0=75, lossAlt=10, dur=4
 * Expect: (0,25), (2,25), (2,90), (6,90), (6,25) — capacity = 100 - loss
 *
 * QC: curve_points must include an explicit point at activation_delay_min/60 when present.
 */
import { describe, it, expect } from 'vitest';
import { buildCurveWorkbookAligned, buildTimeGrid } from './curveClient';
import type { CategoryInput } from 'schema';

const EPS = 0.01;

describe('curveClient activation delay', () => {
  it('altAvail=true, delay=120min, loss0=75%, lossAlt=10%, dur=4h: transition at 2h, sustainment 2–6h', () => {
    const input: CategoryInput = {
      requires_service: true,
      time_to_impact_hours: 0,
      loss_fraction_no_backup: 0.75,
      has_backup_any: true,
      has_backup: true,
      backup_duration_hours: 4,
      loss_fraction_with_backup: 0.1,
      recovery_time_hours: 24,
      redundancy_activation: {
        mode: 'MANUAL_ONSITE',
        activation_delay_min: 120,
      },
    } as CategoryInput;
    const points = buildCurveWorkbookAligned(input);
    // Transition: [0, 2) -> loss 75% -> capacity 25%
    const at0 = points.find((p) => p.t_hours === 0);
    const at1 = points.find((p) => p.t_hours === 1);
    expect(at0?.capacity_with_backup).toBe(25);
    expect(at1?.capacity_with_backup).toBe(25);
    // At t=2: step to loss 10% -> capacity 90%
    const at2 = points.find((p) => p.t_hours === 2);
    expect(at2?.capacity_with_backup).toBe(90);
    // Sustainment [2, 6): capacity 90%
    const at4 = points.find((p) => p.t_hours === 4);
    const at6 = points.find((p) => p.t_hours === 6);
    const at7 = points.find((p) => p.t_hours === 7);
    expect(at4?.capacity_with_backup).toBe(90);
    // At t=6: sustainment end is inclusive, so backup still applies.
    expect(at6?.capacity_with_backup).toBe(90);
    // After t=6: backup exhausted -> back to loss 75% -> capacity 25%
    expect(at7?.capacity_with_backup).toBe(25);
  });

  it('activation_delay_min=15: time grid includes 0.25h and curve_points has a point at delayHr (QC)', () => {
    const grid = buildTimeGrid({
      horizonHours: 96,
      baseStepHours: 1,
      activationDelayHr: 15 / 60,
    });
    expect(grid.some((t) => Math.abs(t - 0.25) < EPS)).toBe(true);

    const input: CategoryInput = {
      requires_service: true,
      time_to_impact_hours: 1,
      loss_fraction_no_backup: 0.5,
      has_backup_any: true,
      backup_duration_hours: 4,
      loss_fraction_with_backup: 0.1,
      recovery_time_hours: 24,
      redundancy_activation: { mode: 'MANUAL_ONSITE', activation_delay_min: 15 },
    } as CategoryInput;
    const points = buildCurveWorkbookAligned(input);
    const atDelay = points.find((p) => Math.abs(p.t_hours - 0.25) < EPS);
    expect(atDelay).toBeDefined();
    expect(atDelay!.t_hours).toBeCloseTo(0.25, 2);
  });

  it('adds delay point when activation_delay_min=15 even with mode AUTOMATIC (QC requires point at delayHr)', () => {
    const input: CategoryInput = {
      requires_service: true,
      time_to_impact_hours: 1,
      loss_fraction_no_backup: 0.5,
      has_backup_any: true,
      backup_duration_hours: 4,
      loss_fraction_with_backup: 0.1,
      recovery_time_hours: 24,
      redundancy_activation: { mode: 'AUTOMATIC', activation_delay_min: 15 },
    } as CategoryInput;
    const points = buildCurveWorkbookAligned(input);
    const atDelay = points.find((p) => Math.abs(p.t_hours - 0.25) < EPS);
    expect(atDelay).toBeDefined();
    expect(atDelay!.t_hours).toBeCloseTo(0.25, 2);
  });

  it('IT-style: top.backup_duration_hours null, curve_backup_duration_hours=96 → curve uses 96h backup (with-backup sustainment)', () => {
    const input = {
      requires_service: true,
      curve_time_to_impact_hours: 1,
      curve_loss_fraction_no_backup: 0.75,
      curve_backup_available: 'yes' as const,
      backup_duration_hours: null as number | null,
      curve_backup_duration_hours: 96,
      curve_loss_fraction_with_backup: 0.25,
      curve_recovery_time_hours: 0,
    };
    const points = buildCurveWorkbookAligned(input as Parameters<typeof buildCurveWorkbookAligned>[0]);
    expect(points.length).toBeGreaterThan(0);
    const afterImpact = points.find((p) => p.t_hours >= 1 && p.t_hours < 2);
    expect(afterImpact?.capacity_without_backup).toBe(25);
    const withBackupAt50 = points.find((p) => Math.abs(p.t_hours - 50) < 0.5);
    expect(withBackupAt50?.capacity_with_backup).toBe(75);
    const nearEnd = points.filter((p) => p.t_hours >= 95);
    expect(nearEnd.some((p) => p.capacity_with_backup === 75)).toBe(true);
    const at96 = points.find((p) => Math.abs(p.t_hours - 96) < EPS);
    expect(at96?.capacity_with_backup).toBe(75);
  });

  it('IT-style input (curve_* keys): backup_available=true, loss_no_backup=90%, loss_with_backup=25% → initial drop 10% capacity, backup recovery 75%', () => {
    const input = {
      requires_service: true,
      curve_time_to_impact_hours: 2,
      curve_loss_fraction_no_backup: 0.9,
      curve_backup_available: 'yes' as const,
      curve_backup_duration_hours: 8,
      curve_loss_fraction_with_backup: 0.25,
      curve_recovery_time_hours: 12,
    };
    const points = buildCurveWorkbookAligned(input as Parameters<typeof buildCurveWorkbookAligned>[0]);
    // After impact (t>=2): without backup = 100 - 90 = 10%
    const afterImpact = points.find((p) => p.t_hours >= 2 && p.t_hours < 3);
    expect(afterImpact?.capacity_without_backup).toBe(10);
    // With backup: after activation (no delay) sustainment uses loss_with_backup -> 100 - 25 = 75%
    const withBackupSustain = points.find((p) => p.t_hours >= 2 && p.t_hours <= 8);
    expect(withBackupSustain?.capacity_with_backup).toBe(75);
  });
});
