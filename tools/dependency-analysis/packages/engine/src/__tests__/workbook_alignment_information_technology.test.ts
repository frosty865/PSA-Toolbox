/**
 * Regression: Information Technology curve uses same workbook formula (3-hour bins, 72h outage, recovery).
 */
import { describe, it, expect } from 'vitest';
import { buildCurveWorkbookAligned } from '../curve';
import type { CategoryInput } from 'schema';

describe('workbook_alignment_information_technology', () => {
  it('buildCurveWorkbookAligned maps input parameters for IT (no backup)', () => {
    const input: CategoryInput = {
      requires_service: true,
      time_to_impact_hours: 3,
      loss_fraction_no_backup: 0.75,
      has_backup_any: false,
      backup_duration_hours: null,
      loss_fraction_with_backup: null,
      recovery_time_hours: 12,
    };
    const points = buildCurveWorkbookAligned(input);
    expect(points.length).toBeGreaterThan(0);

    // At T=3 (impact): 75% loss => 25% capacity
    const at3 = points.find((p) => Math.abs(p.t_hours - 3) < 0.5);
    expect(at3?.capacity_without_backup).toBe(25);
    expect(at3?.capacity_with_backup).toBe(25);
  });
});
