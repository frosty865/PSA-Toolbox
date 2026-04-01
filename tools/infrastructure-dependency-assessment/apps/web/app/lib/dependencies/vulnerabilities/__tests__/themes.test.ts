/**
 * QA/QC tests for theme-based findings.
 */
import { describe, it, expect } from 'vitest';
import { resolveThemedFindings } from '../resolveThemes';
import { deriveCommsFindings } from '../../derive_comms_findings';
import { deriveItFindings } from '../../derive_it_findings';
import { deriveWaterFindings } from '../../derive_water_findings';
import { deriveWastewaterFindings } from '../../derive_wastewater_findings';

describe('Theme-based findings', () => {
  it('CO-3=No outputs COMMS_DIVERSITY', () => {
    const findings = resolveThemedFindings({
      category: 'COMMUNICATIONS',
      answers: { 'CO-3_multiple_connections': 'no' },
    });
    const diversity = findings.find((f) => f.id === 'COMMS_DIVERSITY');
    expect(diversity).toBeDefined();
  });

  it('single-path transport outputs IT_TRANSPORT_SINGLE_PATH', () => {
    const findings = resolveThemedFindings({
      category: 'INFORMATION_TECHNOLOGY',
      answers: {},
      categoryInput: { supply: { has_alternate_source: false, sources: [] } },
    });
    const transport = findings.find((f) => f.id === 'IT_TRANSPORT_SINGLE_PATH');
    expect(transport).toBeDefined();
  });

  it('W_Q8=No outputs W_NO_ALTERNATE_SOURCE', () => {
    const findings = resolveThemedFindings({
      category: 'WATER',
      answers: { W_Q8_alternate_source: 'no' },
    });
    const alternate = findings.find((f) => f.id === 'W_NO_ALTERNATE_SOURCE');
    expect(alternate).toBeDefined();
  });

  it('no more than 3 findings for Comms', () => {
    const findings = resolveThemedFindings({
      category: 'COMMUNICATIONS',
      answers: {
        'CO-3_multiple_connections': 'no',
        'CO-4_physically_separated': 'no',
        'CO-8_backup_available': 'no',
        'CO-11_restoration_coordination': 'no',
      },
    });
    expect(findings.length).toBeLessThanOrEqual(3);
  });

  it('no more than 3 findings for IT', () => {
    const findings = resolveThemedFindings({
      category: 'INFORMATION_TECHNOLOGY',
      answers: {
        'IT-1_can_identify_providers': 'no',
        'IT-8_backup_available': 'no',
        'IT-10_reliability_known': 'no',
      },
    });
    expect(findings.length).toBeLessThanOrEqual(3);
  });

  it('no more than 2 findings for Water', () => {
    const findings = resolveThemedFindings({
      category: 'WATER',
      answers: {
        W_Q8_alternate_source: 'no',
      },
    });
    expect(findings.length).toBeLessThanOrEqual(2);
  });

  it('no more than 2 findings for Wastewater', () => {
    const findings = resolveThemedFindings({
      category: 'WASTEWATER',
      answers: {
        WW_Q6_priority_restoration: 'no',
      },
    });
    expect(findings.length).toBeLessThanOrEqual(2);
  });

  it('deriveCommsFindings returns themed vulnerabilities', () => {
    const { vulnerabilities } = deriveCommsFindings({
      'CO-3_multiple_connections': 'no',
    } as any);
    expect(vulnerabilities.some((v) => v.id === 'COMMS_DIVERSITY')).toBe(true);
  });

  it('deriveItFindings returns themed vulnerabilities', () => {
    const { vulnerabilities } = deriveItFindings({
      'IT-8_backup_available': 'no',
    } as any);
    expect(vulnerabilities.some((v) => v.id === 'IT_TRANSPORT_SINGLE_PATH')).toBe(true);
  });

  it('deriveWaterFindings returns themed vulnerabilities', () => {
    const { vulnerabilities } = deriveWaterFindings({
      W_Q8_alternate_source: 'no',
    } as any);
    expect(vulnerabilities.some((v) => v.id === 'W_NO_ALTERNATE_SOURCE')).toBe(true);
  });

  it('deriveWastewaterFindings returns themed vulnerabilities', () => {
    const { vulnerabilities } = deriveWastewaterFindings({} as any);
    expect(vulnerabilities).toBeDefined();
    expect(Array.isArray(vulnerabilities)).toBe(true);
  });
});
