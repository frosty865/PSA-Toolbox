import { describe, it, expect } from 'vitest';
import { buildReportVM } from '../view_model';

type Dependencies = Record<string, Record<string, unknown>>;

type InfraCode = 'COMMUNICATIONS' | 'INFORMATION_TECHNOLOGY';

type ReportSection = {
  code: string;
  findings?: Array<{ narrative: string }>;
  analytical_considerations?: Array<{ narrative: string }>;
};

const COMM_FORBIDDEN = ['internet', 'isp', 'wan', 'sd-wan', 'broadband', 'data circuit'];
const IT_FORBIDDEN = ['pri', 'sip trunk', 'analog line', 'dispatch line', 'radio', 'p25', 'lmrs'];

function makeAssessment(dependencies: Dependencies) {
  return {
    meta: { facility_name: 'Test Facility' },
    asset: { asset_name: 'Test Facility' },
    categories: dependencies,
    dependencies,
  } as any;
}

function getSection(report: { infrastructures: ReportSection[] }, code: InfraCode): ReportSection {
  const section = report.infrastructures.find((infra) => infra.code === code);
  if (!section) {
    throw new Error(`Missing section for ${code}`);
  }
  return section;
}

function collectNarratives(section: ReportSection): string {
  const findingText = section.findings?.map((finding) => finding.narrative) ?? [];
  const considerationText = section.analytical_considerations?.map((c) => c.narrative) ?? [];
  return [...findingText, ...considerationText].join(' ').toLowerCase();
}

function containsForbidden(haystack: string, forbidden: string[]): string | null {
  for (const term of forbidden) {
    // Word-boundary match: "pri" must not match "priority", "sd-wan" must match "sd-wan" not "sd-wan-based"
    const re = new RegExp(`\\b${escapeRegex(term)}\\b`, 'i');
    if (re.test(haystack)) {
      return term;
    }
  }
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('Transport separation guards', () => {
  it('voice-only -> IT shows zero findings/drivers', () => {
    const report = buildReportVM(
      makeAssessment({
        COMMUNICATIONS: { 'CO-1': false },
        INFORMATION_TECHNOLOGY: {},
      })
    );
    const itSection = getSection(report, 'INFORMATION_TECHNOLOGY');
    expect(itSection.findings?.length ?? 0).toBe(0);
    const hasItDriver = report.executive.key_risk_drivers.some((d: any) =>
      d.infrastructures.includes('INFORMATION_TECHNOLOGY')
    );
    expect(hasItDriver).toBe(false);
  });

  it('data-only -> COMMUNICATIONS shows zero findings/drivers', () => {
    const report = buildReportVM(
      makeAssessment({
        COMMUNICATIONS: {},
        INFORMATION_TECHNOLOGY: { 'IT-1': false },
      })
    );
    const commsSection = getSection(report, 'COMMUNICATIONS');
    expect(commsSection.findings?.length ?? 0).toBe(0);
    const hasCommsDriver = report.executive.key_risk_drivers.some((d: any) =>
      d.infrastructures.includes('COMMUNICATIONS')
    );
    expect(hasCommsDriver).toBe(false);
  });

  it('VoIP mixed -> both show findings, no forbidden terms', () => {
    const report = buildReportVM(
      makeAssessment({
        COMMUNICATIONS: {
          curve_requires_service: true,
          curve_backup_available: false,
          'CO-1': 'NO',
        },
        INFORMATION_TECHNOLOGY: {
          curve_requires_service: true,
          'IT-1': 'NO',
        },
      })
    );
    const commsSection = getSection(report, 'COMMUNICATIONS');
    const itSection = getSection(report, 'INFORMATION_TECHNOLOGY');
    expect(commsSection.findings?.length ?? 0).toBeGreaterThan(0);
    expect(itSection.findings?.length ?? 0).toBeGreaterThan(0);

    const commsText = collectNarratives(commsSection);
    const itText = collectNarratives(itSection);

    expect(containsForbidden(commsText, COMM_FORBIDDEN)).toBeNull();
    expect(containsForbidden(itText, IT_FORBIDDEN)).toBeNull();
  });

  it('same-carrier mixed -> no blended driver categories', () => {
    const report = buildReportVM(
      makeAssessment({
        COMMUNICATIONS: {
          curve_requires_service: true,
          'CO-3': 1,
        },
        INFORMATION_TECHNOLOGY: {
          curve_requires_service: true,
          'IT-3': true,
        },
      })
    );
    const commsSection = getSection(report, 'COMMUNICATIONS');
    const itSection = getSection(report, 'INFORMATION_TECHNOLOGY');
    expect(commsSection.findings?.length ?? 0).toBeGreaterThan(0);
    expect(itSection.findings?.length ?? 0).toBeGreaterThan(0);

    const blended = report.executive.key_risk_drivers.filter(
      (d: any) =>
        d.infrastructures.includes('COMMUNICATIONS') &&
        d.infrastructures.includes('INFORMATION_TECHNOLOGY')
    );
    if (blended.length) {
      // eslint-disable-next-line no-console
      console.error('BLENDED DRIVER VULNS:', blended.map((d: any) => ({
        title: d.title,
        infrastructures: d.infrastructures,
        category: d.category,
      })));
    }
    expect(blended.length).toBe(0);
  });
});
