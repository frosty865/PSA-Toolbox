/**
 * Tests for vmToReporterPayload (vmToExecutiveSnapshot, vmToSynthesis, vmToDependencyPayload).
 */
import { describe, it, expect } from 'vitest';
import { buildReportVMForReviewAndExport } from './build_report_vm';
import {
  vmToExecutiveSnapshot,
  vmToSynthesis,
  vmToDependencyPayload,
} from './vm_to_reporter_payload';
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
      'E-2': 'yes',
      'E-3_more_than_one_connection': 'no',
      'E-8_backup_available': 'no',
      'E-11_provider_restoration_coordination': 'yes',
    } as Record<string, unknown>,
  } as Assessment['categories'],
} as Assessment;

const comprehensiveAssessment: Assessment = {
  meta: { created_at_iso: new Date().toISOString() },
  categories: {
    ELECTRIC_POWER: {
      curve_requires_service: true,
      curve_time_to_impact_hours: 1,
      curve_loss_fraction_no_backup: 0.95,
      curve_backup_available: false,
      curve_recovery_time_hours: 1,
      'E-3_more_than_one_connection': 'no',
    } as Record<string, unknown>,
    COMMUNICATIONS: {
      curve_requires_service: true,
      curve_time_to_impact_hours: 0,
      curve_loss_fraction_no_backup: 1,
      curve_backup_available: false,
      curve_recovery_time_hours: 0.25,
      comm_single_point_voice_failure: 'yes',
      comm_restoration_coordination: 'no',
      comm_interoperability: 'no',
    } as Record<string, unknown>,
    INFORMATION_TECHNOLOGY: {
      curve_requires_service: true,
      curve_time_to_impact_hours: 1,
      curve_loss_fraction_no_backup: 0.75,
      curve_backup_available: false,
      curve_recovery_time_hours: 1,
      it_transport_resilience: {
        transport_connection_count: 2,
        transport_building_entry_diversity: 'SAME_ENTRY',
        transport_route_independence: 'UNKNOWN',
        transport_failover_mode: 'UNKNOWN',
      },
      it_hosted_resilience: {
        aws: { survivability: 'NO_CONTINUITY' },
      },
      'IT-2_upstream_assets': [{ service_id: 'aws' }],
    } as Record<string, unknown>,
    WATER: {
      curve_requires_service: true,
      curve_time_to_impact_hours: 4,
      curve_loss_fraction_no_backup: 1,
      curve_backup_available: false,
      curve_recovery_time_hours: 1,
      W_Q2_connection_count: 1,
    } as Record<string, unknown>,
    WASTEWATER: {
      curve_requires_service: true,
      curve_time_to_impact_hours: 4,
      curve_loss_fraction_no_backup: 1,
      curve_backup_available: false,
      curve_recovery_time_hours: 1,
      WW_Q2_connection_count: 1,
    } as Record<string, unknown>,
  } as Assessment['categories'],
} as Assessment;

describe('vmToReporterPayload', () => {
  it('vmToExecutiveSnapshot produces valid reporter format', () => {
    const vm = buildReportVMForReviewAndExport(minimalAssessment);
    const snapshot = vmToExecutiveSnapshot(vm);

    expect(snapshot).toBeDefined();
    expect(typeof snapshot.posture).toBe('string');
    expect(typeof snapshot.summary).toBe('string');
    expect(Array.isArray(snapshot.drivers)).toBe(true);
    expect(Array.isArray(snapshot.matrixRows)).toBe(true);
    expect(snapshot.cascade === null || typeof snapshot.cascade === 'string').toBe(true);
  });

  it('vmToSynthesis produces valid reporter format', () => {
    const vm = buildReportVMForReviewAndExport(minimalAssessment);
    const synthesis = vmToSynthesis(vm);

    expect(synthesis).toBeDefined();
    expect(typeof synthesis.title).toBe('string');
    expect(Array.isArray(synthesis.paragraphs)).toBe(true);
    expect(Array.isArray(synthesis.bullets)).toBe(true);
  });

  it('matrixRows have required fields', () => {
    const vm = buildReportVMForReviewAndExport(minimalAssessment);
    const snapshot = vmToExecutiveSnapshot(vm);

    for (const row of snapshot.matrixRows) {
      expect(row).toHaveProperty('sector');
      expect(row).toHaveProperty('ttiHrs');
      expect(row).toHaveProperty('lossPct');
      expect(row).toHaveProperty('backupHrs');
      expect(row).toHaveProperty('structuralPosture');
    }
  });

  it('vm_emits_single_vulnerability_source', () => {
    const vm = buildReportVMForReviewAndExport(comprehensiveAssessment);
    const { energy_dependency, dependency_sections, vulnerability_index_rows } =
      vmToDependencyPayload(vm);

    expect(energy_dependency).toBeDefined();
    expect(energy_dependency.vulnerability_blocks).toBeDefined();
    expect(Array.isArray(energy_dependency.vulnerability_blocks)).toBe(true);
    expect(dependency_sections).toBeDefined();
    expect(Array.isArray(dependency_sections)).toBe(true);
    expect(vulnerability_index_rows).toBeDefined();
    expect(Array.isArray(vulnerability_index_rows)).toBe(true);

    for (const section of dependency_sections) {
      expect(section).toHaveProperty('vulnerability_blocks');
      expect(Array.isArray(section.vulnerability_blocks)).toBe(true);
    }
    expect(energy_dependency).not.toHaveProperty('structuralFindingsText');
    expect(energy_dependency).not.toHaveProperty('findingsNarrative');
    expect(energy_dependency).not.toHaveProperty('findingBullets');
  });

  it('throws when a rendered sector has zero vulnerability blocks', () => {
    const vm = buildReportVMForReviewAndExport(minimalAssessment);
    expect(() => vmToDependencyPayload(vm)).toThrow(/Missing vulnerability blocks/);
  });
});
