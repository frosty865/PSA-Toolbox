/**
 * Tests for IT category input: supply.sources as authoritative for ISPs, migration from IT-1.
 */
import { describe, it, expect } from 'vitest';
import {
  itAnswersToInformationTechnologyCategoryInput,
  categoryInputToItAnswers,
  migrateAssessmentItIsp,
} from './it_to_category_input';
import { getDefaultItAnswers, IT_QUESTION_IDS } from './infrastructure/it_spec';

describe('itAnswersToInformationTechnologyCategoryInput', () => {
  it('writes primary and secondary ISP to supply.sources (two ISPs -> two sources)', () => {
    const answers = {
      ...getDefaultItAnswers(),
      curve_requires_service: true,
      curve_primary_provider: 'Comcast',
      curve_secondary_provider: 'Google Fiber',
    };
    const out = itAnswersToInformationTechnologyCategoryInput(answers, {});
    const supply = out.supply;
    expect(supply).toBeDefined();
    expect(supply!.sources).toHaveLength(2);
    expect(supply!.sources[0].provider_name).toBe('Comcast');
    expect(supply!.sources[1].provider_name).toBe('Google Fiber');
    expect(supply!.has_alternate_source).toBe(true);
  });

  it('keeps only primary in supply when no secondary', () => {
    const answers = {
      ...getDefaultItAnswers(),
      curve_requires_service: true,
      curve_primary_provider: 'Comcast',
    };
    const out = itAnswersToInformationTechnologyCategoryInput(answers, {});
    expect(out.supply!.sources).toHaveLength(1);
    expect(out.supply!.sources[0].provider_name).toBe('Comcast');
    expect(out.supply!.has_alternate_source).toBe(false);
  });
});

describe('categoryInputToItAnswers', () => {
  it('reads curve_primary_provider and curve_secondary_provider from supply.sources', () => {
    const category = {
      supply: {
        has_alternate_source: true,
        sources: [
          { source_id: 'a', provider_name: 'Comcast', independence: 'UNKNOWN' as const, source_label: null, demarcation_lat: null, demarcation_lon: null, demarcation_description: null, notes: null },
          { source_id: 'b', provider_name: 'Xfinity', independence: 'UNKNOWN' as const, source_label: null, demarcation_lat: null, demarcation_lon: null, demarcation_description: null, notes: null },
        ],
      },
    };
    const out = categoryInputToItAnswers(category);
    expect(out.curve_primary_provider).toBe('Comcast');
    expect(out.curve_secondary_provider).toBe('Xfinity');
  });
});

describe('IT alternate-method block removed (regression)', () => {
  it('IT_QUESTION_IDS does not include IT-8, IT-9, IT-10', () => {
    expect(IT_QUESTION_IDS).not.toContain('IT-8');
    expect(IT_QUESTION_IDS).not.toContain('IT-9');
    expect(IT_QUESTION_IDS).not.toContain('IT-10');
    expect(IT_QUESTION_IDS).toContain('IT-11');
  });

  it('getDefaultItAnswers does not contain legacy alternate-method keys', () => {
    const defaults = getDefaultItAnswers();
    expect(defaults).not.toHaveProperty('IT-8_backup_available');
    expect(defaults).not.toHaveProperty('IT-8_backup_capabilities');
    expect(defaults).not.toHaveProperty('IT-9_sustainment_plan');
    expect(defaults).not.toHaveProperty('IT-9_plan_details');
    expect(defaults).not.toHaveProperty('IT-10_reliability_known');
    expect(defaults).not.toHaveProperty('curve_backup_duration_hours');
  });
});

describe('migrateAssessmentItIsp', () => {
  it('moves ISP from IT-1 to supply.sources when supply has one source', () => {
    const assessment = {
      categories: {
        INFORMATION_TECHNOLOGY: {
          supply: {
            has_alternate_source: false,
            sources: [
              { source_id: 'x', provider_name: 'Comcast', independence: 'UNKNOWN' as const, source_label: null, demarcation_lat: null, demarcation_lon: null, demarcation_description: null, notes: null },
            ],
          },
          'IT-1_service_providers': [
            { provider_name: 'Xfinity', designation: 'secondary' as const },
          ],
        },
      },
    };
    migrateAssessmentItIsp(assessment);
    const itCat = assessment.categories!.INFORMATION_TECHNOLOGY as Record<string, unknown>;
    const supply = itCat.supply as { sources: Array<{ provider_name: string | null }> };
    const it1 = itCat['IT-1_service_providers'] as Array<{ provider_name: string }>;
    expect(supply.sources).toHaveLength(2);
    expect(supply.sources[1].provider_name).toBe('Xfinity');
    expect(it1).toHaveLength(0);
  });

  it('ISP must not appear in IT-1 after migration', () => {
    const assessment = {
      categories: {
        INFORMATION_TECHNOLOGY: {
          supply: {
            has_alternate_source: false,
            sources: [{ source_id: 'x', provider_name: 'Comcast', independence: 'UNKNOWN' as const, source_label: null, demarcation_lat: null, demarcation_lon: null, demarcation_description: null, notes: null }],
          },
          'IT-1_service_providers': [{ provider_name: 'Xfinity', designation: 'secondary' as const }],
        },
      },
    };
    migrateAssessmentItIsp(assessment);
    const it1 = (assessment.categories!.INFORMATION_TECHNOLOGY as Record<string, unknown>)['IT-1_service_providers'] as Array<{ provider_name: string }>;
    expect(it1).toHaveLength(0);
    expect(it1.some((p) => p.provider_name === 'Xfinity' || p.provider_name === 'Comcast')).toBe(false);
  });

  it('does not move non-ISP from IT-1 to supply', () => {
    const assessment = {
      categories: {
        INFORMATION_TECHNOLOGY: {
          supply: {
            has_alternate_source: false,
            sources: [
              { source_id: 'x', provider_name: 'Comcast', independence: 'UNKNOWN' as const, source_label: null, demarcation_lat: null, demarcation_lon: null, demarcation_description: null, notes: null },
            ],
          },
          'IT-1_service_providers': [
            { provider_name: 'Acme MSP', designation: 'primary' as const },
          ],
        },
      },
    };
    migrateAssessmentItIsp(assessment);
    const itCat = assessment.categories!.INFORMATION_TECHNOLOGY as Record<string, unknown>;
    const supply = itCat.supply as { sources: unknown[] };
    const it1 = itCat['IT-1_service_providers'] as Array<{ provider_name: string }>;
    expect(supply.sources).toHaveLength(1);
    expect(it1).toHaveLength(1);
    expect(it1[0].provider_name).toBe('Acme MSP');
  });
});
