/**
 * Tests for hosted_service_registry.
 */
import { describe, it, expect } from 'vitest';
import {
  HOSTED_SERVICE_REGISTRY,
  HOSTED_SERVICE_LABEL_TO_ID,
  HOSTED_SERVICE_DROPDOWN_OPTIONS,
  PROVIDER_CATEGORY,
  catalogIdToHostedServiceId,
  labelToHostedServiceId,
  getHostedServiceProfile,
  getHostedServiceProfileById,
  isTransportProvider,
  isDependencyExcludedFromHostedResilience,
  getProviderCategoryForContinuity,
} from './hosted_service_registry';

describe('hosted_service_registry', () => {
  it('maps digital_services_catalog ids to HostedServiceId', () => {
    expect(catalogIdToHostedServiceId('aws')).toBe('AWS');
    expect(catalogIdToHostedServiceId('azure')).toBe('AZURE');
    expect(catalogIdToHostedServiceId('m365')).toBe('M365');
    expect(catalogIdToHostedServiceId('entra_id')).toBe('ENTRA_ID');
    expect(catalogIdToHostedServiceId('veeam_cloud_connect')).toBe('VEEAM_CLOUD_CONNECT');
    expect(catalogIdToHostedServiceId('other')).toBe('OTHER');
  });

  it('handles lowercase catalog ids', () => {
    expect(catalogIdToHostedServiceId('AWS')).toBe('AWS');
    expect(catalogIdToHostedServiceId('M365')).toBe('M365');
  });

  it('returns null for unknown catalog id', () => {
    expect(catalogIdToHostedServiceId('unknown_service')).toBeNull();
    expect(catalogIdToHostedServiceId('')).toBeNull();
  });

  it('maps exact UI labels to HostedServiceId', () => {
    expect(labelToHostedServiceId('Amazon Web Services (AWS)')).toBe('AWS');
    expect(labelToHostedServiceId('Microsoft Entra ID (Azure AD)')).toBe('ENTRA_ID');
    expect(labelToHostedServiceId('Veeam Cloud Connect')).toBe('VEEAM_CLOUD_CONNECT');
  });

  it('returns null for unknown label', () => {
    expect(labelToHostedServiceId('Unknown Service')).toBeNull();
  });

  it('getHostedServiceProfile returns profile for catalog id', () => {
    const profile = getHostedServiceProfile('entra_id');
    expect(profile).not.toBeNull();
    expect(profile!.id).toBe('ENTRA_ID');
    expect(profile!.defaultTypeLabel).toBe('Identity (IdP)');
    expect(profile!.defaultFunctions).toContain('Authentication');
    expect(profile!.category).toBe('IDENTITY_ACCESS');
  });

  it('getHostedServiceProfile returns profile for backup/storage', () => {
    const profile = getHostedServiceProfile('veeam_cloud_connect');
    expect(profile).not.toBeNull();
    expect(profile!.category).toBe('BACKUP_STORAGE');
    expect(profile!.defaultTypeLabel).toBe('Backup/replication');
    expect(profile!.defaultFunctions).toContain('Backups');
  });

  it('getHostedServiceProfileById returns profile for HostedServiceId', () => {
    const profile = getHostedServiceProfileById('ENTRA_ID');
    expect(profile).not.toBeNull();
    expect(profile!.label).toContain('Entra');
  });

  it('HOSTED_SERVICE_REGISTRY has all digital_services_catalog entries', () => {
    const catalogIds = [
      'aws', 'azure', 'gcp', 'oracle_cloud', 'cloudflare',
      'm365', 'office_365', 'teams', 'google_workspace', 'entra_id', 'okta', 'ping',
      'zscaler', 'prisma_access', 'cisco_secure_client', 'fortinet_sase', 'cloudflare_zero_trust',
      'sap_erp', 'oracle_erp', 'workday_hris', 'adp_hris', 'salesforce_crm',
      'stripe', 'paypal', 'shopify', 'zoom', 'ringcentral', 'webex', 'genesys_cloud', 'twilio',
      'servicenow', 'jira_confluence', 'datadog',
      'onedrive_sharepoint', 'google_drive', 'dropbox_business', 'veeam_cloud_connect',
      'other',
    ];
    for (const id of catalogIds) {
      expect(HOSTED_SERVICE_REGISTRY[id]).toBeDefined();
      expect(HOSTED_SERVICE_REGISTRY[id].defaultTypeLabel).toBeDefined();
      if (id !== 'other') {
        expect(HOSTED_SERVICE_REGISTRY[id].defaultFunctions.length).toBeGreaterThan(0);
      }
    }
  });

  it('HOSTED_SERVICE_LABEL_TO_ID has exact label mappings', () => {
    expect(HOSTED_SERVICE_LABEL_TO_ID['Amazon Web Services (AWS)']).toBe('AWS');
    expect(HOSTED_SERVICE_LABEL_TO_ID['Microsoft 365 (Exchange/Teams/SharePoint)']).toBe('M365');
  });

  it('test_registry_covers_dropdown: every dropdown label resolves to an ID (dropdown derived from registry)', () => {
    for (const opt of HOSTED_SERVICE_DROPDOWN_OPTIONS) {
      const profile = HOSTED_SERVICE_REGISTRY[opt.id];
      expect(profile).toBeDefined();
      const id = labelToHostedServiceId(opt.label);
      expect(id).toBeDefined();
      expect(id).not.toBeNull();
      expect(id).toBe(profile!.id);
    }
  });

  it('test_no_hostedapp_type_leaks: Type column never equals HostedApp', () => {
    for (const profile of Object.values(HOSTED_SERVICE_REGISTRY)) {
      expect(profile.defaultTypeLabel).not.toBe('HostedApp');
    }
  });

  it('isTransportProvider: returns true for known ISPs', () => {
    expect(isTransportProvider('Xfinity')).toBe(true);
    expect(isTransportProvider('Comcast')).toBe(true);
    expect(isTransportProvider('AT&T')).toBe(true);
    expect(isTransportProvider('AT&T Internet')).toBe(true);
    expect(isTransportProvider('Verizon Fios')).toBe(true);
    expect(isTransportProvider('Spectrum')).toBe(true);
    expect(isTransportProvider('Charter')).toBe(true);
    expect(isTransportProvider('xfinity')).toBe(true);
  });

  it('isTransportProvider: returns false for non-ISP names', () => {
    expect(isTransportProvider('Amazon Web Services')).toBe(false);
    expect(isTransportProvider('Microsoft')).toBe(false);
    expect(isTransportProvider('Acme MSP')).toBe(false);
  });

  it('isDependencyExcludedFromHostedResilience: excludes all IT-1 providers from continuity (block is hosted apps only)', () => {
    expect(isDependencyExcludedFromHostedResilience('provider_Xfinity', 'IT service provider: Xfinity')).toBe(true);
    expect(isDependencyExcludedFromHostedResilience('provider_Comcast', 'IT service provider: Comcast')).toBe(true);
    expect(isDependencyExcludedFromHostedResilience('provider_Acme Corp', 'IT service provider: Acme Corp')).toBe(true);
    expect(isDependencyExcludedFromHostedResilience('provider_Google', 'IT service provider: Google')).toBe(true);
  });

  it('isDependencyExcludedFromHostedResilience: does not exclude IT-2 upstream (no TRANSPORT_ISP in registry)', () => {
    expect(isDependencyExcludedFromHostedResilience('aws', 'Amazon Web Services (AWS)', 'aws')).toBe(false);
    expect(isDependencyExcludedFromHostedResilience('m365', 'Microsoft 365 (M365)', 'm365')).toBe(false);
  });

  it('getProviderCategoryForContinuity: Google (IT-1) = INTERNET_PROVIDER, M365 (IT-2) = HOSTED_APPLICATION', () => {
    expect(getProviderCategoryForContinuity('provider_Google')).toBe(PROVIDER_CATEGORY.INTERNET_PROVIDER);
    expect(getProviderCategoryForContinuity('provider_Microsoft 365')).toBe(PROVIDER_CATEGORY.INTERNET_PROVIDER);
    expect(getProviderCategoryForContinuity('m365', 'm365')).toBe(PROVIDER_CATEGORY.HOSTED_APPLICATION);
    expect(getProviderCategoryForContinuity('aws', 'aws')).toBe(PROVIDER_CATEGORY.HOSTED_APPLICATION);
  });
});
