/**
 * Regression: Wastewater curve deterministic mapping test.
 */
import { describe, it, expect } from 'vitest';
import { buildCurveWorkbookAligned } from '../curve';
import type { CategoryInput } from 'schema';

describe('workbook_alignment_wastewater', () => {
  it('buildCurveWorkbookAligned maps input parameters for Wastewater (no service)', () => {
    const input: CategoryInput = {
      requires_service: false,
      time_to_impact_hours: 0,
      loss_fraction_no_backup: 0,
      has_backup: false,
      backup_duration_hours: null,
      loss_fraction_with_backup: null,
      recovery_time_hours: 0,
    };
    const points = buildCurveWorkbookAligned(input);
    expect(points.length).toBeGreaterThan(0);
    // If service not required, capacity should always be 100%
    points.forEach((p) => {
      expect(p.capacity_without_backup).toBe(100);
      expect(p.capacity_with_backup).toBe(100);
    });
  });

  it('buildCurveWorkbookAligned maps input parameters for Wastewater (with impact)', () => {
    const input: CategoryInput = {
      requires_service: true,
      time_to_impact_hours: 6,
      loss_fraction_no_backup: 0.85,
      has_backup_any: true,
      has_backup: true,
      backup_duration_hours: 18,
      loss_fraction_with_backup: 0.15,
      recovery_time_hours: 8,
    };
    const points = buildCurveWorkbookAligned(input);
    expect(points.length).toBeGreaterThan(0);

    // At impact (T=6): capacity_with = 85% (15% loss)
    const at6 = points.find((p) => Math.abs(p.t_hours - 6) < 0.5);
    expect(at6).toBeDefined();
    expect(at6!.capacity_with_backup).toBe(85);

    // After backup exhausted (T=24): capacity_with = 15% (85% loss)
    const at24 = points.find((p) => Math.abs(p.t_hours - 24) < 0.5);
    expect(at24).toBeDefined();
    expect(at24!.capacity_with_backup).toBe(15);
  });
});
