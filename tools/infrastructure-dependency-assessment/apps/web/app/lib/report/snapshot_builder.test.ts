/**
 * QA Tests for Executive Risk Posture Snapshot Builder
 * 
 * Validates:
 * - Snapshot drivers count matches input
 * - Infrastructure matrix length matches curve count
 * - Overall posture classification is deterministic
 * - Cascading indicator is only present when applicable
 * - No undefined fields
 */

import { describe, it, expect } from 'vitest';
import { buildExecutiveRiskPostureSnapshot } from './snapshot_builder';
import type { KeyRiskDriver, CurveSummary } from './view_model';

describe('Executive Risk Posture Snapshot Builder', () => {
  // Mock data
  const mockDrivers: KeyRiskDriver[] = [
    {
      title: 'Limited Upstream Awareness',
      severity: 'HIGH',
      infrastructures: ['ELECTRIC_POWER'],
      narrative:
        'Facility has no direct contacts for critical suppliers. Disruption scenarios assume discovery lag of 24–48 hours after service loss, delaying mitigation response.',
      _score: 6,
      _category: 'FOUNDATIONAL',
    },
    {
      title: 'Fast Time-to-Impact',
      severity: 'ELEVATED',
      infrastructures: ['COMMUNICATIONS'],
      narrative:
        'Loss of primary cellular service degrades facility operations within 4 hours. Backup landline capacity exists but requires manual activation.',
      _score: 5,
      _category: 'IMMEDIATE',
    },
    {
      title: 'Cross-Infrastructure Cascading',
      severity: 'ELEVATED',
      infrastructures: ['ELECTRIC_POWER', 'COMMUNICATIONS'],
      narrative:
        'Facility electric power and communications both depend on shared utility corridors. Localized damage (dig-in, storm) could sever both simultaneously.',
      _score: 5,
      _category: 'CASCADING',
    },
  ];

  const mockCurves: CurveSummary[] = [
    {
      infra: 'ELECTRIC_POWER',
      severity: 'IMMEDIATE',
      time_to_impact_hr: 1,
      loss_no_backup_pct: 95,
      backup_available: true,
      backup_duration_hr: 8,
      recovery_hr: 12,
    },
    {
      infra: 'COMMUNICATIONS',
      severity: 'SHORT_TERM',
      time_to_impact_hr: 4,
      loss_no_backup_pct: 85,
      backup_available: true,
      backup_duration_hr: 4,
      recovery_hr: 24,
    },
    {
      infra: 'INFORMATION_TECHNOLOGY',
      severity: 'DELAYED',
      time_to_impact_hr: 12,
      loss_no_backup_pct: 50,
      backup_available: false,
      recovery_hr: 36,
    },
    {
      infra: 'WATER',
      severity: 'STRATEGIC',
      time_to_impact_hr: 48,
      loss_no_backup_pct: 20,
      backup_available: false,
      recovery_hr: 72,
    },
    {
      infra: 'WASTEWATER',
      severity: 'STRATEGIC',
      time_to_impact_hr: 72,
      loss_no_backup_pct: 15,
      backup_available: false,
      recovery_hr: 96,
    },
  ];

  describe('Driver Count Validation', () => {
    it('should have same number of drivers as input', () => {
      const snapshot = buildExecutiveRiskPostureSnapshot({
        keyRiskDrivers: mockDrivers,
        infraCurves: mockCurves,
      });

      expect(snapshot.drivers.length).toBe(mockDrivers.length);
    });

    it('should preserve driver order (no re-sorting)', () => {
      const snapshot = buildExecutiveRiskPostureSnapshot({
        keyRiskDrivers: mockDrivers,
        infraCurves: mockCurves,
      });

      snapshot.drivers.forEach((snapshotDriver, idx) => {
        expect(snapshotDriver.title).toBe(mockDrivers[idx].title);
        expect(snapshotDriver.severity).toBe(mockDrivers[idx].severity);
      });
    });
  });

  describe('Infrastructure Matrix Validation', () => {
    it('should have matrix row for each curve', () => {
      const snapshot = buildExecutiveRiskPostureSnapshot({
        keyRiskDrivers: mockDrivers,
        infraCurves: mockCurves,
      });

      expect(snapshot.infraMatrix.length).toBe(mockCurves.length);
    });

    it('should map time-to-impact correctly', () => {
      const snapshot = buildExecutiveRiskPostureSnapshot({
        keyRiskDrivers: mockDrivers,
        infraCurves: mockCurves,
      });

      const powerRow = snapshot.infraMatrix.find((r) => r.infra === 'ELECTRIC_POWER');
      expect(powerRow?.impactSensitivity).toBe('Immediate'); // 1 hr <= 2

      const commRow = snapshot.infraMatrix.find((r) => r.infra === 'COMMUNICATIONS');
      expect(commRow?.impactSensitivity).toBe('Near-term'); // 4 hrs in 2-8 range

      const waterRow = snapshot.infraMatrix.find((r) => r.infra === 'WATER');
      expect(waterRow?.impactSensitivity).toBe('Tolerant'); // 48 hrs > 8
    });

    it('should map backup duration correctly', () => {
      const snapshot = buildExecutiveRiskPostureSnapshot({
        keyRiskDrivers: mockDrivers,
        infraCurves: mockCurves,
      });

      const itRow = snapshot.infraMatrix.find((r) => r.infra === 'INFORMATION_TECHNOLOGY');
      expect(itRow?.mitigationDepth).toBe('None'); // No backup

      const powerRow = snapshot.infraMatrix.find((r) => r.infra === 'ELECTRIC_POWER');
      expect(powerRow?.mitigationDepth).toBe('Moderate'); // 8 hrs

      const commRow = snapshot.infraMatrix.find((r) => r.infra === 'COMMUNICATIONS');
      expect(commRow?.mitigationDepth).toBe('Limited'); // 4 hrs < 8
    });

    it('should map recovery time correctly', () => {
      const snapshot = buildExecutiveRiskPostureSnapshot({
        keyRiskDrivers: mockDrivers,
        infraCurves: mockCurves,
      });

      const powerRow = snapshot.infraMatrix.find((r) => r.infra === 'ELECTRIC_POWER');
      expect(powerRow?.recoverySensitivity).toBe('Managed'); // 12 hrs: > 8 and < 24

      const commRow = snapshot.infraMatrix.find((r) => r.infra === 'COMMUNICATIONS');
      expect(commRow?.recoverySensitivity).toBe('Extended'); // 24 hrs: >= 24

      const waterRow = snapshot.infraMatrix.find((r) => r.infra === 'WATER');
      expect(waterRow?.recoverySensitivity).toBe('Extended'); // 72 hrs: >= 24
    });
  });

  describe('Posture Classification', () => {
    it('should classify as Elevated Structural Sensitivity if any HIGH driver', () => {
      const snapshot = buildExecutiveRiskPostureSnapshot({
        keyRiskDrivers: mockDrivers,
        infraCurves: mockCurves,
      });

      expect(snapshot.overallPosture).toBe('Elevated Structural Sensitivity');
    });

    it('should classify as Moderate Operational Sensitivity if majority ELEVATED', () => {
      const drivers: KeyRiskDriver[] = [
        {
          title: 'Driver 1',
          severity: 'ELEVATED',
          infrastructures: ['ELECTRIC_POWER'],
          narrative: 'Test narrative.',
          _category: 'IMMEDIATE',
        },
        {
          title: 'Driver 2',
          severity: 'ELEVATED',
          infrastructures: ['COMMUNICATIONS'],
          narrative: 'Test narrative.',
          _category: 'MITIGATION_LIMIT',
        },
        {
          title: 'Driver 3',
          severity: 'MODERATE',
          infrastructures: ['WATER'],
          narrative: 'Test narrative.',
          _category: 'PROVIDER_CONCENTRATION',
        },
      ];

      const snapshot = buildExecutiveRiskPostureSnapshot({
        keyRiskDrivers: drivers,
        infraCurves: mockCurves.slice(0, 3),
      });

      expect(snapshot.overallPosture).toBe('Moderate Operational Sensitivity');
    });

    it('should classify as Localized Sensitivity for all MODERATE', () => {
      const drivers: KeyRiskDriver[] = [
        {
          title: 'Driver 1',
          severity: 'MODERATE',
          infrastructures: ['ELECTRIC_POWER'],
          narrative: 'Test narrative.',
          _category: 'PROVIDER_CONCENTRATION',
        },
      ];

      const snapshot = buildExecutiveRiskPostureSnapshot({
        keyRiskDrivers: drivers,
        infraCurves: mockCurves.slice(0, 1),
      });

      expect(snapshot.overallPosture).toBe('Localized Sensitivity');
    });

    it('should handle empty drivers gracefully', () => {
      const snapshot = buildExecutiveRiskPostureSnapshot({
        keyRiskDrivers: [],
        infraCurves: mockCurves,
      });

      expect(snapshot.overallPosture).toBe('Localized Sensitivity');
      expect(snapshot.drivers.length).toBe(0);
    });
  });

  describe('Cascading Indicator', () => {
    it('should include cascading indicator for CASCADING driver', () => {
      const snapshot = buildExecutiveRiskPostureSnapshot({
        keyRiskDrivers: mockDrivers,
        infraCurves: mockCurves,
      });

      expect(snapshot.cascadingIndicator).toBeDefined();
      expect(snapshot.cascadingIndicator?.summary).toContain('2 infrastructure systems');
    });

    it('should omit cascading indicator if no CASCADING driver', () => {
      const drivers = mockDrivers.filter((d) => d._category !== 'CASCADING');

      const snapshot = buildExecutiveRiskPostureSnapshot({
        keyRiskDrivers: drivers,
        infraCurves: mockCurves,
      });

      expect(snapshot.cascadingIndicator).toBeUndefined();
    });
  });

  describe('Deterministic Output', () => {
    it('should produce identical snapshot for identical input', () => {
      const snapshot1 = buildExecutiveRiskPostureSnapshot({
        keyRiskDrivers: mockDrivers,
        infraCurves: mockCurves,
      });

      const snapshot2 = buildExecutiveRiskPostureSnapshot({
        keyRiskDrivers: mockDrivers,
        infraCurves: mockCurves,
      });

      expect(JSON.stringify(snapshot1)).toBe(JSON.stringify(snapshot2));
    });

    it('should have no undefined fields', () => {
      const snapshot = buildExecutiveRiskPostureSnapshot({
        keyRiskDrivers: mockDrivers,
        infraCurves: mockCurves,
      });

      expect(snapshot.overallPosture).toBeDefined();
      expect(snapshot.overallPosture).not.toBe('');
      expect(snapshot.drivers).toBeDefined();
      expect(snapshot.infraMatrix).toBeDefined();

      snapshot.drivers.forEach((driver) => {
        expect(driver.title).toBeDefined();
        expect(driver.severity).toBeDefined();
        expect(driver.infrastructures).toBeDefined();
        expect(driver.shortSummary).toBeDefined();
      });

      snapshot.infraMatrix.forEach((row) => {
        expect(row.infra).toBeDefined();
        expect(row.impactSensitivity).toBeDefined();
        expect(row.mitigationDepth).toBeDefined();
        expect(row.recoverySensitivity).toBeDefined();
        expect(row.cascadeExposure).toBeDefined();
      });
    });
  });

  describe('Short Summary Extraction', () => {
    it('should extract first sentence from narrative', () => {
      const snapshot = buildExecutiveRiskPostureSnapshot({
        keyRiskDrivers: mockDrivers,
        infraCurves: mockCurves,
      });

      const foundationalDriver = snapshot.drivers.find(
        (d) => d.title === 'Limited Upstream Awareness'
      );
      expect(foundationalDriver?.shortSummary).toContain('no direct contacts');
      expect(foundationalDriver?.shortSummary).not.toContain('Disruption scenarios');
    });
  });
});
