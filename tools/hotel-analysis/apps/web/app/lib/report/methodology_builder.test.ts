/**
 * Tests for methodology_builder.
 */
import { describe, it, expect } from 'vitest';
import { buildMethodology } from './methodology_builder';
import type { Assessment } from 'schema';

const minimalAssessment: Assessment = {
  meta: { created_at_iso: new Date().toISOString() },
  categories: {
    ELECTRIC_POWER: { requires_service: true } as Record<string, unknown>,
  } as Assessment['categories'],
} as Assessment;

describe('buildMethodology', () => {
  it('contains tool_version, template_version, horizon_hours=96', () => {
    const block = buildMethodology({ assessment: minimalAssessment });

    expect(block.tool_version).toBeDefined();
    expect(typeof block.tool_version).toBe('string');
    expect(block.template_version).toBeDefined();
    expect(block.horizon_hours).toBe(96);
  });

  it('does not contain prohibited filler paragraph string', () => {
    const prohibited = 'Methodology, appendices, and additional documentation sections';

    const block = buildMethodology({ assessment: minimalAssessment });
    const allText = [
      block.tool_version,
      block.template_version,
      block.curve_model,
      block.vulnerability_model,
      ...block.notes,
    ].join(' ');

    expect(allText).not.toContain(prohibited);
  });

  it('cross_dependency has enabled and edges', () => {
    const block = buildMethodology({ assessment: minimalAssessment });

    expect(block.cross_dependency).toBeDefined();
    expect(typeof block.cross_dependency.enabled).toBe('boolean');
    expect(typeof block.cross_dependency.edges).toBe('number');
  });

  it('data_completeness_by_sector has all five sectors', () => {
    const block = buildMethodology({ assessment: minimalAssessment });

    const sectors = [
      'ELECTRIC_POWER',
      'COMMUNICATIONS',
      'INFORMATION_TECHNOLOGY',
      'WATER',
      'WASTEWATER',
    ];
    for (const sector of sectors) {
      const entry = block.data_completeness_by_sector[sector as keyof typeof block.data_completeness_by_sector];
      expect(entry).toBeDefined();
      expect(typeof entry.captured).toBe('number');
      expect(typeof entry.expected).toBe('number');
    }
  });
});
