/**
 * Regression tests for PRA/SLA toggle gating.
 * Ensures W_Q6, WW_Q6 and other PRA/SLA-only questions are not rendered when toggle is OFF.
 */

import { describe, it, expect } from 'vitest';
import { filterQuestionsByScope, shouldShowQuestion, isPraSlaQuestion } from '../../../../../lib/dependencies/question-visibility';
import { resolveWaterThemes } from '../theme_combiners/water';
import { resolveWastewaterThemes } from '../theme_combiners/wastewater';
import type { ThemeResolverInput } from '../themeTypes';

describe('Question Visibility', () => {
  describe('shouldShowQuestion', () => {
    it('returns true for BASELINE questions when PRA/SLA is OFF', () => {
      expect(shouldShowQuestion('W_Q1', 'BASELINE', false)).toBe(true);
      expect(shouldShowQuestion('W_Q4', 'BASELINE', false)).toBe(true);
    });

    it('returns false for PRA_SLA questions when PRA/SLA is OFF', () => {
      expect(shouldShowQuestion('W_Q6', 'PRA_SLA', false)).toBe(false);
      expect(shouldShowQuestion('W_Q7', 'PRA_SLA', false)).toBe(false);
      expect(shouldShowQuestion('WW_Q6', 'PRA_SLA', false)).toBe(false);
    });

    it('returns true for all questions when PRA/SLA is ON', () => {
      expect(shouldShowQuestion('W_Q6', 'PRA_SLA', true)).toBe(true);
      expect(shouldShowQuestion('W_Q7', 'PRA_SLA', true)).toBe(true);
      expect(shouldShowQuestion('W_Q1', 'BASELINE', true)).toBe(true);
    });

    it('returns true for questions with undefined scope when PRA/SLA is OFF', () => {
      expect(shouldShowQuestion('W_Q1', undefined, false)).toBe(true);
    });
  });

  describe('filterQuestionsByScope', () => {
    const testQuestions = [
      { id: 'W_Q1', scope: 'BASELINE' as const },
      { id: 'W_Q4', scope: 'BASELINE' as const },
      { id: 'W_Q6', scope: 'PRA_SLA' as const },
      { id: 'W_Q7', scope: 'PRA_SLA' as const },
      { id: 'W_Q8', scope: 'BASELINE' as const },
    ];

    it('excludes PRA_SLA questions when toggle is OFF', () => {
      const filtered = filterQuestionsByScope(testQuestions, false);
      const ids = filtered.map((q: { id: string }) => q.id);
      expect(ids).toEqual(['W_Q1', 'W_Q4', 'W_Q8']);
      expect(ids).not.toContain('W_Q6');
      expect(ids).not.toContain('W_Q7');
    });

    it('includes all questions when toggle is ON', () => {
      const filtered = filterQuestionsByScope(testQuestions, true);
      const ids = filtered.map((q: { id: string }) => q.id);
      expect(ids).toEqual(['W_Q1', 'W_Q4', 'W_Q6', 'W_Q7', 'W_Q8']);
    });
  });

  describe('isPraSlaQuestion', () => {
    it('identifies PRA/SLA questions correctly', () => {
      expect(isPraSlaQuestion('W_Q6')).toBe(true);
      expect(isPraSlaQuestion('W_Q7')).toBe(true);
      expect(isPraSlaQuestion('WW_Q6')).toBe(true);
      expect(isPraSlaQuestion('WW_Q7')).toBe(true);
    });

    it('returns false for non-PRA/SLA questions', () => {
      expect(isPraSlaQuestion('W_Q1')).toBe(false);
      expect(isPraSlaQuestion('W_Q4')).toBe(false);
      expect(isPraSlaQuestion('WW_Q1')).toBe(false);
    });
  });
});

describe('Vulnerability Generation with PRA/SLA Gating', () => {
  describe('Water themes', () => {
    it('excludes W_NO_PRIORITY_RESTORATION finding when PRA/SLA is OFF', () => {
      const input: ThemeResolverInput = {
        category: 'WATER',
        answers: {
          W_Q6_priority_restoration: 'no', // Would normally trigger finding
        },
        praSlaEnabled: false, // PRA/SLA toggle OFF
      };

      const findings = resolveWaterThemes(input);
      const hasW6Finding = findings.some((f: { id: string }) => f.id === 'W_NO_PRIORITY_RESTORATION');
      expect(hasW6Finding).toBe(false);
    });

    it('includes W_NO_PRIORITY_RESTORATION finding when PRA/SLA is ON', () => {
      const input: ThemeResolverInput = {
        category: 'WATER',
        answers: {
          W_Q6_priority_restoration: 'no',
        },
        praSlaEnabled: true, // PRA/SLA toggle ON
      };

      const findings = resolveWaterThemes(input);
      const w6Finding = findings.find((f: any) => f.id === 'W_NO_PRIORITY_RESTORATION');
      expect(w6Finding).toBeDefined();
      expect(w6Finding?.title).toBe('No priority restoration plan');
    });

  });

  describe('Wastewater themes', () => {
    it('excludes WW_NO_PRIORITY_RESTORATION finding when PRA/SLA is OFF', () => {
      const input: ThemeResolverInput = {
        category: 'WASTEWATER',
        answers: {
          WW_Q6_priority_restoration: 'no', // Would normally trigger finding
        },
       praSlaEnabled: false, // PRA/SLA toggle OFF
      };

      const findings = resolveWastewaterThemes(input);
      const hasWw6Finding = findings.some((f: { id: string }) => f.id === 'WW_NO_PRIORITY_RESTORATION');
      expect(hasWw6Finding).toBe(false);
    });

    it('includes WW_NO_PRIORITY_RESTORATION finding when PRA/SLA is ON', () => {
      const input: ThemeResolverInput = {
        category: 'WASTEWATER',
        answers: {
          WW_Q6_priority_restoration: 'no',
        },
        praSlaEnabled: true, // PRA/SLA toggle ON
      };

      const findings = resolveWastewaterThemes(input);
      const ww6Finding = findings.find((f: any) => f.id === 'WW_NO_PRIORITY_RESTORATION');
      expect(ww6Finding).toBeDefined();
      expect(ww6Finding?.title).toBe('No priority restoration plan');
    });

  });

  describe('Edge cases', () => {
    it('handles undefined praSlaEnabled as false (safe default)', () => {
      const input: ThemeResolverInput = {
        category: 'WATER',
        answers: {
          W_Q6_priority_restoration: 'no',
        },
        praSlaEnabled: undefined,
      };

      const findings = resolveWaterThemes(input);
      const w6Finding = findings.find((f: { id: string }) => f.id === 'W_NO_PRIORITY_RESTORATION');
      // undefined should not trigger W_Q6 finding (safe default)
      expect(w6Finding).toBeUndefined();
    });

    it('handles explicitly false praSlaEnabled', () => {
      const input: ThemeResolverInput = {
        category: 'WASTEWATER',
        answers: {
          WW_Q6_priority_restoration: 'no',
        },
        praSlaEnabled: false,
      };

      const findings = resolveWastewaterThemes(input);
      const ww6Finding = findings.find((f: { id: string }) => f.id === 'WW_NO_PRIORITY_RESTORATION');
      expect(ww6Finding).toBeUndefined();
    });

    it('handles explicitly true praSlaEnabled', () => {
      const input: ThemeResolverInput = {
        category: 'WATER',
        answers: {
          W_Q6_priority_restoration: 'no',
        },
        praSlaEnabled: true,
      };

      const findings = resolveWaterThemes(input);
      const w6Finding = findings.find((f: any) => f.id === 'W_NO_PRIORITY_RESTORATION');
      expect(w6Finding).toBeDefined();
    });
  });
});
