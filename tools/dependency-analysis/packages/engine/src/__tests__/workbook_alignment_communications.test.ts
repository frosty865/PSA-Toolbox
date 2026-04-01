/**
 * Regression: Communications curve uses same workbook formula (78h chart horizon).
 */
import { describe, it, expect } from 'vitest';
import { buildCurveWorkbookAligned } from '../curve';
import type { CategoryInput } from 'schema';

const CHART_MAX_HOURS = 78;

describe('workbook_alignment_communications', () => {
  it('buildCurveWorkbookAligned matches workbook semantics for Communications (has_backup legacy)', () => {
    const input: CategoryInput = {
      requires_service: true,
      time_to_impact_hours: 6,
      loss_fraction_no_backup: 0.7,
      has_backup: true,
      backup_duration_hours: 24,
      loss_fraction_with_backup: 0.2,
      recovery_time_hours: 12,
    };
    const points = buildCurveWorkbookAligned(input);
    expect(points[0].t_hours).toBe(0);
    expect(points[points.length - 1].t_hours).toBe(CHART_MAX_HOURS);
    const at6 = points.find((p) => p.t_hours === 6);
    expect(at6?.capacity_without_backup).toBe(30); // 100 - 70
    expect(at6?.capacity_with_backup).toBe(80);   // 100 - 20 (backup active from t=0 to 24)
  });
});
