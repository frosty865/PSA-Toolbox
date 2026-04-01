/**
 * Canonical vuln blocks and curve normalization (single source of truth; Wastewater in list; IT backup_duration drift).
 */
import { describe, it, expect } from 'vitest';
import { normalizeCurveInputs } from './normalize_curve_inputs';
import { buildCanonicalVulnBlocks } from './canonical_vuln_blocks';
import { buildReportVMForReview } from '@/app/lib/report/build_report_vm_client';
import type { Assessment } from 'schema';
import { getDefaultAssessment } from '@/lib/default-assessment';

function makeAssessment(overrides?: Partial<Assessment>): Assessment {
  const base = getDefaultAssessment();
  if (overrides) Object.assign(base, overrides);
  return base;
}

describe('normalizeCurveInputs', () => {
  it('sets backup_duration_hours from curve_backup_duration_hours when backup_duration_hours is null (IT drift regression)', () => {
    const cat = {
      backup_duration_hours: null as number | null,
      curve_backup_duration_hours: 96,
      curve_backup_available: 'yes',
      curve_loss_fraction_no_backup: 0.5,
      curve_loss_fraction_with_backup: 0.2,
      curve_recovery_time_hours: 24,
      curve_time_to_impact_hours: 12,
    } as Record<string, unknown>;
    normalizeCurveInputs(cat);
    expect(cat.backup_duration_hours).toBe(96);
    expect(cat.curve_backup_duration_hours).toBe(96);
  });
});

describe('buildCanonicalVulnBlocks', () => {
  it('includes Wastewater when prebuilt sessions have WASTEWATER themed findings', () => {
    const assessment = makeAssessment({ categories: {} as Assessment['categories'] });
    const prebuiltSessions = {
      WASTEWATER: {
        derived: {
          themedFindings: [
            {
              id: 'WW_CAP_NO_ALTERNATE',
              domain: 'WASTEWATER',
              title: 'No Alternate Wastewater Capability',
              narrative: 'No alternate wastewater discharge capability is documented.',
              ofcText: 'Consider documenting alternate capability.',
              references: ['U.S. Environmental Protection Agency, Water Infrastructure and Security Guidance - https://www.epa.gov/waterresilience'],
            },
          ],
          ofcs: [
            { vulnerability_id: 'WW_CAP_NO_ALTERNATE', text: 'Validate temporary wastewater contingency procedures.' },
            { vulnerability_id: 'WW_CAP_NO_ALTERNATE', text: 'Exercise activation timing for alternate wastewater operations.' },
          ],
        },
      },
      ELECTRIC_POWER: { derived: { themedFindings: [], ofcs: [] } },
      COMMUNICATIONS: { derived: { themedFindings: [], ofcs: [] } },
      INFORMATION_TECHNOLOGY: { derived: { themedFindings: [], ofcs: [] } },
      WATER: { derived: { themedFindings: [], ofcs: [] } },
    };
    const { canonicalVulnBlocks, canonicalTotals } = buildCanonicalVulnBlocks(assessment, prebuiltSessions as any);
    expect(canonicalTotals.totalFindings).toBe(1);
    expect(canonicalVulnBlocks.length).toBe(1);
    expect(canonicalVulnBlocks[0].domain).toBe('WASTEWATER');
    expect(canonicalVulnBlocks[0].title).toBe('No Alternate Wastewater Capability');
  });

  it('online summary list equals export list: VM vulnerabilities match canonical order and titles', () => {
    const allowUnmapped = process.env.REPORT_ALLOW_UNMAPPED_KEYS;
    process.env.REPORT_ALLOW_UNMAPPED_KEYS = 'true';
    const assessment = makeAssessment({
      categories: {
        ELECTRIC_POWER: {},
        COMMUNICATIONS: {},
        INFORMATION_TECHNOLOGY: {
          it_transport_resilience: { circuit_count: 'TWO', building_entry_diversity: 'SAME_ENTRY', transport_route_independence: 'UNKNOWN' },
          it_hosted_resilience: { aws: { survivability: 'NO_CONTINUITY' } },
        },
        WATER: {},
        WASTEWATER: {},
        CRITICAL_PRODUCTS: {},
      } as unknown as Assessment['categories'],
    });
    const { canonicalVulnBlocks } = buildCanonicalVulnBlocks(assessment);
    const vm = buildReportVMForReview(assessment);
    const onlineList = (vm.infrastructures ?? [])
      .flatMap((inf) => inf.vulnerabilities ?? [])
      .map((v) => ({ title: v.title, summary: v.summary, ofcText: (v.ofcs ?? []).map((o) => o.text).join('\n') }));
    expect(onlineList.length).toBe(canonicalVulnBlocks.length);
    for (let i = 0; i < canonicalVulnBlocks.length; i++) {
      expect(onlineList[i].title).toBe(canonicalVulnBlocks[i].title);
      expect(onlineList[i].summary).toBe(canonicalVulnBlocks[i].narrative);
      expect(onlineList[i].ofcText.trim()).toBe(canonicalVulnBlocks[i].ofcText.trim());
    }
    if (allowUnmapped !== undefined) process.env.REPORT_ALLOW_UNMAPPED_KEYS = allowUnmapped;
    else delete process.env.REPORT_ALLOW_UNMAPPED_KEYS;
  });

  it('rebuilds from current answers and ignores stale assessment.sessions.derived when prebuilt is not provided', () => {
    const assessment = makeAssessment({
      categories: {
        ELECTRIC_POWER: {},
        COMMUNICATIONS: {},
        INFORMATION_TECHNOLOGY: {
          curve_requires_service: true,
          it_hosted_resilience: {
            aws: { survivability: 'NO_CONTINUITY' },
          },
          'IT-2_upstream_assets': [{ service_id: 'aws' }],
        },
        WATER: {},
        WASTEWATER: {},
        CRITICAL_PRODUCTS: {},
      } as Assessment['categories'],
      sessions: {
        WATER: {
          derived: {
            themedFindings: [
              {
                id: 'W_NO_ALTERNATE_SOURCE',
                domain: 'WATER',
                title: 'STALE TITLE SHOULD NOT APPEAR',
                narrative: 'STALE NARRATIVE SHOULD NOT APPEAR',
                ofcText: 'STALE OFC SHOULD NOT APPEAR',
              },
            ],
            ofcs: [{ vulnerability_id: 'W_NO_ALTERNATE_SOURCE', text: 'STALE OFC FROM LIST' }],
          },
        },
        ELECTRIC_POWER: { derived: { themedFindings: [], ofcs: [] } },
        COMMUNICATIONS: { derived: { themedFindings: [], ofcs: [] } },
        INFORMATION_TECHNOLOGY: { derived: { themedFindings: [], ofcs: [] } },
        WASTEWATER: { derived: { themedFindings: [], ofcs: [] } },
      },
    } as unknown as Assessment);
    const { canonicalVulnBlocks } = buildCanonicalVulnBlocks(assessment);
    expect(canonicalVulnBlocks.some((b) => b.title === 'STALE TITLE SHOULD NOT APPEAR')).toBe(false);
    expect(canonicalVulnBlocks.some((b) => (b.ofcText ?? '').includes('STALE OFC SHOULD NOT APPEAR'))).toBe(false);
    expect(canonicalVulnBlocks.some((b) => b.domain === 'INFORMATION_TECHNOLOGY')).toBe(true);
  });

  it('uses themedFindings[].ofcText as primary and only fills to minimum from derived.ofcs', () => {
    const prebuilt = {
      WATER: {
        derived: {
          themedFindings: [
            {
              id: 'W_NO_ALTERNATE_SOURCE',
              title: 'No Alternate Water Source',
              narrative: 'N',
              ofcText: 'Inline OFC text.',
              references: ['NIST Cybersecurity Framework, Version 1.1 - https://www.nist.gov/cyberframework'],
            },
          ],
          ofcs: [
            { vulnerability_id: 'W_NO_ALTERNATE_SOURCE', text: 'From ofcs array.' },
            { vulnerability_id: 'W_NO_ALTERNATE_SOURCE', text: 'Second ofcs array fill.' },
          ],
        },
      },
      ELECTRIC_POWER: { derived: { themedFindings: [], ofcs: [] } },
      COMMUNICATIONS: { derived: { themedFindings: [], ofcs: [] } },
      INFORMATION_TECHNOLOGY: { derived: { themedFindings: [], ofcs: [] } },
      WASTEWATER: { derived: { themedFindings: [], ofcs: [] } },
    };
    (prebuilt.WATER.derived.themedFindings[0] as any).domain = 'WATER';
    const assessment = makeAssessment({ categories: {} as Assessment['categories'] });
    const { canonicalVulnBlocks } = buildCanonicalVulnBlocks(assessment, prebuilt as any);
    const block = canonicalVulnBlocks.find((b) => b.domain === 'WATER');
    expect(block).toBeDefined();
    expect(block!.ofcText).not.toContain('Inline OFC text.');
    expect(block!.ofcText).not.toContain('From ofcs array.');
    expect(block!.ofcText.split('\n').filter(Boolean).length).toBeGreaterThanOrEqual(2);
    expect((block!.references ?? []).length).toBeGreaterThan(0);
  });

  it('hosted resilience inputs produce canonical IT blocks with OFCs and references when findings are generated', () => {
    const assessment = makeAssessment({
      categories: {
        ELECTRIC_POWER: {},
        COMMUNICATIONS: {},
        INFORMATION_TECHNOLOGY: {
          curve_requires_service: true,
          it_hosted_resilience: {
            aws: { survivability: 'NO_CONTINUITY' },
            cloudflare: { survivability: 'NO_CONTINUITY' },
          },
          'IT-2_upstream_assets': [{ service_id: 'aws' }, { service_id: 'cloudflare' }],
        },
        WATER: {},
        WASTEWATER: {},
        CRITICAL_PRODUCTS: {},
      } as Assessment['categories'],
    });
    const { canonicalVulnBlocks } = buildCanonicalVulnBlocks(assessment);
    const itBlocks = canonicalVulnBlocks.filter((b) => b.domain === 'INFORMATION_TECHNOLOGY');
    for (const block of itBlocks) {
      expect((block.ofcText ?? '').trim().length).toBeGreaterThan(0);
      expect((block.ofcText ?? '').includes('(Source:')).toBe(false);
      expect((block.references ?? []).length).toBeGreaterThan(0);
    }
  });
});
