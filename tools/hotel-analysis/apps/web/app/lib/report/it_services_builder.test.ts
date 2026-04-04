/**
 * Tests for buildItExternalServices and buildItCascadeNarrative.
 */
import { describe, it, expect } from 'vitest';
import {
  buildItExternalServices,
  buildItCascadeNarrative,
  type ItConditions,
} from './it_services_builder';
import type { Assessment } from 'schema';

const baseConditions: ItConditions = {
  single_path: true,
  alternate_present: false,
  alternate_short_duration: false,
  alternate_sustainment_hr: null,
  primary_provider: 'Acme ISP',
  connection_labels: [],
};

describe('buildItExternalServices', () => {
  it('returns empty when IT-2_upstream_assets is empty', () => {
    const assessment: Assessment = {
      meta: { tool_version: '1', template_version: '1', created_at_iso: new Date().toISOString() },
      asset: { asset_name: 'Test Facility', visit_date_iso: '2024-01-01' },
      categories: {
        INFORMATION_TECHNOLOGY: {
          'IT-2_upstream_assets': [],
        } as Record<string, unknown>,
      } as Assessment['categories'],
    };
    const services = buildItExternalServices(assessment, baseConditions);
    expect(services).toEqual([]);
  });

  it('maps Office 365 and Azure AD to external services', () => {
    const assessment: Assessment = {
      meta: { tool_version: '1', template_version: '1', created_at_iso: new Date().toISOString() },
      asset: { asset_name: 'Test Facility', visit_date_iso: '2024-01-01' },
      categories: {
        INFORMATION_TECHNOLOGY: {
          'IT-2_upstream_assets': [
            { service_id: 'm365', service_provider: 'Microsoft', designation: 'primary' },
            { service_id: 'entra_id', service_provider: 'Microsoft', designation: 'primary' },
          ],
        } as Record<string, unknown>,
      } as Assessment['categories'],
    };
    const services = buildItExternalServices(assessment, baseConditions);
    expect(services.length).toBe(2);
    expect(services[0].name).toContain('Microsoft 365');
    expect(services[0].service_type).toBe('Email/Productivity');
    expect(services[1].name).toContain('Entra');
    expect(services[1].service_type).toBe('Identity (IdP)');
    expect(services[0].cascade_effect).toContain('email');
    expect(services[1].cascade_effect).toContain('authentication');
  });

  it('uses registry for Type and Supported Functions', () => {
    const assessment: Assessment = {
      meta: { tool_version: '1', template_version: '1', created_at_iso: new Date().toISOString() },
      asset: { asset_name: 'Test Facility', visit_date_iso: '2024-01-01' },
      categories: {
        INFORMATION_TECHNOLOGY: {
          'IT-2_upstream_assets': [
            { service_id: 'veeam_cloud_connect', service_provider: 'Veeam' },
          ],
        } as Record<string, unknown>,
      } as Assessment['categories'],
    };
    const services = buildItExternalServices(assessment, baseConditions);
    expect(services.length).toBe(1);
    expect(services[0].service_type).toBe('Backup/replication');
    expect(services[0].supports_functions).toContain('Backups');
    expect(services[0].supports_functions).toContain('Restore operations');
  });

  it('uses category template for BACKUP_STORAGE cascade effect when no primary provider', () => {
    const assessment: Assessment = {
      meta: { tool_version: '1', template_version: '1', created_at_iso: new Date().toISOString() },
      asset: { asset_name: 'Test Facility', visit_date_iso: '2024-01-01' },
      categories: {
        INFORMATION_TECHNOLOGY: {
          'IT-2_upstream_assets': [
            { service_id: 'onedrive_sharepoint', service_provider: 'Microsoft' },
          ],
        } as Record<string, unknown>,
      } as Assessment['categories'],
    };
    const conditionsWithoutProvider = { ...baseConditions, primary_provider: null };
    const services = buildItExternalServices(assessment, conditionsWithoutProvider);
    expect(services[0].cascade_effect).toContain('document access');
    expect(services[0].cascade_effect).toContain('restore');
  });

  it('maps it_hosted_resilience survivability to resilience (NO_CONTINUITY not "Not assessed")', () => {
    const assessment: Assessment = {
      meta: { tool_version: '1', template_version: '1', created_at_iso: new Date().toISOString() },
      asset: { asset_name: 'Test Facility', visit_date_iso: '2024-01-01' },
      categories: {
        INFORMATION_TECHNOLOGY: {
          'IT-2_upstream_assets': [
            { service_id: 'aws', service_provider: 'Amazon' },
            { service_id: 'adp_hris', service_provider: 'ADP' },
            { service_id: 'entra_id', service_provider: 'Microsoft' },
          ],
          it_hosted_resilience: {
            aws: { survivability: 'NO_CONTINUITY' },
            adp_hris: { survivability: 'LOCAL_MIRROR_OR_CACHE' },
            entra_id: { survivability: 'LOCAL_MIRROR_OR_CACHE' },
          },
        } as Record<string, unknown>,
      } as Assessment['categories'],
    };
    const services = buildItExternalServices(assessment, baseConditions);
    const byCatalogId = Object.fromEntries(services.map((s) => [s.catalog_id ?? s.name, s]));
    expect(byCatalogId.aws?.resilience).toBe('No continuity');
    expect(byCatalogId.adp_hris?.resilience).toBe('Local mirror/cache');
    expect(byCatalogId.entra_id?.resilience).toBe('Local mirror/cache');
  });

  it('handles other service with custom name', () => {
    const assessment: Assessment = {
      meta: { tool_version: '1', template_version: '1', created_at_iso: new Date().toISOString() },
      asset: { asset_name: 'Test Facility', visit_date_iso: '2024-01-01' },
      categories: {
        INFORMATION_TECHNOLOGY: {
          'IT-2_upstream_assets': [
            { service_id: 'other', service_other: 'Custom CRM' },
          ],
        } as Record<string, unknown>,
      } as Assessment['categories'],
    };
    const services = buildItExternalServices(assessment, baseConditions);
    expect(services.length).toBe(1);
    expect(services[0].name).toBe('Custom CRM');
    expect(services[0].service_type).toBe('Other');
  });
});

describe('buildItCascadeNarrative', () => {
  it('returns no external services message when external_services is empty', () => {
    const narrative = buildItCascadeNarrative([], baseConditions);
    expect(narrative).toContain('No external critical services were identified');
  });

  it('produces deterministic output and references Hosted/Upstream table (no provider enumeration)', () => {
    const conditions = { ...baseConditions, primary_provider: 'Acme ISP' };
    const services = buildItExternalServices(
      {
        meta: { tool_version: '1', template_version: '1', created_at_iso: new Date().toISOString() },
      asset: { asset_name: 'Test Facility', visit_date_iso: '2024-01-01' },
        categories: {
          INFORMATION_TECHNOLOGY: {
            'IT-2_upstream_assets': [
              { service_id: 'm365', service_provider: 'Microsoft' },
            ],
          } as Record<string, unknown>,
        } as Assessment['categories'],
      },
      conditions
    );
    const narrative = buildItCascadeNarrative(services, conditions);
    expect(narrative).toContain('single documented data transport path');
    expect(narrative).toContain('Hosted / Upstream Dependencies table');
    expect(narrative).not.toContain('Acme ISP');
    expect(narrative).not.toContain('Microsoft 365');
  });
});

describe('test_cascade_templates_by_category', () => {
  const conditionsNoProvider = {
    ...baseConditions,
    primary_provider: null,
    alternate_present: false,
    alternate_short_duration: false,
  };

  it('AWS uses CLOUD_HOSTING template', () => {
    const assessment: Assessment = {
      meta: { tool_version: '1', template_version: '1', created_at_iso: new Date().toISOString() },
      asset: { asset_name: 'Test Facility', visit_date_iso: '2024-01-01' },
      categories: {
        INFORMATION_TECHNOLOGY: {
          'IT-2_upstream_assets': [{ service_id: 'aws', service_provider: 'Amazon' }],
        } as Record<string, unknown>,
      } as Assessment['categories'],
    };
    const services = buildItExternalServices(assessment, conditionsNoProvider);
    expect(services[0].cascade_effect).toContain('cloud hosting');
    expect(services[0].cascade_effect).toContain('hosted applications');
  });

  it('Cloudflare uses NETWORK_EDGE template', () => {
    const assessment: Assessment = {
      meta: { tool_version: '1', template_version: '1', created_at_iso: new Date().toISOString() },
      asset: { asset_name: 'Test Facility', visit_date_iso: '2024-01-01' },
      categories: {
        INFORMATION_TECHNOLOGY: {
          'IT-2_upstream_assets': [{ service_id: 'cloudflare', service_provider: 'Cloudflare' }],
        } as Record<string, unknown>,
      } as Assessment['categories'],
    };
    const services = buildItExternalServices(assessment, conditionsNoProvider);
    expect(services[0].cascade_effect).toContain('edge');
    expect(services[0].cascade_effect).toContain('remote');
  });

  it('Entra ID uses IDENTITY_ACCESS template', () => {
    const assessment: Assessment = {
      meta: { tool_version: '1', template_version: '1', created_at_iso: new Date().toISOString() },
      asset: { asset_name: 'Test Facility', visit_date_iso: '2024-01-01' },
      categories: {
        INFORMATION_TECHNOLOGY: {
          'IT-2_upstream_assets': [{ service_id: 'entra_id', service_provider: 'Microsoft' }],
        } as Record<string, unknown>,
      } as Assessment['categories'],
    };
    const services = buildItExternalServices(assessment, conditionsNoProvider);
    expect(services[0].cascade_effect).toContain('identity');
    expect(services[0].cascade_effect).toContain('authentication');
  });

  it('ServiceNow uses IT_SERVICE_MONITORING template', () => {
    const assessment: Assessment = {
      meta: { tool_version: '1', template_version: '1', created_at_iso: new Date().toISOString() },
      asset: { asset_name: 'Test Facility', visit_date_iso: '2024-01-01' },
      categories: {
        INFORMATION_TECHNOLOGY: {
          'IT-2_upstream_assets': [{ service_id: 'servicenow', service_provider: 'ServiceNow' }],
        } as Record<string, unknown>,
      } as Assessment['categories'],
    };
    const services = buildItExternalServices(assessment, conditionsNoProvider);
    expect(services[0].cascade_effect).toContain('IT service');
    expect(services[0].cascade_effect).toContain('monitoring');
  });

  it('OneDrive uses BACKUP_STORAGE template', () => {
    const assessment: Assessment = {
      meta: { tool_version: '1', template_version: '1', created_at_iso: new Date().toISOString() },
      asset: { asset_name: 'Test Facility', visit_date_iso: '2024-01-01' },
      categories: {
        INFORMATION_TECHNOLOGY: {
          'IT-2_upstream_assets': [{ service_id: 'onedrive_sharepoint', service_provider: 'Microsoft' }],
        } as Record<string, unknown>,
      } as Assessment['categories'],
    };
    const services = buildItExternalServices(assessment, conditionsNoProvider);
    expect(services[0].cascade_effect).toContain('document access');
    expect(services[0].cascade_effect).toContain('restore');
  });
});


