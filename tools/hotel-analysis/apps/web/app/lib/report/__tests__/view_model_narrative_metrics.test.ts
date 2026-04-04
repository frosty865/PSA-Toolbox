/**
 * VM narrative metrics: ensure ReportVM exposes fields required by build_sector_narrative.
 * Reporter reads from assessment.categories; VM curve summaries must have equivalent data
 * so export/narrative flows have complete metrics (TTI, LOSS, REC, ALT_SUST when applicable).
 */
import { describe, it, expect } from 'vitest';
import { buildReportVM } from '../view_model';
import { fullAssessmentForExport } from 'engine';
import type { Assessment } from 'schema';

const CHART_CATEGORIES = ['ELECTRIC_POWER', 'COMMUNICATIONS', 'INFORMATION_TECHNOLOGY', 'WATER', 'WASTEWATER'] as const;

function hasRequiredCurveFields(curve: { time_to_impact_hr?: number; loss_no_backup_pct?: number; recovery_hr?: number }): boolean {
  const tti = curve.time_to_impact_hr;
  const loss = curve.loss_no_backup_pct;
  const rec = curve.recovery_hr;
  return (
    typeof tti === 'number' &&
    Number.isFinite(tti) &&
    typeof loss === 'number' &&
    Number.isFinite(loss) &&
    typeof rec === 'number' &&
    Number.isFinite(rec)
  );
}

function requiresService(assessment: Assessment, code: string): boolean {
  const cat = assessment.categories?.[code as keyof NonNullable<Assessment['categories']>];
  if (!cat || typeof cat !== 'object') return false;
  const c = cat as Record<string, unknown>;
  return c.requires_service === true || c.curve_requires_service === true;
}

function hasBackup(assessment: Assessment, code: string): boolean {
  const cat = assessment.categories?.[code as keyof NonNullable<Assessment['categories']>];
  if (!cat || typeof cat !== 'object') return false;
  const c = cat as Record<string, unknown>;
  return (
    c.has_backup === true ||
    c.has_backup_any === true ||
    c.curve_backup_available === true ||
    c.curve_backup_available === 'yes'
  );
}

describe('VM narrative metrics', () => {
  it('curve summaries include TTI, LOSS, REC for sectors with requires_service', () => {
    const vm = buildReportVM(fullAssessmentForExport);

    for (const code of CHART_CATEGORIES) {
      if (!requiresService(fullAssessmentForExport, code)) continue;

      const section = vm.infrastructures.find((i) => i.code === code);
      expect(section).toBeDefined();
      expect(section!.curve).toBeDefined();

      expect(
        hasRequiredCurveFields(section!.curve),
        `${code}: curve must have time_to_impact_hr, loss_no_backup_pct, recovery_hr`
      ).toBe(true);
    }
  });

  it('sectors with backup have backup_duration_hr in curve summary', () => {
    const vm = buildReportVM(fullAssessmentForExport);

    for (const code of CHART_CATEGORIES) {
      if (!requiresService(fullAssessmentForExport, code) || !hasBackup(fullAssessmentForExport, code)) continue;

      const section = vm.infrastructures.find((i) => i.code === code);
      expect(section).toBeDefined();
      expect(section!.curve.backup_available).toBe(true);
      expect(
        typeof section!.curve.backup_duration_hr === 'number' && Number.isFinite(section!.curve.backup_duration_hr),
        `${code}: backup present but backup_duration_hr missing or invalid`
      ).toBe(true);
    }
  });

  it('executive curve_summaries match infrastructure curves for narrative fields', () => {
    const vm = buildReportVM(fullAssessmentForExport);

    for (const section of vm.infrastructures) {
      const execCurve = vm.executive.curve_summaries.find((c) => c.infra === section.display_name);
      if (!execCurve) continue;

      expect(execCurve.time_to_impact_hr).toEqual(section.curve.time_to_impact_hr);
      expect(execCurve.loss_no_backup_pct).toEqual(section.curve.loss_no_backup_pct);
      expect(execCurve.recovery_hr).toEqual(section.curve.recovery_hr);
      expect(execCurve.backup_available).toEqual(section.curve.backup_available);
      expect(execCurve.backup_duration_hr).toEqual(section.curve.backup_duration_hr);
    }
  });
});
