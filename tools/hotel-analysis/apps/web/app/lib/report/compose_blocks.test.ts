import { describe, it, expect } from 'vitest';
import { composeReportBlocks } from './compose_blocks';
import { buildReportVMForReviewAndExport } from './build_report_vm';
import { REPORT_SECTIONS } from './report_sections';
import type { Assessment } from 'schema';

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
    } as Record<string, unknown>,
  } as Assessment['categories'],
} as Assessment;

describe('composeReportBlocks', () => {
  it('TOC/body: top-level section count equals REPORT_SECTIONS.length and titles match', () => {
    const vm = buildReportVMForReviewAndExport(minimalAssessment, { templateReady: true });
    const blocks = composeReportBlocks(vm);
    const h1Blocks = blocks.filter((b) => b.type === 'heading' && (b as { level?: number }).level === 1);
    expect(h1Blocks.length).toBe(REPORT_SECTIONS.length);
    h1Blocks.forEach((block, i) => {
      const text = (block as { text?: string }).text ?? '';
      expect(text).toBe(REPORT_SECTIONS[i].title);
    });
  });

  it('no skipped section numbers: level-1 headings have numbers 1 through 10', () => {
    const vm = buildReportVMForReviewAndExport(minimalAssessment, { templateReady: true });
    const blocks = composeReportBlocks(vm);
    const h1Blocks = blocks.filter((b) => b.type === 'heading' && (b as { level?: number }).level === 1);
    const numbers = h1Blocks.map((b) => (b as { number?: string }).number).filter(Boolean);
    expect(numbers).toHaveLength(REPORT_SECTIONS.length);
    for (let i = 0; i < numbers.length; i++) {
      expect(numbers[i]).toBe(String(i + 1));
    }
  });
});
