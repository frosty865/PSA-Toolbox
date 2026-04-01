/**
 * Hosted service registry for IT external services.
 * Maps digital_services_catalog ids (lowercase) to HostedServiceId (uppercase)
 * and provides default Type labels and Supported Functions per service.
 */

/** Uppercase service IDs aligned with digital_services_catalog. */
export type HostedServiceId =
  | 'AWS'
  | 'AZURE'
  | 'GCP'
  | 'ORACLE_CLOUD'
  | 'CLOUDFLARE'
  | 'M365'
  | 'OFFICE_365'
  | 'TEAMS'
  | 'GOOGLE_WORKSPACE'
  | 'ENTRA_ID'
  | 'OKTA'
  | 'PING'
  | 'ZSCALER'
  | 'PRISMA_ACCESS'
  | 'CISCO_SECURE_CLIENT'
  | 'FORTINET_SASE'
  | 'CLOUDFLARE_ZERO_TRUST'
  | 'SAP_ERP'
  | 'ORACLE_ERP'
  | 'WORKDAY_HRIS'
  | 'ADP_HRIS'
  | 'SALESFORCE_CRM'
  | 'STRIPE'
  | 'PAYPAL'
  | 'SHOPIFY'
  | 'ZOOM'
  | 'RINGCENTRAL'
  | 'WEBEX'
  | 'GENESYS_CLOUD'
  | 'TWILIO'
  | 'SERVICENOW'
  | 'JIRA_CONFLUENCE'
  | 'DATADOG'
  | 'ONEDRIVE_SHAREPOINT'
  | 'GOOGLE_DRIVE'
  | 'DROPBOX_BUSINESS'
  | 'VEEAM_CLOUD_CONNECT'
  | 'WEB_EOC'
  | 'PHYSICAL_SECURITY_SYSTEMS'
  | 'OTHER';

/** Dependency kind: hosted/upstream vs transport (ISP). Used to exclude ISPs from Hosted/Upstream Resilience UI and report. */
export type HostedServiceKind =
  | 'CLOUD'
  | 'SAAS'
  | 'SECURITY_EDGE'
  | 'PRODUCTIVITY'
  | 'IDENTITY'
  | 'TRANSPORT_ISP'
  | 'OTHER';

/**
 * Provider category for Hosted Services continuity block.
 * Only HOSTED_APPLICATION dependencies (IT-2 catalog: SaaS, cloud, hosted apps) get continuity questions.
 * INTERNET_PROVIDER (ISPs) and IT-1 MSP/managed providers must NOT render in the continuity block.
 */
export const PROVIDER_CATEGORY = {
  HOSTED_APPLICATION: 'HOSTED_APPLICATION',
  INTERNET_PROVIDER: 'INTERNET_PROVIDER',
} as const;

export type ProviderCategory = (typeof PROVIDER_CATEGORY)[keyof typeof PROVIDER_CATEGORY];

/** Service category for cascade templates and vulnerability triggers. */
export type HostedServiceCategory =
  | 'CLOUD_HOSTING'
  | 'EMAIL_PRODUCTIVITY'
  | 'IDENTITY_ACCESS'
  | 'NETWORK_EDGE_REMOTE_ACCESS'
  | 'CORE_BUSINESS_SYSTEMS'
  | 'PAYMENTS_ECOMMERCE'
  | 'COMMS_CONTACT_CENTER'
  | 'IT_SERVICE_MONITORING'
  | 'BACKUP_STORAGE'
  | 'OTHER';

export type ItExternalServiceType =
  | 'SaaS'
  | 'IdP'
  | 'HostedApp'
  | 'ManagedService'
  | 'DNS'
  | 'Email'
  | 'Storage'
  | 'VoIP'
  | 'Other';

export type CriticalityHint = 'HIGH' | 'MED' | 'LOW';

export interface HostedServiceProfile {
  id: HostedServiceId;
  label: string;
  kind: HostedServiceKind;
  category: HostedServiceCategory;
  defaultTypeLabel: string;  // Table Type column display (never "HostedApp")
  defaultFunctions: string[];
  criticalityHint: CriticalityHint;
}

/** Map digital_services_catalog id (lowercase) → HostedServiceProfile. */
export const HOSTED_SERVICE_REGISTRY: Record<string, HostedServiceProfile> = {
  aws: {
    id: 'AWS',
    label: 'Amazon Web Services (AWS)',
    kind: 'CLOUD',
    category: 'CLOUD_HOSTING',
    defaultTypeLabel: 'Cloud hosting',
    defaultFunctions: ['Hosted applications', 'Data hosting'],
    criticalityHint: 'HIGH',
  },
  azure: {
    id: 'AZURE',
    label: 'Microsoft Azure',
    kind: 'CLOUD',
    category: 'CLOUD_HOSTING',
    defaultTypeLabel: 'Cloud hosting',
    defaultFunctions: ['Hosted applications', 'Data hosting'],
    criticalityHint: 'HIGH',
  },
  gcp: {
    id: 'GCP',
    label: 'Google Cloud Platform (GCP)',
    kind: 'CLOUD',
    category: 'CLOUD_HOSTING',
    defaultTypeLabel: 'Cloud hosting',
    defaultFunctions: ['Hosted applications', 'Data hosting'],
    criticalityHint: 'HIGH',
  },
  oracle_cloud: {
    id: 'ORACLE_CLOUD',
    label: 'Oracle Cloud',
    kind: 'CLOUD',
    category: 'CLOUD_HOSTING',
    defaultTypeLabel: 'Cloud hosting',
    defaultFunctions: ['Hosted applications', 'Data hosting'],
    criticalityHint: 'HIGH',
  },
  cloudflare: {
    id: 'CLOUDFLARE',
    label: 'Cloudflare',
    kind: 'SECURITY_EDGE',
    category: 'NETWORK_EDGE_REMOTE_ACCESS',
    defaultTypeLabel: 'CDN/DNS/Edge',
    defaultFunctions: ['Application reachability', 'DNS-dependent functions'],
    criticalityHint: 'HIGH',
  },
  m365: {
    id: 'M365',
    label: 'Microsoft 365 (Exchange/Teams/SharePoint)',
    kind: 'PRODUCTIVITY',
    category: 'EMAIL_PRODUCTIVITY',
    defaultTypeLabel: 'Email/Productivity',
    defaultFunctions: ['Email', 'Documents', 'Collaboration'],
    criticalityHint: 'HIGH',
  },
  office_365: {
    id: 'OFFICE_365',
    label: 'Office 365',
    kind: 'PRODUCTIVITY',
    category: 'EMAIL_PRODUCTIVITY',
    defaultTypeLabel: 'Email/Productivity',
    defaultFunctions: ['Email', 'Documents', 'Collaboration'],
    criticalityHint: 'HIGH',
  },
  teams: {
    id: 'TEAMS',
    label: 'Microsoft Teams',
    kind: 'PRODUCTIVITY',
    category: 'COMMS_CONTACT_CENTER',
    defaultTypeLabel: 'UC/Contact center',
    defaultFunctions: ['Voice/Meetings', 'Collaboration'],
    criticalityHint: 'MED',
  },
  google_workspace: {
    id: 'GOOGLE_WORKSPACE',
    label: 'Google Workspace (Gmail/Drive/Meet)',
    kind: 'PRODUCTIVITY',
    category: 'EMAIL_PRODUCTIVITY',
    defaultTypeLabel: 'Email/Productivity',
    defaultFunctions: ['Email', 'Documents', 'Collaboration'],
    criticalityHint: 'HIGH',
  },
  entra_id: {
    id: 'ENTRA_ID',
    label: 'Microsoft Entra ID (Azure AD)',
    kind: 'IDENTITY',
    category: 'IDENTITY_ACCESS',
    defaultTypeLabel: 'Identity (IdP)',
    defaultFunctions: ['Authentication', 'SSO/MFA'],
    criticalityHint: 'HIGH',
  },
  okta: {
    id: 'OKTA',
    label: 'Okta',
    kind: 'IDENTITY',
    category: 'IDENTITY_ACCESS',
    defaultTypeLabel: 'Identity (IdP)',
    defaultFunctions: ['Authentication', 'SSO/MFA'],
    criticalityHint: 'HIGH',
  },
  ping: {
    id: 'PING',
    label: 'Ping Identity',
    kind: 'IDENTITY',
    category: 'IDENTITY_ACCESS',
    defaultTypeLabel: 'Identity (IdP)',
    defaultFunctions: ['Authentication', 'SSO/MFA'],
    criticalityHint: 'HIGH',
  },
  zscaler: {
    id: 'ZSCALER',
    label: 'Zscaler',
    kind: 'SECURITY_EDGE',
    category: 'NETWORK_EDGE_REMOTE_ACCESS',
    defaultTypeLabel: 'Remote access / edge',
    defaultFunctions: ['Remote access', 'Secure connectivity'],
    criticalityHint: 'HIGH',
  },
  prisma_access: {
    id: 'PRISMA_ACCESS',
    label: 'Palo Alto Prisma Access',
    kind: 'SECURITY_EDGE',
    category: 'NETWORK_EDGE_REMOTE_ACCESS',
    defaultTypeLabel: 'Remote access / edge',
    defaultFunctions: ['Remote access', 'Secure connectivity'],
    criticalityHint: 'HIGH',
  },
  cisco_secure_client: {
    id: 'CISCO_SECURE_CLIENT',
    label: 'Cisco Secure Client (AnyConnect)',
    kind: 'SECURITY_EDGE',
    category: 'NETWORK_EDGE_REMOTE_ACCESS',
    defaultTypeLabel: 'Remote access / edge',
    defaultFunctions: ['Remote access', 'Secure connectivity'],
    criticalityHint: 'MED',
  },
  fortinet_sase: {
    id: 'FORTINET_SASE',
    label: 'Fortinet SASE / FortiSASE',
    kind: 'SECURITY_EDGE',
    category: 'NETWORK_EDGE_REMOTE_ACCESS',
    defaultTypeLabel: 'Remote access / edge',
    defaultFunctions: ['Remote access', 'Secure connectivity'],
    criticalityHint: 'MED',
  },
  cloudflare_zero_trust: {
    id: 'CLOUDFLARE_ZERO_TRUST',
    label: 'Cloudflare Zero Trust',
    kind: 'SECURITY_EDGE',
    category: 'NETWORK_EDGE_REMOTE_ACCESS',
    defaultTypeLabel: 'Remote access / edge',
    defaultFunctions: ['Remote access', 'Secure connectivity'],
    criticalityHint: 'MED',
  },
  sap_erp: {
    id: 'SAP_ERP',
    label: 'ERP (SAP)',
    kind: 'SAAS',
    category: 'CORE_BUSINESS_SYSTEMS',
    defaultTypeLabel: 'ERP',
    defaultFunctions: ['Core business operations'],
    criticalityHint: 'HIGH',
  },
  oracle_erp: {
    id: 'ORACLE_ERP',
    label: 'ERP (Oracle)',
    kind: 'SAAS',
    category: 'CORE_BUSINESS_SYSTEMS',
    defaultTypeLabel: 'ERP',
    defaultFunctions: ['Core business operations'],
    criticalityHint: 'HIGH',
  },
  workday_hris: {
    id: 'WORKDAY_HRIS',
    label: 'HRIS (Workday)',
    kind: 'SAAS',
    category: 'CORE_BUSINESS_SYSTEMS',
    defaultTypeLabel: 'HRIS',
    defaultFunctions: ['HR operations'],
    criticalityHint: 'MED',
  },
  adp_hris: {
    id: 'ADP_HRIS',
    label: 'HRIS (ADP Workforce Now)',
    kind: 'SAAS',
    category: 'CORE_BUSINESS_SYSTEMS',
    defaultTypeLabel: 'HRIS',
    defaultFunctions: ['HR operations'],
    criticalityHint: 'MED',
  },
  salesforce_crm: {
    id: 'SALESFORCE_CRM',
    label: 'CRM (Salesforce)',
    kind: 'SAAS',
    category: 'CORE_BUSINESS_SYSTEMS',
    defaultTypeLabel: 'CRM',
    defaultFunctions: ['Customer operations'],
    criticalityHint: 'HIGH',
  },
  stripe: {
    id: 'STRIPE',
    label: 'Stripe',
    kind: 'SAAS',
    category: 'PAYMENTS_ECOMMERCE',
    defaultTypeLabel: 'Payments/E-commerce',
    defaultFunctions: ['Payments', 'E-commerce transactions'],
    criticalityHint: 'HIGH',
  },
  paypal: {
    id: 'PAYPAL',
    label: 'PayPal',
    kind: 'SAAS',
    category: 'PAYMENTS_ECOMMERCE',
    defaultTypeLabel: 'Payments/E-commerce',
    defaultFunctions: ['Payments', 'E-commerce transactions'],
    criticalityHint: 'HIGH',
  },
  shopify: {
    id: 'SHOPIFY',
    label: 'Shopify',
    kind: 'SAAS',
    category: 'PAYMENTS_ECOMMERCE',
    defaultTypeLabel: 'Payments/E-commerce',
    defaultFunctions: ['Payments', 'E-commerce transactions'],
    criticalityHint: 'HIGH',
  },
  zoom: {
    id: 'ZOOM',
    label: 'Zoom',
    kind: 'SAAS',
    category: 'COMMS_CONTACT_CENTER',
    defaultTypeLabel: 'UC/Contact center',
    defaultFunctions: ['Voice/Meetings', 'Customer contact'],
    criticalityHint: 'MED',
  },
  ringcentral: {
    id: 'RINGCENTRAL',
    label: 'RingCentral',
    kind: 'SAAS',
    category: 'COMMS_CONTACT_CENTER',
    defaultTypeLabel: 'UC/Contact center',
    defaultFunctions: ['Voice/Meetings', 'Customer contact'],
    criticalityHint: 'MED',
  },
  webex: {
    id: 'WEBEX',
    label: 'Cisco Webex',
    kind: 'SAAS',
    category: 'COMMS_CONTACT_CENTER',
    defaultTypeLabel: 'UC/Contact center',
    defaultFunctions: ['Voice/Meetings', 'Customer contact'],
    criticalityHint: 'MED',
  },
  genesys_cloud: {
    id: 'GENESYS_CLOUD',
    label: 'Genesys Cloud',
    kind: 'SAAS',
    category: 'COMMS_CONTACT_CENTER',
    defaultTypeLabel: 'UC/Contact center',
    defaultFunctions: ['Voice/Meetings', 'Customer contact'],
    criticalityHint: 'MED',
  },
  twilio: {
    id: 'TWILIO',
    label: 'Twilio',
    kind: 'SAAS',
    category: 'COMMS_CONTACT_CENTER',
    defaultTypeLabel: 'UC/Contact center',
    defaultFunctions: ['Voice/Meetings', 'Customer contact'],
    criticalityHint: 'MED',
  },
  servicenow: {
    id: 'SERVICENOW',
    label: 'ServiceNow',
    kind: 'SAAS',
    category: 'IT_SERVICE_MONITORING',
    defaultTypeLabel: 'IT service/monitoring',
    defaultFunctions: ['IT service management'],
    criticalityHint: 'MED',
  },
  jira_confluence: {
    id: 'JIRA_CONFLUENCE',
    label: 'Atlassian Jira / Confluence',
    kind: 'SAAS',
    category: 'IT_SERVICE_MONITORING',
    defaultTypeLabel: 'IT service/monitoring',
    defaultFunctions: ['Collaboration/knowledge'],
    criticalityHint: 'MED',
  },
  datadog: {
    id: 'DATADOG',
    label: 'Datadog',
    kind: 'SAAS',
    category: 'IT_SERVICE_MONITORING',
    defaultTypeLabel: 'IT service/monitoring',
    defaultFunctions: ['Monitoring/alerting'],
    criticalityHint: 'MED',
  },
  onedrive_sharepoint: {
    id: 'ONEDRIVE_SHAREPOINT',
    label: 'Microsoft OneDrive/SharePoint',
    kind: 'SAAS',
    category: 'BACKUP_STORAGE',
    defaultTypeLabel: 'Cloud storage',
    defaultFunctions: ['File storage', 'Document access'],
    criticalityHint: 'MED',
  },
  google_drive: {
    id: 'GOOGLE_DRIVE',
    label: 'Google Drive',
    kind: 'SAAS',
    category: 'BACKUP_STORAGE',
    defaultTypeLabel: 'Cloud storage',
    defaultFunctions: ['File storage', 'Document access'],
    criticalityHint: 'MED',
  },
  dropbox_business: {
    id: 'DROPBOX_BUSINESS',
    label: 'Dropbox Business',
    kind: 'SAAS',
    category: 'BACKUP_STORAGE',
    defaultTypeLabel: 'Cloud storage',
    defaultFunctions: ['File storage', 'Document access'],
    criticalityHint: 'MED',
  },
  veeam_cloud_connect: {
    id: 'VEEAM_CLOUD_CONNECT',
    label: 'Veeam Cloud Connect',
    kind: 'SAAS',
    category: 'BACKUP_STORAGE',
    defaultTypeLabel: 'Backup/replication',
    defaultFunctions: ['Backups', 'Restore operations'],
    criticalityHint: 'HIGH',
  },
  web_eoc: {
    id: 'WEB_EOC',
    label: 'WEB EOC',
    kind: 'SAAS',
    category: 'CORE_BUSINESS_SYSTEMS',
    defaultTypeLabel: 'Core business systems',
    defaultFunctions: ['Incident coordination', 'Resource tracking'],
    criticalityHint: 'HIGH',
  },
  physical_security_systems: {
    id: 'PHYSICAL_SECURITY_SYSTEMS',
    label: 'Physical Security Systems',
    kind: 'SAAS',
    category: 'CORE_BUSINESS_SYSTEMS',
    defaultTypeLabel: 'Core business systems',
    defaultFunctions: ['Access control', 'Monitoring'],
    criticalityHint: 'MED',
  },
  other: {
    id: 'OTHER',
    label: 'Other (specify)',
    kind: 'OTHER',
    category: 'OTHER',
    defaultTypeLabel: 'Other',
    defaultFunctions: [],
    criticalityHint: 'LOW',
  },
};

/**
 * Provider names (IT-1 "IT service provider") that are internet/transport carriers.
 * These must NOT appear in Hosted/Upstream Resilience; they belong only in Internet Transport Resilience.
 * Normalized to lowercase for case-insensitive match.
 */
const TRANSPORT_ISP_PROVIDER_NAMES = new Set([
  'comcast',
  'xfinity',
  'at&t',
  'att',
  'at&t internet',
  'at&t fiber',
  'att internet',
  'att fiber',
  'verizon',
  'verizon fios',
  'verizon fios internet',
  'spectrum',
  'charter',
  'cox',
  'centurylink',
  'lumen',
  'frontier',
  'windstream',
  'earthlink',
  'optimum',
  'altice',
  'cogent',
  'zayo',
  'level3',
  'l3',
  'crown castle',
  'lumen technologies',
]);

/** Normalize provider name for lookup: lowercase, collapse spaces, remove common punctuation. */
function normalizeProviderName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[&.]/g, '');
}

/** True if this IT-1 provider name is a known transport/ISP (exclude from Hosted Resilience). */
export function isTransportProvider(providerName: string): boolean {
  if (!providerName || typeof providerName !== 'string') return false;
  const n = normalizeProviderName(providerName);
  if (TRANSPORT_ISP_PROVIDER_NAMES.has(n)) return true;
  // Substring: "Xfinity Business" → treat as transport
  for (const isp of TRANSPORT_ISP_PROVIDER_NAMES) {
    if (n.includes(isp) || isp.includes(n)) return true;
  }
  return false;
}

/**
 * True if this dependency should be excluded from the Hosted/Upstream Resilience checklist.
 * - Upstream (IT-2): exclude if registry entry has kind === 'TRANSPORT_ISP' (none in catalog today).
 * - Provider (IT-1): always excluded — continuity block is for hosted applications only, not MSP/ISP.
 */
export function isDependencyExcludedFromHostedResilience(
  dependencyId: string,
  _label: string,
  serviceId?: string
): boolean {
  // IT-1 provider row: id is "provider_<name>" — never show in continuity (ISPs and MSPs belong elsewhere).
  if (dependencyId.startsWith('provider_')) return true;
  // IT-2 upstream row: exclude only if TRANSPORT_ISP kind.
  if (serviceId != null && serviceId !== '') {
    const profile = getHostedServiceProfile(serviceId);
    return profile?.kind === 'TRANSPORT_ISP';
  }
  return false;
}

/**
 * Category for dependency for purposes of the Hosted Services continuity block.
 * Returns HOSTED_APPLICATION only for IT-2 catalog services that are not TRANSPORT_ISP.
 * IT-1 providers (and any ISP) are INTERNET_PROVIDER and must not get continuity UI.
 */
export function getProviderCategoryForContinuity(
  dependencyId: string,
  serviceId?: string
): ProviderCategory {
  if (dependencyId.startsWith('provider_')) return PROVIDER_CATEGORY.INTERNET_PROVIDER;
  if (serviceId != null && serviceId !== '') {
    const profile = getHostedServiceProfile(serviceId);
    if (profile?.kind === 'TRANSPORT_ISP') return PROVIDER_CATEGORY.INTERNET_PROVIDER;
    return PROVIDER_CATEGORY.HOSTED_APPLICATION;
  }
  return PROVIDER_CATEGORY.HOSTED_APPLICATION;
}

/** Options for upstream/hosted service dropdown (excludes TRANSPORT_ISP). Source of truth for label→id. */
export const HOSTED_SERVICE_DROPDOWN_OPTIONS = Object.entries(HOSTED_SERVICE_REGISTRY)
  .filter(([, p]) => p.kind !== 'TRANSPORT_ISP')
  .map(([key, p]) => ({ id: key, label: p.label }));

/** Map exact UI label → HostedServiceId. Includes aliases for near-duplicates. */
const LABEL_MAP = Object.fromEntries(
  Object.values(HOSTED_SERVICE_REGISTRY).map((p) => [p.label, p.id])
) as Record<string, HostedServiceId>;
const ALIASES: Record<string, HostedServiceId> = {
  AWS: 'AWS',
  Azure: 'AZURE',
  GCP: 'GCP',
  'Microsoft 365': 'M365',
  'Office 365': 'OFFICE_365',
  'Microsoft Teams': 'TEAMS',
  'Google Workspace': 'GOOGLE_WORKSPACE',
  'Entra ID': 'ENTRA_ID',
  'Palo Alto Prisma Access': 'PRISMA_ACCESS',
  'Cisco AnyConnect': 'CISCO_SECURE_CLIENT',
  'Cisco Webex': 'WEBEX',
  'Atlassian Jira / Confluence': 'JIRA_CONFLUENCE',
  Other: 'OTHER',
};
export const HOSTED_SERVICE_LABEL_TO_ID: Record<string, HostedServiceId> = { ...LABEL_MAP, ...ALIASES };

/** Resolve digital_services_catalog id (lowercase) to HostedServiceId (uppercase). */
export function catalogIdToHostedServiceId(catalogId: string): HostedServiceId | null {
  const key = catalogId.toLowerCase().trim();
  const profile = HOSTED_SERVICE_REGISTRY[key];
  return profile?.id ?? null;
}

/** Resolve UI label to HostedServiceId. */
export function labelToHostedServiceId(label: string): HostedServiceId | null {
  const trimmed = label.trim();
  return HOSTED_SERVICE_LABEL_TO_ID[trimmed] ?? null;
}

/** Get profile by catalog id (lowercase). */
export function getHostedServiceProfile(catalogId: string): HostedServiceProfile | null {
  const key = catalogId.toLowerCase().trim();
  return HOSTED_SERVICE_REGISTRY[key] ?? null;
}

/** Map HostedServiceId → catalog id (lowercase) for reverse lookup. */
const HOSTED_SERVICE_ID_TO_CATALOG: Record<HostedServiceId, string> = Object.fromEntries(
  Object.entries(HOSTED_SERVICE_REGISTRY).map(([catId, p]) => [p.id, catId])
) as Record<HostedServiceId, string>;

/** Get profile by HostedServiceId. */
export function getHostedServiceProfileById(id: HostedServiceId): HostedServiceProfile | null {
  const catalogId = HOSTED_SERVICE_ID_TO_CATALOG[id];
  return catalogId ? HOSTED_SERVICE_REGISTRY[catalogId] ?? null : null;
}
