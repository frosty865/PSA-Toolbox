/**
 * Tests for buildReportVMForReviewAndExport.
 * Ensures single source-of-truth VM, methodology, preflight, and no placeholder regression.
 */
import { describe, it, expect } from 'vitest';
import { buildReportVMForReviewAndExport } from './build_report_vm';
import { computeCompletion } from '@/app/lib/assessment/completion';
import type { Assessment } from 'schema';

/** Minimal assessment with only Electric Power to avoid IT/Comms forbidden-term issues. */
const minimalAssessment: Assessment = {
  meta: { created_at_iso: new Date().toISOString() },
  categories: {
    ELECTRIC_POWER: {
      requires_service: true,
      curve_requires_service: true,
      curve_time_to_impact_hours: 4,
      curve_loss_fraction_no_backup: 0.5,
      curve_backup_available: false,
      curve_recovery_time_hours: 24,
      'E-2': 'yes',
      'E-3_more_than_one_connection': 'no',
      'E-8_backup_available': 'no',
      'E-11_provider_restoration_coordination': 'yes',
    } as Record<string, unknown>,
  } as Assessment['categories'],
} as Assessment;

describe('buildReportVMForReviewAndExport', () => {
  it('when assessment_complete=true, vm.preflight.assessment_complete is true', () => {
    const completion = computeCompletion(minimalAssessment);
    const vm = buildReportVMForReviewAndExport(minimalAssessment, {
      completion,
      templateReady: true,
    });

    expect(vm.preflight.assessment_complete).toBe(completion.isComplete);
  });

  it('methodology is populated (non-empty) when assessment has data', () => {
    const vm = buildReportVMForReviewAndExport(minimalAssessment, {
      templateReady: true,
    });

    expect(vm.methodology).toBeDefined();
    expect(vm.methodology.heading).toBe('Methodology');
    expect(vm.methodology.sections.length).toBeGreaterThan(0);
    expect(vm.methodology.sections.some((s) => s.paragraphs.length > 0)).toBe(true);
  });

  it('methodology contains tool_version, template_version, horizon_hours=96', () => {
    const vm = buildReportVMForReviewAndExport(minimalAssessment);

    const allText = vm.methodology.sections
      .flatMap((s) => s.paragraphs)
      .join(' ');

    expect(allText).toMatch(/tool version|Tool version/i);
    expect(allText).toMatch(/template|Template/i);
    expect(allText).toMatch(/96/);
  });

  it('methodology does not contain prohibited filler paragraph string', () => {
    const prohibited = [
      'Methodology, appendices, and additional documentation sections',
      'TBD',
      'Insert ',
    ];

    const vm = buildReportVMForReviewAndExport(minimalAssessment);
    const allText = vm.methodology.sections
      .flatMap((s) => s.paragraphs)
      .join(' ');

    for (const phrase of prohibited) {
      expect(allText).not.toContain(phrase);
    }
  });

  it('priority_actions is populated', () => {
    const vm = buildReportVMForReviewAndExport(minimalAssessment);

    expect(vm.priority_actions).toBeDefined();
    expect(vm.priority_actions.title).toBe('Priority Actions');
    expect(Array.isArray(vm.priority_actions.actions)).toBe(true);
  });

  it('preflight has required shape', () => {
    const vm = buildReportVMForReviewAndExport(minimalAssessment);

    expect(vm.preflight).toBeDefined();
    expect(typeof vm.preflight.assessment_complete).toBe('boolean');
    expect(typeof vm.preflight.has_required_curves).toBe('boolean');
    expect(typeof vm.preflight.has_required_charts).toBe('boolean');
    expect(typeof vm.preflight.has_required_sections).toBe('boolean');
    expect(typeof vm.preflight.can_export).toBe('boolean');
    expect(Array.isArray(vm.preflight.blockers)).toBe(true);
  });

  it('completion reflects visible required questions only', () => {
    const completion = computeCompletion(minimalAssessment);
    expect(typeof completion.overallPct).toBe('number');
    expect(typeof completion.isComplete).toBe('boolean');
    expect(completion.bySector).toBeDefined();
  });

  it('no placeholder text in methodology (regression)', () => {
    const vm = buildReportVMForReviewAndExport(minimalAssessment);
    const placeholder = 'Methodology, appendices, and additional documentation sections';

    const allText = vm.methodology.sections
      .flatMap((s) => s.paragraphs)
      .join(' ');

    expect(allText).not.toContain(placeholder);
  });
});
