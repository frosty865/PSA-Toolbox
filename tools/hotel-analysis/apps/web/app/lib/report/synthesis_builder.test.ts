import { describe, it, expect } from 'vitest';
import {
  buildNumericSynthesis,
  assertNoProhibitedPhrases,
  SYNTHESIS_PROHIBITED_PHRASES,
} from './synthesis_builder';
import type { CurveSummary } from './view_model';
import type { NormalizedConditions } from './normalize_conditions';

function mockConditions(overrides: Partial<NormalizedConditions['ELECTRIC_POWER']> = {}): NormalizedConditions {
  const base = {
    requires_service: true,
    provider_confirmed: 'UNKNOWN' as const,
    single_provider_or_path: 'UNKNOWN' as const,
    entry_diversity: 'UNKNOWN' as const,
    corridor_colocated: 'UNKNOWN' as const,
    alternate_present: false,
    alternate_duration_hours: null,
    alternate_duration_class: 'NONE' as const,
    alternate_materially_reduces_loss: 'UNKNOWN' as const,
    redundancy_initiation_mode: 'UNKNOWN' as const,
    restoration_priority_established: 'UNKNOWN' as const,
    recovery_hours: null,
    recovery_duration_class: 'SHORT' as const,
    pace_depth: 'NONE' as const,
    pace_missing_layers: [],
  };

  return {
    ELECTRIC_POWER: { ...base, ...overrides },
    COMMUNICATIONS: { ...base },
    INFORMATION_TECHNOLOGY: { ...base },
    WATER: { ...base },
    WASTEWATER: { ...base },
  } as NormalizedConditions;
}

function mockCurve(infra: string, tti?: number, loss?: number, recovery?: number): CurveSummary {
  return {
    infra,
    severity: 'DELAYED',
    ...(typeof tti === 'number' && { time_to_impact_hr: tti }),
    ...(typeof loss === 'number' && { loss_no_backup_pct: loss }),
    ...(typeof recovery === 'number' && { recovery_hr: recovery }),
  };
}

describe('buildNumericSynthesis', () => {
  it('uses numeric TTI and LOSS values from fixture', () => {
    const curves: CurveSummary[] = [
      mockCurve('Electric Power', 6, 80),
      mockCurve('Water', 12, 50),
    ];
    const conditions = mockConditions();
    const result = buildNumericSynthesis({ infraCurves: curves, normalizedConditions: conditions });

    expect(result).toContain('6');
    expect(result).toContain('80');
    expect(result).toContain('Electric Power');
  });

  it('includes immediate degradation phrase when TTI is 0', () => {
    const curves: CurveSummary[] = [mockCurve('Electric Power', 0, 90)];
    const conditions = mockConditions();
    const result = buildNumericSynthesis({ infraCurves: curves, normalizedConditions: conditions });

    expect(result).toMatch(/0 hours|severe impact in 0|immediate/i);
    expect(result).toContain('Electric Power');
  });

  it('classifies as High structural sensitivity when 3+ high severity and 2+ single point', () => {
    const curves: CurveSummary[] = [
      mockCurve('Electric Power', 2, 80),
      mockCurve('Communications', 3, 76),
      mockCurve('Water', 4, 75),
    ];
    const conditions = mockConditions({
      single_provider_or_path: 'YES',
    });
    const conditionsFull: NormalizedConditions = {
      ...mockConditions(),
      ELECTRIC_POWER: { ...conditions.ELECTRIC_POWER, single_provider_or_path: 'YES' },
      COMMUNICATIONS: { ...conditions.COMMUNICATIONS, single_provider_or_path: 'YES', requires_service: true },
      INFORMATION_TECHNOLOGY: { ...conditions.INFORMATION_TECHNOLOGY },
      WATER: { ...conditions.WATER, single_provider_or_path: 'YES', requires_service: true },
      WASTEWATER: { ...conditions.WASTEWATER },
    };

    const result = buildNumericSynthesis({
      infraCurves: curves,
      normalizedConditions: conditionsFull,
    });

    expect(result).toMatch(/Structural Sensitivity: HIGH|High structural sensitivity/i);
  });

  it('returns fallback when no curve data', () => {
    const result = buildNumericSynthesis({
      infraCurves: [],
      normalizedConditions: mockConditions(),
    });

    expect(result).toContain('Complete the dependency assessment');
  });
});

describe('assertNoProhibitedPhrases', () => {
  it('throws when prohibited phrase present', () => {
    for (const phrase of SYNTHESIS_PROHIBITED_PHRASES) {
      expect(() => assertNoProhibitedPhrases(`Some text with ${phrase} in it`)).toThrow();
    }
  });

  it('passes when no prohibited phrases', () => {
    expect(() =>
      assertNoProhibitedPhrases(
        'Electric Power is the dominant upstream dependency, reaching severe impact in 6 hours with approximately 80% functional loss.'
      )
    ).not.toThrow();
  });
});

describe('test_no_generic_phrases', () => {
  it('synthesis output does not contain prohibited phrases', () => {
    const curves: CurveSummary[] = [
      mockCurve('Electric Power', 6, 80),
      mockCurve('Water', 12, 50),
    ];
    const conditions = mockConditions();
    const result = buildNumericSynthesis({ infraCurves: curves, normalizedConditions: conditions });

    for (const phrase of SYNTHESIS_PROHIBITED_PHRASES) {
      expect(result.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });
});
