import { describe, it, expect } from 'vitest';
import type { Assessment } from 'schema';
import { buildReportVMForReviewAndExport } from './build_report_vm';
import { vmToDependencyPayload } from './vm_to_reporter_payload';
import { buildCanonicalVulnBlocks } from '@/app/lib/export/canonical_vuln_blocks';

const assessmentFixture: Assessment = {
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

function splitOfcs(text: string): string[] {
  return (text ?? '')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

describe('report payload parity', () => {
  it('keeps reporter vulnerability blocks aligned with canonical blocks for all rendered sectors', () => {
    const vm = buildReportVMForReviewAndExport(assessmentFixture);
    const payload = vmToDependencyPayload(vm);
    const { canonicalVulnBlocks } = buildCanonicalVulnBlocks(assessmentFixture);

    const expectedByDomain = new Map<string, Array<{ id: string; title: string; narrative: string; ofcs: string[] }>>();
    for (const block of canonicalVulnBlocks) {
      const list = expectedByDomain.get(block.domain) ?? [];
      list.push({
        id: block.vuln_id,
        title: block.title,
        narrative: block.narrative,
        ofcs: splitOfcs(block.ofcText),
      });
      expectedByDomain.set(block.domain, list);
    }

    const actualByDomain = new Map<string, Array<{ id: string; title: string; narrative: string; ofcs: string[] }>>();
    actualByDomain.set(
      'ELECTRIC_POWER',
      (payload.energy_dependency.vulnerability_blocks ?? []).map((b) => ({
        id: b.id ?? '',
        title: b.title,
        narrative: b.narrative,
        ofcs: (b.ofcs ?? []).map((o) => o.trim()).filter(Boolean),
      }))
    );
    for (const section of payload.dependency_sections ?? []) {
      actualByDomain.set(
        section.infraCode,
        (section.vulnerability_blocks ?? []).map((b) => ({
          id: b.id ?? '',
          title: b.title,
          narrative: b.narrative,
          ofcs: (b.ofcs ?? []).map((o) => o.trim()).filter(Boolean),
        }))
      );
    }

    expect(Array.from(actualByDomain.keys()).sort()).toEqual(Array.from(expectedByDomain.keys()).sort());
    for (const domain of expectedByDomain.keys()) {
      expect(actualByDomain.get(domain)).toEqual(expectedByDomain.get(domain));
    }
  });
});

