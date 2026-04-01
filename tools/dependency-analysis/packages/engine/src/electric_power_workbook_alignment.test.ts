/**
 * Deterministic impact curve validation tests.
 * Tests verify that curve logic directly maps user inputs to curve points.
 */
import { describe, it, expect } from 'vitest';
import { buildCurveWorkbookAligned } from './curve';
import type { CategoryInput } from 'schema';

describe('electric_power_workbook_alignment', () => {
  it('deterministic: no-backup case with linear recovery', () => {
    const input: CategoryInput = {
      requires_service: true,
      time_to_impact_hours: 4,
      loss_fraction_no_backup: 0.9,
      has_backup_any: false,
      has_backup_generator: false,
      backup_duration_hours: null,
      loss_fraction_with_backup: null,
      recovery_time_hours: 24,
    };
    const points = buildCurveWorkbookAligned(input);

    // At T=0: no loss yet
    const at0 = points.find((p) => Math.abs(p.t_hours - 0) < 0.5);
    expect(at0).toBeDefined();
    expect(at0!.capacity_without_backup).toBe(100);

    // After impact (T >= 4), before recovery: loss = 90%. Recovery starts at T_outage=78h.
    const after_impact = points.find((p) => p.t_hours >= 4 && p.t_hours < 78);
    expect(after_impact).toBeDefined();
    expect(after_impact!.capacity_without_backup).toBe(10); // 100 - 90

    // Chart ends at 78h. Recovery starts at T_outage=78h, so no recovery within window; still at loss.
    const at78 = points.find((p) => p.t_hours === 78);
    expect(at78).toBeDefined();
    expect(at78!.capacity_without_backup).toBe(10); // still 90% loss (recovery would be 78..102)
  });

  it('deterministic: with-backup case - backup active then exhausted', () => {
    const input: CategoryInput = {
      requires_service: true,
      time_to_impact_hours: 2,
      loss_fraction_no_backup: 0.9,
      has_backup_any: true,
      has_backup_generator: false,
      backup_duration_hours: 6,
      loss_fraction_with_backup: 0.3,
      recovery_time_hours: 2,
    };
    const points = buildCurveWorkbookAligned(input);

    // Phase 1: At t=0, with-backup curve is L_with from outage start (backup active 0..6h)
    const at0 = points.find((p) => p.t_hours === 0);
    expect(at0).toBeDefined();
    expect(at0!.capacity_with_backup).toBe(70); // 100 - 30 (L_with)

    // Phase 2: Backup active from t=0 to T_backup=6 (T <= 6)
    const with_backup = points.find((p) => p.t_hours >= 2 && p.t_hours <= 6);
    expect(with_backup).toBeDefined();
    expect(with_backup!.capacity_with_backup).toBe(70); // 100 - 30 (loss_with)

    // Phase 3: Backup exhausted (T > 6), before recovery at 78h
    const after_backup = points.find((p) => p.t_hours > 6 && p.t_hours < 78);
    expect(after_backup).toBeDefined();
    expect(after_backup!.capacity_with_backup).toBe(10); // 100 - 90 (loss_no)

    // Phase 4: Chart end 78h; recovery starts at 78h so at 78 we're still at loss (recovery end would be 80, capped at 78)
    const at78 = points.find((p) => p.t_hours === 78);
    expect(at78).toBeDefined();
    expect(at78!.capacity_with_backup).toBe(10);
  });

  it('validation case: T_impact=0, long backup window (chart capped at 78h)', () => {
    const input: CategoryInput = {
      requires_service: true,
      time_to_impact_hours: 0,
      loss_fraction_no_backup: 0.75,
      has_backup_any: true,
      has_backup_generator: false,
      backup_duration_hours: 96,
      loss_fraction_with_backup: 0.15,
      recovery_time_hours: 1,
    };
    const points = buildCurveWorkbookAligned(input);

    const at0 = points[0];
    expect(at0.t_hours).toBe(0);
    expect(at0.capacity_without_backup).toBe(25); // 100 - 75
    expect(at0.capacity_with_backup).toBe(85);   // 100 - 15

    // Chart ends at 78h. Backup is 96h so at 78h backup still active.
    const at78 = points.find((p) => p.t_hours === 78);
    expect(at78).toBeDefined();
    expect(at78!.capacity_with_backup).toBe(85); // Still in backup
    expect(at78!.capacity_without_backup).toBe(25);
  });

  it('service not required: capacity always 100%', () => {
    const input: CategoryInput = {
      requires_service: false,
      time_to_impact_hours: 10,
      loss_fraction_no_backup: 0.5,
      has_backup_any: false,
      has_backup_generator: false,
      backup_duration_hours: null,
      loss_fraction_with_backup: null,
      recovery_time_hours: 0,
    };
    const points = buildCurveWorkbookAligned(input);
    points.forEach((p) => {
      expect(p.capacity_without_backup).toBe(100);
      expect(p.capacity_with_backup).toBe(100);
    });
  });

  it('zero loss: capacity stays at 100%', () => {
    const input: CategoryInput = {
      requires_service: true,
      time_to_impact_hours: 5,
      loss_fraction_no_backup: 0,
      has_backup_any: false,
      has_backup_generator: false,
      backup_duration_hours: null,
      loss_fraction_with_backup: null,
      recovery_time_hours: 0,
    };
    const points = buildCurveWorkbookAligned(input);
    points.forEach((p) => {
      expect(p.capacity_without_backup).toBe(100);
    });
  });
});
