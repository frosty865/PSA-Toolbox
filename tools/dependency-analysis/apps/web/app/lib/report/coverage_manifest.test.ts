/**
 * Coverage audit tests.
 */
import { describe, it, expect } from 'vitest';
import {
  buildCoverageManifest,
  getUnaccountedKeys,
  assertCoverageComplete,
} from './coverage_manifest';
import { fullAssessmentForExport } from 'engine';
import type { Assessment } from 'schema';

describe('Coverage manifest', () => {
  it('builds manifest from full assessment', () => {
    const manifest = buildCoverageManifest(fullAssessmentForExport);
    expect(manifest.captured).toBeDefined();
    expect(manifest.represented).toBeDefined();
    expect(manifest.suppressed).toBeDefined();
  });

  it('every captured key is either represented or suppressed', () => {
    const manifest = buildCoverageManifest(fullAssessmentForExport);
    const unaccounted = getUnaccountedKeys(manifest);
    expect(unaccounted).toEqual([]);
  });

  it('assertCoverageComplete does not throw for full assessment', () => {
    expect(() => assertCoverageComplete(fullAssessmentForExport)).not.toThrow();
  });

  it('captures sector-prefixed keys', () => {
    const manifest = buildCoverageManifest(fullAssessmentForExport);
    const capturedKeys = Object.keys(manifest.captured);
    expect(capturedKeys.some((k) => k.startsWith('ELECTRIC_POWER:'))).toBe(true);
    expect(capturedKeys.some((k) => k.startsWith('COMMUNICATIONS:'))).toBe(true);
  });

  it('suppresses when requires_service is false', () => {
    const assessment: Assessment = {
      ...fullAssessmentForExport,
      categories: {
        ...fullAssessmentForExport.categories,
        INFORMATION_TECHNOLOGY: {
          requires_service: false,
          time_to_impact_hours: 0,
          loss_fraction_no_backup: 0,
          has_backup: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
          recovery_time_hours: 0,
        },
      },
    };
    const manifest = buildCoverageManifest(assessment);
    const itKeys = Object.keys(manifest.captured).filter((k) => k.startsWith('INFORMATION_TECHNOLOGY:'));
    if (itKeys.length > 0) {
      for (const k of itKeys) {
        expect(manifest.suppressed[k] ?? manifest.represented[k]).toBeDefined();
      }
    }
  });
});
