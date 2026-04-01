/**
 * Unit tests for catalog validation.
 * Ensures forbidden verbs are caught in ALL text fields:
 * - vulnerability title/description
 * - consideration heading/title/narrative/paragraphs
 * - VulnTemplate title/summary
 * - each OFC title/text
 */

import { describe, it, expect } from 'vitest';
import {
  validateCatalog,
  validateQuestionVulnMap,
  findForbiddenVerb,
  FORBIDDEN_VERBS,
} from './validate_catalog';

describe('validate_catalog', () => {
  describe('findForbiddenVerb', () => {
    it('returns null for clean text', () => {
      expect(findForbiddenVerb('Consider options to improve geographic separation.')).toBeNull();
      expect(findForbiddenVerb('')).toBeNull();
    });

    it('catches forbidden verbs in text', () => {
      expect(findForbiddenVerb('You must establish a backup.')).toBe('must');
      expect(findForbiddenVerb('Establish a redundant voice method.')).toBe('establish');
      expect(findForbiddenVerb('You should implement this.')).toBe('should');
    });

    it('checks all FORBIDDEN_VERBS', () => {
      for (const verb of FORBIDDEN_VERBS) {
        expect(findForbiddenVerb(`Some text with ${verb} in it.`)).toBe(verb);
      }
    });
  });

  describe('validateCatalog', () => {
    it('passes with no unknown question IDs or forbidden verbs', () => {
      const result = validateCatalog();
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('checks vulnerability short_name and description for forbidden verbs', () => {
      const result = validateCatalog();
      expect(result.errors.filter((e) => e.includes('Forbidden verb'))).toHaveLength(0);
    });

    it('checks consideration heading, narrative, and paragraphs for forbidden verbs', () => {
      const result = validateCatalog();
      expect(result.errors.filter((e) => e.includes('consideration'))).toHaveLength(0);
    });
  });

  describe('validateQuestionVulnMap', () => {
    it('passes with no forbidden verbs in VulnTemplate or OFCs', () => {
      const result = validateQuestionVulnMap();
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('checks VulnTemplate title and summary for forbidden verbs', () => {
      const result = validateQuestionVulnMap();
      expect(result.errors.filter((e) => e.includes('VulnTemplate'))).toHaveLength(0);
    });

    it('checks each OFC title and text for forbidden verbs', () => {
      const result = validateQuestionVulnMap();
      expect(result.errors.filter((e) => e.includes('OFC'))).toHaveLength(0);
    });
  });
});
