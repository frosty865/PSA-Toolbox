/** Tests for buildPart2ForReport: Part II vulnerabilities are canonical-only (no fallback). */
import { describe, it, expect } from 'vitest';
import { buildPart2ForReport, type Part2Vulnerability } from './build_part2_for_report';
import type { Assessment } from 'schema';
import type { ReportVM } from '@/app/lib/report/view_model';
import { getDefaultAssessment } from '@/lib/default-assessment';

const minimalReportVM = {
  infrastructures: [
    {
      code: 'ELECTRIC_POWER',
      display_name: 'Electric Power',
      vulnerabilities: [
        {
          id: 'vm-v1',
          title: 'VM-based vulnerability title',
          summary: 'VM-based narrative.',
          ofcs: [],
        },
      ],
      curve: undefined,
      intro: { purpose: '' },
      sensitivity_summary: '',
      external_services: undefined,
      cascade_narrative: undefined,
    },
  ],
  executive: undefined,
  synthesis: undefined,
  vuln_grouping_mode: 'by_driver',
} as unknown as ReportVM;

function makeAssessment(overrides?: Partial<Assessment['categories']>): Assessment {
  const base = getDefaultAssessment();
  if (overrides) {
    base.categories = { ...base.categories, ...overrides };
  }
  return base;
}

describe('buildPart2ForReport', () => {
  it('prefers canonicalVulnBlocks when provided', () => {
    const assessment = makeAssessment({ ELECTRIC_POWER: { requires_service: true } as Assessment['categories']['ELECTRIC_POWER'] });

    const part2 = buildPart2ForReport(minimalReportVM, assessment, [
      {
        domain: 'ELECTRIC_POWER',
        vuln_id: 'EP-CANON-1',
        title: 'Canonical vulnerability title',
        narrative: 'Canonical narrative.',
        severity: 'HIGH',
        ofcText: 'Canonical OFC 1\nCanonical OFC 2',
        references: [' Example Standard - https://example.org/std ', '', 'example standard - https://example.org/std'],
      },
    ]);

    expect(part2.vulnerabilities.length).toBe(1);
    const first = part2.vulnerabilities[0] as Part2Vulnerability;
    expect(first.id).toBe('EP-CANON-1');
    expect(first.title).toBe('Canonical vulnerability title');
    expect(first.narrative).toBe('Canonical narrative.');
    expect(first.ofcs).toEqual(['Canonical OFC 1', 'Canonical OFC 2']);
    expect(first.references).toEqual(['Example Standard - https://example.org/std']);
    expect(first.severity).toBe('HIGH');
    expect(first.title).not.toBe('VM-based vulnerability title');
  });

  it('does not use report_themed_findings fallback when canonical blocks are not provided', () => {
    const assessment = makeAssessment({
      ELECTRIC_POWER: {
        requires_service: true,
        report_themed_findings: [
          {
            id: 'tf-1',
            domain: 'ELECTRIC_POWER',
            severity: 'ELEVATED',
            title: 'Themed finding title',
            narrative: 'Themed narrative for in-app Summary.',
            ofcText: 'OFC one\nOFC two',
          },
        ],
      } as unknown as Assessment['categories']['ELECTRIC_POWER'],
    });

    const part2 = buildPart2ForReport(minimalReportVM, assessment);

    expect(part2.vulnerabilities).toEqual([]);
  });

  it('does not use VM fallback when canonical blocks are not provided', () => {
    const assessment = makeAssessment({ ELECTRIC_POWER: { requires_service: true } as Assessment['categories']['ELECTRIC_POWER'] });

    const part2 = buildPart2ForReport(minimalReportVM, assessment);

    expect(part2.vulnerabilities).toEqual([]);
  });

  it('builds internet_transport_rows with demarcation, independence, notes from IT supply.sources', () => {
    const assessment = makeAssessment({
      INFORMATION_TECHNOLOGY: {
        curve_primary_provider: 'Verizon',
        curve_secondary_provider: 'Xfinity',
        supply: {
          sources: [
            {
              provider_name: 'Verizon',
              demarcation_description: 'Main IDF, Room 101',
              independence: 'Diverse path',
              notes: 'Primary circuit',
            },
            {
              provider_name: 'Xfinity',
              demarcation_lat: 39.1,
              demarcation_lon: -77.2,
              independence: 'Secondary',
              notes: '',
            },
          ],
        },
      } as unknown as Assessment['categories']['INFORMATION_TECHNOLOGY'],
    });

    const part2 = buildPart2ForReport(minimalReportVM, assessment);

    expect(part2.internet_transport_rows).toBeDefined();
    expect(part2.internet_transport_rows.length).toBe(2);

    const primary = part2.internet_transport_rows.find((r) => r.role === 'Primary Internet Provider');
    expect(primary).toBeDefined();
    expect(primary!.provider).toBe('Verizon');
    expect(primary!.demarcation).toBe('Main IDF, Room 101');
    expect(primary!.independence).toBe('Diverse path');
    expect(primary!.notes).toBe('Primary circuit');

    const secondary = part2.internet_transport_rows.find((r) => r.role === 'Secondary Internet Provider');
    expect(secondary).toBeDefined();
    expect(secondary!.provider).toBe('Xfinity');
    expect(secondary!.demarcation).toContain('39.1');
    expect(secondary!.demarcation).toContain('-77.2');
    expect(secondary!.independence).toBe('Secondary');
    expect(secondary!.notes).toBe('Reported sources: 1');
  });

  it('uses fallback matching/index and IT-4 service connections when provider labels differ', () => {
    const assessment = makeAssessment({
      INFORMATION_TECHNOLOGY: {
        curve_primary_provider: 'Verizon',
        curve_secondary_provider: 'Xfinity',
        'IT-4_physically_separated': 'yes',
        'IT-4_service_connections': [
          { connection_label: 'Primary', associated_provider: 'Verizon Business', facility_entry_location: 'North MPOE', shared_corridor_with_other_utilities: 'no' },
          { connection_label: 'Secondary', associated_provider: 'Xfinity Enterprise', facility_entry_location: 'South MPOE', shared_corridor_with_other_utilities: 'no' },
        ],
        supply: {
          sources: [
            { provider_name: 'Verizon Business', demarcation_description: '', independence: 'CONFIRMED', notes: '' },
            { provider_name: 'Xfinity Enterprise', demarcation_description: '', independence: 'CONFIRMED', notes: '' },
          ],
        },
      } as unknown as Assessment['categories']['INFORMATION_TECHNOLOGY'],
    });

    const part2 = buildPart2ForReport(minimalReportVM, assessment);
    const primary = part2.internet_transport_rows.find((r) => r.role === 'Primary Internet Provider');
    const secondary = part2.internet_transport_rows.find((r) => r.role === 'Secondary Internet Provider');
    expect(primary?.demarcation).toBe('North MPOE');
    expect(primary?.independence).toBe('Confirmed');
    expect(secondary?.demarcation).toBe('South MPOE');
    expect(secondary?.independence).toBe('Confirmed');
  });

  it('reads internet transport demarcation/independence from INFORMATION_TECHNOLOGY.answers payload', () => {
    const assessment = makeAssessment({
      INFORMATION_TECHNOLOGY: {
        answers: {
          curve_primary_provider: 'Verizon',
          curve_secondary_provider: 'Xfinity',
          supply: {
            sources: [
              {
                provider_name: 'Verizon',
                demarcation_description: 'Main IDF, Room 101',
                independence: 'DIFFERENT_LOOP_OR_PATH',
                notes: 'Primary circuit',
              },
              {
                provider_name: 'Xfinity',
                demarcation_description: 'South MPOE',
                independence: 'CONFIRMED',
                notes: '',
              },
            ],
          },
          it_transport_resilience: {
            transport_route_independence: 'UNKNOWN',
          },
        },
      } as unknown as Assessment['categories']['INFORMATION_TECHNOLOGY'],
    });

    const part2 = buildPart2ForReport(minimalReportVM, assessment);
    const primary = part2.internet_transport_rows.find((r) => r.role === 'Primary Internet Provider');
    const secondary = part2.internet_transport_rows.find((r) => r.role === 'Secondary Internet Provider');
    expect(primary?.demarcation).toBe('Main IDF, Room 101');
    expect(primary?.independence).toBe('Different loop or path');
    expect(primary?.notes).toBe('Primary circuit');
    expect(secondary?.demarcation).toBe('South MPOE');
    expect(secondary?.independence).toBe('Confirmed');
  });

  it('maps boolean IT-4_physically_separated=false to not physically separated fallback', () => {
    const assessment = makeAssessment({
      INFORMATION_TECHNOLOGY: {
        curve_primary_provider: 'Verizon',
        curve_secondary_provider: 'Xfinity',
        'IT-4_physically_separated': false,
      } as unknown as Assessment['categories']['INFORMATION_TECHNOLOGY'],
    });

    const part2 = buildPart2ForReport(minimalReportVM, assessment);
    const primary = part2.internet_transport_rows.find((r) => r.role === 'Primary Internet Provider');
    const secondary = part2.internet_transport_rows.find((r) => r.role === 'Secondary Internet Provider');
    expect(primary?.demarcation).toBe('Shared facility entry (not physically separated)');
    expect(primary?.independence).toBe('Not physically separated');
    expect(secondary?.demarcation).toBe('Shared facility entry (not physically separated)');
    expect(secondary?.independence).toBe('Not physically separated');
  });
});
