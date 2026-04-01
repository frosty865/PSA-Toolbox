import { describe, it, expect } from 'vitest';
import { migrateReportThemedFindingsFromCategories } from '../migrate_report_themed_findings';
import type { Assessment } from 'schema';
import { getDefaultAssessment } from '@/lib/default-assessment';

function makeAssessment(): Assessment {
  return getDefaultAssessment();
}

describe('migrateReportThemedFindingsFromCategories', () => {
  it('moves report_themed_findings from categories to sessions.derived.themedFindings and deletes from categories', () => {
    const themed = [
      { id: 'v1', title: 'Transport path', narrative: 'Same conduit.', ofcText: 'OFC one.' },
    ];
    const assessment = makeAssessment();
    assessment.categories.INFORMATION_TECHNOLOGY = {
      ...assessment.categories.INFORMATION_TECHNOLOGY,
      report_themed_findings: themed,
      it_transport_resilience: { circuit_count: 'TWO' },
    } as Record<string, unknown> as Assessment['categories']['INFORMATION_TECHNOLOGY'];

    migrateReportThemedFindingsFromCategories(assessment);

    expect((assessment.categories?.INFORMATION_TECHNOLOGY as Record<string, unknown>)?.report_themed_findings).toBeUndefined();
    const sessions = (assessment as Record<string, unknown>).sessions as Record<string, { derived?: { themedFindings?: unknown[] } }>;
    expect(sessions?.INFORMATION_TECHNOLOGY?.derived?.themedFindings).toEqual(themed);
  });

  it('does not overwrite existing sessions.derived.themedFindings; still deletes from categories', () => {
    const existing = [{ id: 'existing', title: 'Existing', narrative: 'Keep me.', ofcText: '' }];
    const fromCategories = [{ id: 'from-cat', title: 'From categories', narrative: 'Ignore.', ofcText: '' }];
    const assessment = makeAssessment();
    assessment.categories.INFORMATION_TECHNOLOGY = {
      ...assessment.categories.INFORMATION_TECHNOLOGY,
      report_themed_findings: fromCategories,
    } as Record<string, unknown> as Assessment['categories']['INFORMATION_TECHNOLOGY'];
    (assessment as Record<string, unknown>).sessions = {
      INFORMATION_TECHNOLOGY: {
        derived: { themedFindings: existing },
      },
    };

    migrateReportThemedFindingsFromCategories(assessment);

    expect((assessment.categories?.INFORMATION_TECHNOLOGY as Record<string, unknown>)?.report_themed_findings).toBeUndefined();
    const sessions = (assessment as Record<string, unknown>).sessions as Record<string, { derived?: { themedFindings?: unknown[] } }>;
    expect(sessions?.INFORMATION_TECHNOLOGY?.derived?.themedFindings).toEqual(existing);
  });

  it('creates sessions and derived when missing', () => {
    const assessment = makeAssessment();
    assessment.categories.ELECTRIC_POWER = {
      ...assessment.categories.ELECTRIC_POWER,
      report_themed_findings: [],
    } as Record<string, unknown> as Assessment['categories']['ELECTRIC_POWER'];

    migrateReportThemedFindingsFromCategories(assessment);

    expect((assessment.categories?.ELECTRIC_POWER as Record<string, unknown>)?.report_themed_findings).toBeUndefined();
    const sessions = (assessment as Record<string, unknown>).sessions as Record<string, unknown>;
    expect(sessions?.ELECTRIC_POWER).toBeDefined();
    expect((sessions?.ELECTRIC_POWER as { derived?: unknown })?.derived).toBeDefined();
  });

  /**
   * C. Migration back-compat: categories.INFORMATION_TECHNOLOGY.report_themed_findings contains entries with ofcText;
   * sessions.INFORMATION_TECHNOLOGY.derived missing. After normalize: sessions.derived.themedFindings preserved with ofcText.
   */
  it('preserves ofcText when migrating from categories.report_themed_findings to sessions.derived.themedFindings', () => {
    const themed = [
      { id: 'v1', title: 'Transport', narrative: 'Same conduit.', ofcText: 'Consider path diversity.' },
    ];
    const assessment = makeAssessment();
    assessment.categories.INFORMATION_TECHNOLOGY = {
      ...assessment.categories.INFORMATION_TECHNOLOGY,
      report_themed_findings: themed,
    } as Record<string, unknown> as Assessment['categories']['INFORMATION_TECHNOLOGY'];

    migrateReportThemedFindingsFromCategories(assessment);

    const sessions = (assessment as Record<string, unknown>).sessions as Record<string, { derived?: { themedFindings?: Array<{ ofcText?: string }> } }>;
    const migrated = sessions?.INFORMATION_TECHNOLOGY?.derived?.themedFindings;
    expect(migrated).toHaveLength(1);
    expect(migrated?.[0]?.ofcText).toBe('Consider path diversity.');
  });

  /**
   * D. Do-not-overwrite: sessions.derived.themedFindings already has ofcText; categories.report_themed_findings exists but is stripped/stale.
   * After normalize: sessions version wins; ofcText remains intact.
   */
  it('does not overwrite existing sessions.derived.themedFindings when categories has report_themed_findings (sessions wins)', () => {
    const existing = [
      { id: 'keep', title: 'Keep me', narrative: 'Existing.', ofcText: 'Existing OFC text.' },
    ];
    const fromCategories = [
      { id: 'stale', title: 'Stale', narrative: 'Stale.', ofcText: '' },
    ];
    const assessment = makeAssessment();
    assessment.categories.WATER = {
      ...assessment.categories.WATER,
      report_themed_findings: fromCategories,
    } as Record<string, unknown> as Assessment['categories']['WATER'];
    (assessment as Record<string, unknown>).sessions = {
      WATER: {
        derived: { themedFindings: existing },
      },
    };

    migrateReportThemedFindingsFromCategories(assessment);

    expect((assessment.categories?.WATER as Record<string, unknown>)?.report_themed_findings).toBeUndefined();
    const sessions = (assessment as Record<string, unknown>).sessions as Record<string, { derived?: { themedFindings?: unknown[] } }>;
    expect(sessions?.WATER?.derived?.themedFindings).toEqual(existing);
    expect((sessions?.WATER?.derived?.themedFindings?.[0] as { ofcText?: string })?.ofcText).toBe('Existing OFC text.');
  });
});
