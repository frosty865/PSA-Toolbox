/**
 * Citation Validation Tests
 * 
 * Tests for citation validation and source_key enforcement.
 */

import { validateCitations, validateCitation } from '../validation';
import { guardOFCRequiresCitations, guardCitationsNotEmpty } from '../guards';

// Mock the database pool for guards
jest.mock('@/app/lib/db/runtime_client', () => ({
  getRuntimePool: jest.fn(() => ({
    query: jest.fn((query: string, params: unknown[]) => {
      // Mock: only CISA_SECURITY_CONVERGENCE_2024 exists
      if (query.includes('source_registry') && params.includes('CISA_SECURITY_CONVERGENCE_2024')) {
        return Promise.resolve({ rows: [{ source_key: 'CISA_SECURITY_CONVERGENCE_2024' }] });
      }
      if (query.includes('source_registry') && params.includes('UNKNOWN_SOURCE')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    })
  }))
}));

describe('Citation Validation', () => {
  describe('validateCitation', () => {
    it('should accept valid citation', () => {
      const citation = {
        source_key: 'CISA_SECURITY_CONVERGENCE_2024',
        locator_type: 'page',
        locator: 'p.12',
        excerpt: 'Short excerpt'
      };
      const result = validateCitation(citation);
      expect(result.valid).toBe(true);
    });

    it('should reject citation without source_key', () => {
      const citation = {
        locator_type: 'page',
        locator: 'p.12',
        excerpt: 'Short excerpt'
      };
      const result = validateCitation(citation);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('source_key');
    });

    it('should reject citation with invalid locator_type', () => {
      const citation = {
        source_key: 'CISA_SECURITY_CONVERGENCE_2024',
        locator_type: 'invalid',
        locator: 'p.12',
        excerpt: 'Short excerpt'
      };
      const result = validateCitation(citation);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('locator_type');
    });
  });

  describe('validateCitations', () => {
    it('should reject empty citations array', () => {
      const result = validateCitations([]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least one citation');
    });

    it('should accept valid citations array', () => {
      const citations = [
        {
          source_key: 'CISA_SECURITY_CONVERGENCE_2024',
          locator_type: 'page',
          locator: 'p.12',
          excerpt: 'Short excerpt'
        }
      ];
      const result = validateCitations(citations);
      expect(result.valid).toBe(true);
    });
  });

  describe('guardCitationsNotEmpty', () => {
    it('should reject empty citations', () => {
      const result = guardCitationsNotEmpty([]);
      expect(result.valid).toBe(false);
    });

    it('should accept non-empty citations', () => {
      const result = guardCitationsNotEmpty([{ source_key: 'TEST' }]);
      expect(result.valid).toBe(true);
    });
  });

  describe('guardOFCRequiresCitations', () => {
    it('should reject OFC with unknown source_key', async () => {
      const citations = [
        {
          source_key: 'UNKNOWN_SOURCE',
          locator_type: 'page',
          locator: 'p.12',
          excerpt: 'Short excerpt'
        }
      ];
      const result = await guardOFCRequiresCitations(citations);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('unknown source_keys');
    });

    it('should accept OFC with valid source_key', async () => {
      const citations = [
        {
          source_key: 'CISA_SECURITY_CONVERGENCE_2024',
          locator_type: 'page',
          locator: 'p.12',
          excerpt: 'Short excerpt'
        }
      ];
      const result = await guardOFCRequiresCitations(citations);
      expect(result.valid).toBe(true);
    });
  });
});
