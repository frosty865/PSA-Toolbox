/**
 * Regression: Water curve deterministic mapping test.
 */
import { describe, it, expect } from 'vitest';
import { buildCurveWorkbookAligned } from '../curve';
import type { CategoryInput } from 'schema';

describe('workbook_alignment_water', () => {
  it('buildCurveWorkbookAligned maps input parameters for Water', () => {
    const input: CategoryInput = {
      requires_service: true,
      time_to_impact_hours: 12,
      loss_fraction_no_backup: 0.9,
      has_backup: false,
      backup_duration_hours: null,
      loss_fraction_with_backup: null,
      recovery_time_hours: 24,
    };
    const points = buildCurveWorkbookAligned(input);
    expect(points.length).toBeGreaterThan(0);

    // At T=0: 100% capacity
    const at0 = points[0];
    expect(at0.t_hours).toBe(0);
    expect(at0.capacity_without_backup).toBe(100);

    // At T=12 (impact): 10% capacity (90% loss)
    const at12 = points.find((p) => Math.abs(p.t_hours - 12) < 0.5);
    expect(at12).toBeDefined();
    expect(at12!.capacity_without_backup).toBe(10); // 100 - 90

    // Chart ends at 78h; recovery starts at 78h so last point still in outage (90% loss)
    const atEnd = points[points.length - 1];
    expect(atEnd.t_hours).toBe(78);
    expect(atEnd.capacity_without_backup).toBe(10);
  });
});
