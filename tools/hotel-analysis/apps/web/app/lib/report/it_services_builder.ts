/**
 * Build IT external services and cascade narrative from assessment.
 * Maps IT-2_upstream_assets to external_services for report.
 * Uses hosted_service_registry for Type and Supported Functions.
 */
import type { Assessment } from 'schema';
import { getDigitalServiceOption } from '@/app/lib/catalog/digital_services_catalog';
import {
  getHostedServiceProfile,
  getHostedServiceProfileById,
  labelToHostedServiceId,
  type HostedServiceCategory,
  type ItExternalServiceType,
} from './it/hosted_service_registry';
import { formatHostedResilienceForReport } from './it/hosted_resilience_migration';
import { formatHours } from './format_hours';

export type { ItExternalServiceType };

export type ItExternalService = {
  name: string;
  /** Stable id for lookup (e.g. aws, entra_id). Used so Part2 hosted rows match resilience by service_id. */
  catalog_id?: string;
  service_type: string;  // Table Type column (from profile.defaultTypeLabel, never "HostedApp")
  supports_functions: string[];
  relies_on: string[];
  cascade_effect: string;
  criticality: 'HIGH' | 'MED' | 'LOW';
  category?: HostedServiceCategory;  // For synopsis top_functions derivation
  /** Continuity: 3-state survivability label for DESIGNATION_SERVICES / External Critical Services table. */
  resilience?: string;
};

export type ItConditions = {
  single_path: boolean;
  alternate_present: boolean;
  alternate_short_duration: boolean;
  alternate_sustainment_hr: number | null;
  primary_provider: string | null;
  connection_labels: string[];
};

/** Fallback when registry has no entry (e.g. legacy data). Never returns "HostedApp". */
function groupToServiceType(group: string): string {
  if (group.includes('Identity') || group.includes('access')) return 'Identity (IdP)';
  if (group.includes('Email') || group.includes('productivity')) return 'Email/Productivity';
  if (group.includes('Cloud') || group.includes('hosting')) return 'Cloud hosting';
  if (group.includes('Network edge') || group.includes('remote access')) return 'Remote access / edge';
  if (group.includes('Communications') || group.includes('contact center')) return 'UC/Contact center';
  if (group.includes('Backups') || group.includes('storage')) return 'Cloud storage';
  if (group.includes('Core business')) return 'ERP';
  if (group.includes('Payments')) return 'Payments/E-commerce';
  if (group.includes('IT service') || group.includes('monitoring')) return 'IT service/monitoring';
  return 'Other';
}

/** Fallback when registry has no entry. */
function groupToFunctions(group: string): string[] {
  if (group.includes('Email') || group.includes('productivity'))
    return ['Email', 'Documents', 'Collaboration'];
  if (group.includes('Identity') || group.includes('access')) return ['Authentication'];
  if (group.includes('Cloud') || group.includes('hosting')) return ['Hosted applications'];
  if (group.includes('Core business')) return ['Core business operations'];
  if (group.includes('Communications')) return ['Voice', 'Video', 'Contact center'];
  if (group.includes('Backups') || group.includes('storage')) return ['Data storage', 'Backup'];
  if (group.includes('Payments')) return ['Payments', 'E-commerce'];
  if (group.includes('IT service')) return ['IT service management', 'Monitoring'];
  return ['Operational functions'];
}

function deriveCriticality(
  criticalityHint: 'HIGH' | 'MED' | 'LOW' | undefined,
  functions: string[]
): 'HIGH' | 'MED' | 'LOW' {
  if (criticalityHint) return criticalityHint;
  if (functions.some((f) => /email|auth|documents|core business|payments/i.test(f))) return 'HIGH';
  return 'MED';
}

/** Category-specific cascade effect templates (Part 3). Service-aware, no transport provider per row. */
const CASCADE_TEMPLATES: Partial<Record<HostedServiceCategory, (name: string, funcs: string) => string>> = {
  CLOUD_HOSTING: (name) =>
    `If external connectivity is degraded, access to cloud hosting (${name}) may be disrupted, affecting hosted applications and data access.`,
  EMAIL_PRODUCTIVITY: (name) =>
    `If external connectivity is degraded, email and collaboration services (${name}) may be unavailable, affecting communications and document workflows.`,
  IDENTITY_ACCESS: (name) =>
    `If identity services (${name}) are unreachable, authentication may fail, blocking access to dependent applications.`,
  NETWORK_EDGE_REMOTE_ACCESS: (name) =>
    `If edge/remote access services (${name}) are disrupted, external reachability or remote connectivity may degrade, affecting access to network-dependent functions.`,
  CORE_BUSINESS_SYSTEMS: (name, funcs) =>
    `If ${name} is unavailable, core business workflows may be disrupted, affecting ${funcs}.`,
  PAYMENTS_ECOMMERCE: (name) =>
    `If ${name} is unavailable, payment or e-commerce processing may be disrupted, affecting revenue-impacting transactions.`,
  COMMS_CONTACT_CENTER: (name) =>
    `If ${name} is unavailable, voice/meeting/contact-center functions may degrade, affecting operational coordination and customer communications.`,
  IT_SERVICE_MONITORING: (name) =>
    `If ${name} is unavailable, IT service management/monitoring may degrade, slowing incident triage and operational support.`,
  BACKUP_STORAGE: (name) =>
    `If ${name} is unavailable, document access or restore operations may be disrupted, increasing recovery friction during outages.`,
};

function buildItServiceCascade(
  service: ItExternalService,
  conditions: ItConditions,
  category?: HostedServiceCategory
): string {
  const { name, supports_functions } = service;
  const funcs = supports_functions.length > 0 ? supports_functions.join(', ') : 'operational functions';

  const template = category && CASCADE_TEMPLATES[category];
  let effect: string;
  if (template) {
    effect = template(name, funcs);
  } else {
    effect = `If ${name} is unavailable, operational functions may be disrupted, affecting ${funcs}.`;
  }

  if (conditions.alternate_present && conditions.alternate_short_duration) {
    effect += ' Alternate connectivity is short-duration and may not sustain extended outages.';
  }
  return effect;
}

/**
 * Build external services from IT-2_upstream_assets.
 * Returns empty array when not documented.
 */
export function buildItExternalServices(
  assessment: Assessment,
  conditions: ItConditions
): ItExternalService[] {
  const itCat = assessment.categories?.INFORMATION_TECHNOLOGY as Record<string, unknown> | undefined;
  const assets = (itCat?.['IT-2_upstream_assets'] as Array<Record<string, unknown>> | undefined) ?? [];
  const hostedResilienceRaw = (itCat?.it_hosted_resilience as Record<string, import('schema').ItHostedResilienceEntry> | undefined) ?? {};
  const hostedResilience: Record<string, import('schema').ItHostedResilienceEntry> = {};
  for (const [k, v] of Object.entries(hostedResilienceRaw)) {
    if (k && v != null) hostedResilience[k.toLowerCase()] = v as import('schema').ItHostedResilienceEntry;
  }

  const services: ItExternalService[] = [];
  const reliesOn: string[] = [];
  if (conditions.primary_provider && conditions.primary_provider.trim()) {
    reliesOn.push(conditions.primary_provider.trim());
  }
  for (const label of conditions.connection_labels) {
    if (label && String(label).trim()) reliesOn.push(String(label).trim());
  }
  if (reliesOn.length === 0 && conditions.primary_provider) {
    reliesOn.push('Primary internet circuit');
  }

  for (const row of assets) {
    const catalogId = (row.service_id ?? '').toString().trim();
    if (!catalogId) continue;

    const opt = catalogId === 'other' ? null : getDigitalServiceOption(catalogId);
    const name =
      catalogId === 'other'
        ? (row.service_other ?? '').toString().trim()
        : opt?.label ?? (row.service_other ?? catalogId).toString().trim();
    if (!name) continue;

    let profile = getHostedServiceProfile(catalogId);
    if (!profile && name) {
      const hid = labelToHostedServiceId(name);
      profile = hid ? getHostedServiceProfileById(hid) : null;
    }
    // Exclude transport/ISP from Hosted/Upstream Dependencies table; they belong in transport section only.
    if (profile?.kind === 'TRANSPORT_ISP') continue;

    const service_type = profile?.defaultTypeLabel ?? groupToServiceType(opt?.group ?? 'Other');
    const supports_functions =
      (row.supports_functions as string[] | undefined)?.filter(Boolean) ??
      profile?.defaultFunctions ??
      groupToFunctions(opt?.group ?? 'Other');
    const category = profile?.category;
    const criticality = deriveCriticality(profile?.criticalityHint, supports_functions);

    const dependencyKey = catalogId === 'other' ? `other_${(row.service_other ?? '').toString().trim() || 'other'}` : catalogId.toLowerCase();
    const resilienceEntry = hostedResilience[dependencyKey];

    const service: ItExternalService = {
      name,
      catalog_id: catalogId,
      service_type,
      supports_functions,
      relies_on: [...reliesOn],
      cascade_effect: '',
      criticality,
      category,
      resilience: formatHostedResilienceForReport(resilienceEntry),
    };
    service.cascade_effect = buildItServiceCascade(service, conditions, category);
    services.push(service);
  }

  return services;
}

/** Map category to human-readable function description for synopsis. */
const CATEGORY_TO_FUNCTIONS: Partial<Record<HostedServiceCategory, string>> = {
  CLOUD_HOSTING: 'hosted applications and data access',
  EMAIL_PRODUCTIVITY: 'email and collaboration',
  IDENTITY_ACCESS: 'authentication and SSO',
  NETWORK_EDGE_REMOTE_ACCESS: 'remote access and secure connectivity',
  CORE_BUSINESS_SYSTEMS: 'core business operations',
  PAYMENTS_ECOMMERCE: 'payments and e-commerce',
  COMMS_CONTACT_CENTER: 'voice, meetings, and contact center',
  IT_SERVICE_MONITORING: 'IT service management and monitoring',
  BACKUP_STORAGE: 'document access and restore operations',
};

/**
 * Build 2–3 sentence IT synopsis paragraph (Part 4).
 */
export function buildItCascadeNarrative(
  external_services: ItExternalService[],
  conditions: ItConditions
): string {
  if (external_services.length === 0) {
    return 'No external critical services were identified in provided inputs.';
  }

  const sentences: string[] = [];

  // 1) Transport path (no vendor names; reference physical path only)
  if (conditions.single_path) {
    sentences.push(
      'External IT services rely on a single documented data transport path, creating a concentrated upstream dependency.'
    );
  } else {
    sentences.push('External IT services rely on documented transport paths with some diversity.');
  }

  // 2) Hosted/upstream: reference table only; never enumerate providers or service names in narrative
  sentences.push(
    'Hosted/upstream dependencies are documented in the Hosted / Upstream Dependencies table.'
  );

  // 3) Alternate sustainment
  if (conditions.alternate_present) {
    const hr = conditions.alternate_sustainment_hr;
    const x = hr != null && Number.isFinite(hr) ? formatHours(hr) : 'limited duration';
    const mayNot = conditions.alternate_short_duration
      ? 'may not'
      : 'may';
    sentences.push(
      `Alternate connectivity sustainment is ${x} and ${mayNot} materially sustain access during extended disruptions.`
    );
  }

  return sentences.join(' ');
}
