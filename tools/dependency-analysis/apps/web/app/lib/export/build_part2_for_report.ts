/**
 * Build Part II payload (part2) from ReportVM + Assessment for reporter.
 * Reporter uses vm.part2 when present; otherwise falls back to legacy parsing.
 */
import type { Assessment } from 'schema';
import type { ReportVM } from '@/app/lib/report/view_model';
import type { CanonicalVulnBlock } from './canonical_vuln_blocks';
import { buildSummary } from 'engine';

const MAX_OFC_PER_VULN = 4;

const CATEGORY_DISPLAY: Record<string, string> = {
  ELECTRIC_POWER: 'Electric Power',
  COMMUNICATIONS: 'Communications',
  INFORMATION_TECHNOLOGY: 'Information Technology',
  WATER: 'Water',
  WASTEWATER: 'Wastewater',
  CRITICAL_PRODUCTS: 'Critical Products',
};

export type Part2InternetTransportRow = {
  role: string;
  provider: string;
  demarcation: string;
  independence: string;
  notes: string;
};

export type Part2CriticalHostedRow = {
  service: string;
  provider: string;
  service_loss_effect: string;
  continuity_strategy: string;
  notes: string;
};

export type Part2Vulnerability = {
  id: string;
  /** Sector code (e.g. ELECTRIC_POWER) for reporter/QC. */
  sectorCode?: string;
  severity: string;
  title: string;
  narrative: string;
  ofcs: string[];
  references?: string[];
};

export type Part2DependencySummaryRow = {
  category: string;
  primary_provider: string;
  backup_present: string;
  time_to_severe_impact_hrs: string;
  recovery_time_hrs: string;
  notes: string;
};

export type Part2 = {
  internet_transport_rows: Part2InternetTransportRow[];
  critical_hosted_services_rows: Part2CriticalHostedRow[];
  vulnerabilities: Part2Vulnerability[];
  dependency_summary_rows: Part2DependencySummaryRow[];
};

function normalizeProviderName(s: string): string {
  return (s ?? '').trim().toLowerCase();
}

function compactProviderName(s: string): string {
  return normalizeProviderName(s).replace(/[^a-z0-9]/g, '');
}

function humanizeIndependence(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  if (upper === 'UNKNOWN') return 'Unknown';
  if (upper === 'DIFFERENT_LOOP_OR_PATH') return 'Different loop or path';
  if (upper === 'SAME_DEMARCATION') return 'Same demarcation';
  if (upper === 'CONFIRMED') return 'Confirmed';
  if (upper === 'NOT_CONFIRMED') return 'Not confirmed';
  return raw;
}

function toYesNoUnknown(value: unknown): 'yes' | 'no' | 'unknown' {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'yes' || v === 'y' || v === 'true' || v === '1') return 'yes';
  if (v === 'no' || v === 'n' || v === 'false' || v === '0') return 'no';
  return 'unknown';
}

function buildInternetTransportRows(assessment: Assessment): Part2InternetTransportRow[] {
  const itCat = (assessment.categories as Record<string, unknown>)?.['INFORMATION_TECHNOLOGY'] as Record<string, unknown> | undefined;
  const notProvided = 'Not provided';
  const emDash = '—';
  if (!itCat) {
    return [{ role: 'Primary Internet Provider', provider: 'Not provided', demarcation: notProvided, independence: notProvided, notes: emDash }];
  }
  const answers = (itCat.answers as Record<string, unknown> | undefined) ?? {};
  const primary = String(itCat.curve_primary_provider ?? answers.curve_primary_provider ?? '').trim();
  const secondary = String(itCat.curve_secondary_provider ?? answers.curve_secondary_provider ?? '').trim();
  const providers: Array<{ role: string; name: string }> = [];
  if (primary) providers.push({ role: 'Primary Internet Provider', name: primary });
  if (secondary) providers.push({ role: 'Secondary Internet Provider', name: secondary });
  if (providers.length === 0) {
    return [{ role: 'Primary Internet Provider', provider: 'Not provided', demarcation: notProvided, independence: notProvided, notes: emDash }];
  }

  const supply = (itCat.supply ?? answers.supply) as { sources?: Array<Record<string, unknown>> } | undefined;
  const sources = supply?.sources ?? [];
  const byName: Record<string, Record<string, unknown>> = {};
  const byCompactName: Record<string, Record<string, unknown>> = {};
  for (const src of sources) {
    const name = (src?.provider_name as string)?.trim();
    if (name) {
      byName[normalizeProviderName(name)] = src;
      byCompactName[compactProviderName(name)] = src;
    }
  }
  const itConnections =
    (itCat['IT-4_service_connections'] ?? answers['IT-4_service_connections']) as
      | Array<Record<string, unknown>>
      | undefined;
  const connections = Array.isArray(itConnections) ? itConnections : [];

  function formatDemarcation(src: Record<string, unknown>): string {
    const desc = (src.demarcation_description as string)?.trim();
    if (desc) return desc;
    const lat = src.demarcation_lat;
    const lon = src.demarcation_lon;
    if (lat != null && lon != null) return `${lat}, ${lon}`;
    return '';
  }

  function emptyToNotProvided(s: string): string {
    return (s ?? '').trim() || 'Not provided';
  }

  function notesForRow(src?: Record<string, unknown>, conn?: Record<string, unknown>): string {
    if (!src && !conn) return '—';
    const srcObj = src ?? {};
    const note = (srcObj.notes as string)?.trim();
    if (note) return note;
    const demarc = src ? formatDemarcation(src) : '';
    const connDemarc = ((conn?.facility_entry_location as string) ?? '').trim();
    const ind = humanizeIndependence(srcObj.independence);
    if (demarc || connDemarc || ind) return 'Reported sources: 1';
    return '—';
  }

  function findConnectionForProvider(provider: string, index: number): Record<string, unknown> | undefined {
    if (connections.length === 0) return undefined;
    const n = normalizeProviderName(provider);
    const compact = compactProviderName(provider);
    const exact = connections.find((c) => normalizeProviderName(String(c.associated_provider ?? '')) === n);
    if (exact) return exact;
    const fuzzy = connections.find((c) => {
      const candidate = String(c.associated_provider ?? '');
      const nc = normalizeProviderName(candidate);
      const cc = compactProviderName(candidate);
      return nc.includes(n) || n.includes(nc) || cc.includes(compact) || compact.includes(cc);
    });
    if (fuzzy) return fuzzy;
    return connections[index];
  }

  function findSourceForProvider(provider: string, index: number): Record<string, unknown> | undefined {
    const n = normalizeProviderName(provider);
    const compact = compactProviderName(provider);
    const exact = byName[n];
    if (exact) return exact;
    const compactMatch = byCompactName[compact];
    if (compactMatch) return compactMatch;
    const fuzzy = sources.find((src) => {
      const candidate = String(src.provider_name ?? '');
      const nc = normalizeProviderName(candidate);
      const cc = compactProviderName(candidate);
      return nc.includes(n) || n.includes(nc) || cc.includes(compact) || compact.includes(cc);
    });
    if (fuzzy) return fuzzy;
    return sources[index];
  }

  return providers.map(({ role, name }, idx) => {
    const src = findSourceForProvider(name, idx);
    const conn = findConnectionForProvider(name, idx);
    const demarcFromSource = src ? formatDemarcation(src) : '';
    const demarcFromConnection = ((conn?.facility_entry_location as string) ?? '').trim();
    const physicalSeparation = toYesNoUnknown(itCat['IT-4_physically_separated'] ?? answers['IT-4_physically_separated']);
    const demarcationHint =
      physicalSeparation === 'no'
        ? 'Shared facility entry (not physically separated)'
        : '';
    const demarcation = emptyToNotProvided(demarcFromSource || demarcFromConnection || demarcationHint);

    const transport = (itCat.it_transport_resilience ?? answers.it_transport_resilience) as Record<string, unknown> | undefined;
    const routeInd = humanizeIndependence(transport?.transport_route_independence);
    const physicallySeparated = physicalSeparation;
    const independenceFromSource = humanizeIndependence(src?.independence);
    const independence =
      emptyToNotProvided(
        independenceFromSource ||
          routeInd ||
          (physicallySeparated === 'yes'
            ? 'Physically separated'
            : physicallySeparated === 'no'
              ? 'Not physically separated'
              : '')
      );

    const notes = notesForRow(src, conn);
    return { role, provider: name, demarcation, independence, notes };
  });
}

const TRANSPORT_PROVIDER_KEYWORDS = ['isp', 'internet', 'broadband', 'fiber', 'verizon', 'comcast', 'at&t', 'att', 'xfinity', 'spectrum', 'centurylink', 'frontier', 'cox', 'optimum', 'windstream', 'lumen', 'zayo'];

function isTransportProvider(provider: string): boolean {
  const lower = provider.toLowerCase();
  return TRANSPORT_PROVIDER_KEYWORDS.some((k) => lower.includes(k));
}

/** Display names for hosted services in the report table (service column). */
const SERVICE_DISPLAY_NAMES: Record<string, string> = {
  aws: 'Cloud Compute / Cloud Infrastructure',
  cloudflare: 'DNS / CDN',
  zscaler: 'Secure Internet Gateway / Zero Trust',
  adp_hris: 'HR Information System',
  salesforce_crm: 'Customer Relationship Management',
  entra_id: 'Identity and Access Management',
};

/** Plain-language description of what is lost if the hosted service is unreachable (matches reporter). No vendor names. */
const SERVICE_LOSS_DESCRIPTIONS: Record<string, string> = {
  aws: 'Loss of hosted compute used to run business applications and services.',
  azure: 'Loss of hosted compute used to run business applications and services.',
  gcp: 'Loss of hosted compute used to run business applications and services.',
  m365: 'Loss of email, calendaring, and collaboration tooling used for coordination.',
  office_365: 'Loss of email, calendaring, and collaboration tooling used for coordination.',
  teams: 'Loss of video and chat collaboration used for coordination.',
  google_workspace: 'Loss of email, calendaring, and collaboration tooling used for coordination.',
  entra_id: 'Loss of centralized authentication/authorization used for application access.',
  okta: 'Loss of centralized authentication/authorization used for application access.',
  salesforce_crm: 'Loss of customer relationship management and customer operations.',
  sap_erp: 'Loss of ERP and core business operations systems.',
  servicenow: 'Loss of IT service management and ticketing.',
  zoom: 'Loss of video and voice meetings.',
  cloudflare: 'Loss of name resolution and/or content delivery that supports public and internal services.',
  zscaler: 'Loss of controlled access to external internet and remote access policy enforcement.',
  onedrive_sharepoint: 'Loss of access to stored files/objects used for operations and applications.',
  google_drive: 'Loss of access to stored files/objects used for operations and applications.',
};

function serviceLossDescription(serviceId: string): string {
  const key = (serviceId ?? '').trim().toLowerCase();
  if (!key || key === 'other') return 'Hosted Application Service';
  return SERVICE_LOSS_DESCRIPTIONS[key] ?? 'Hosted Application Service';
}

function buildCriticalHostedRows(assessment: Assessment, reportVM: ReportVM): Part2CriticalHostedRow[] {
  const itCat = (assessment.categories as Record<string, unknown>)?.['INFORMATION_TECHNOLOGY'] as Record<string, unknown> | undefined;
  const upstreamRaw = (itCat?.['IT-2_upstream_assets'] ?? (itCat?.answers as Record<string, unknown>)?.['IT-2_upstream_assets']) as Array<Record<string, unknown>> | undefined;
  const upstream = Array.isArray(upstreamRaw) ? upstreamRaw.filter((u) => u && typeof u === 'object') : [];
  const itInfra = reportVM.infrastructures?.find((i) => i.code === 'INFORMATION_TECHNOLOGY');
  const externalServices = itInfra?.external_services ?? [];
  const byCatalogId: Record<string, string> = {};
  for (const es of externalServices) {
    const catalogId = (es as { catalog_id?: string }).catalog_id?.trim().toLowerCase();
    const resilience = (es as { resilience?: string }).resilience;
    if (catalogId) byCatalogId[catalogId] = resilience ?? 'Not assessed';
  }

  const rows: Part2CriticalHostedRow[] = [];
  for (const u of upstream) {
    const provider = ((u.service_provider ?? u.provider) as string)?.trim() || 'Not provided';
    if (isTransportProvider(provider)) continue;
    const serviceId = (u.service_id as string)?.trim();
    const serviceOther = (u.service_other as string)?.trim();
    const idLower = String(serviceId).toLowerCase();
    const serviceLabel =
      (idLower === 'other' && serviceOther) ? serviceOther
        : (SERVICE_DISPLAY_NAMES[idLower] ?? (serviceId || 'Unknown service'));
    const serviceLoss = serviceLossDescription(serviceId || '');
    const resilience = byCatalogId[idLower] ?? 'Not assessed';
    rows.push({
      service: serviceLabel,
      provider,
      service_loss_effect: serviceLoss,
      continuity_strategy: resilience,
      notes: '—',
    });
  }
  if (rows.length === 0) {
    rows.push({
      service: 'No critical hosted services identified.',
      provider: '—',
      service_loss_effect: '—',
      continuity_strategy: '—',
      notes: '—',
    });
  }
  return rows;
}

const SUMMARY_ORDER = ['ELECTRIC_POWER', 'COMMUNICATIONS', 'INFORMATION_TECHNOLOGY', 'WATER', 'WASTEWATER', 'CRITICAL_PRODUCTS'];
const SEVERITY_ORDER = ['HIGH', 'ELEVATED', 'MODERATE', 'LOW'] as const;

function splitOfcText(ofcText: string): string[] {
  if (!ofcText || typeof ofcText !== 'string') return [];
  const t = ofcText.replace(/\u00a0/g, ' ').trim();
  if (!t) return [];
  const parts = t
    .split(/\n+|[\u2022\u2023]+|(?:(?<=^)|(?<=\n))\s*(?:[-*]|\d+[.)])\s+/)
    .map((p) => {
      let v = p.trim();
      let prev = '';
      while (v && v !== prev) {
        prev = v;
        v = v.replace(/^\s*(?:[\u2022\u2023\-*]+|\(?\d+[.)]\)?|[A-Za-z][.)])\s*/, '').trim();
        v = v.replace(/^\s*:\s*/, '').trim();
      }
      return v;
    })
    .filter(Boolean);
  return parts.slice(0, MAX_OFC_PER_VULN);
}

function sanitizeReferences(references: string[] | undefined): string[] {
  if (!Array.isArray(references)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const ref of references) {
    const t = (ref ?? '').trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function buildVulnerabilitiesFromCanonicalBlocks(canonicalVulnBlocks: CanonicalVulnBlock[]): Part2Vulnerability[] {
  const out: Part2Vulnerability[] = [];
  for (const b of canonicalVulnBlocks) {
    const title = (b.title ?? '').trim();
    const narrative = (b.narrative ?? '').trim();
    if (!title || (!narrative && !(b.ofcText ?? '').trim())) continue;
    const sev = (b.severity ?? '').trim();
    const severity = SEVERITY_ORDER.includes(sev as (typeof SEVERITY_ORDER)[number]) ? sev : '';
    out.push({
      id: (b.vuln_id ?? '').trim() || `cb-${b.domain}-${out.length}`,
      sectorCode: b.domain,
      severity,
      title,
      narrative,
      ofcs: splitOfcText(b.ofcText ?? ''),
      references: sanitizeReferences(b.references),
    });
  }
  return out;
}

function buildDependencySummaryRows(assessment: Assessment): Part2DependencySummaryRow[] {
  const rows = buildSummary(assessment);
  const byCategory = new Map<string, Part2DependencySummaryRow>();
  for (const r of rows) {
    const category = r.category as string;
    const display = CATEGORY_DISPLAY[category] ?? category;
    const isCriticalProducts = category === 'CRITICAL_PRODUCTS';
    byCategory.set(category, {
      category: display,
      primary_provider: isCriticalProducts ? 'N/A' : (r.sources != null ? 'Yes' : 'No'),
      backup_present: isCriticalProducts ? 'N/A' : (r.has_backup ? 'Yes' : 'No'),
      time_to_severe_impact_hrs: isCriticalProducts ? 'N/A' : (r.time_to_impact_hours == null ? 'N/A' : String(r.time_to_impact_hours)),
      recovery_time_hrs: isCriticalProducts ? 'N/A' : (r.recovery_time_hours == null ? 'N/A' : String(r.recovery_time_hours)),
      notes: isCriticalProducts ? '—' : (r.sources?.trim() || '—'),
    });
  }
  const out: Part2DependencySummaryRow[] = [];
  for (const code of SUMMARY_ORDER) {
    const row = byCategory.get(code);
    if (row) out.push(row);
  }
  if (!out.some((row) => row.category === 'Critical Products')) {
    out.push({
      category: 'Critical Products',
      primary_provider: 'N/A',
      backup_present: 'N/A',
      time_to_severe_impact_hrs: 'N/A',
      recovery_time_hrs: 'N/A',
      notes: '—',
    });
  }
  return out;
}

/**
 * Build Part II structure for reporter. When payload.report_vm.part2 exists, reporter uses it for
 * Internet Transport, Critical Hosted Services, Vulnerabilities, and Dependency Summary.
 * Vulnerabilities are canonical-only (true assessment-derived data; no fallback synthesis paths).
 */
export function buildPart2ForReport(
  reportVM: ReportVM,
  assessment: Assessment,
  canonicalVulnBlocks: CanonicalVulnBlock[] = []
): Part2 {
  const vulnerabilities = buildVulnerabilitiesFromCanonicalBlocks(canonicalVulnBlocks);
  return {
    internet_transport_rows: buildInternetTransportRows(assessment),
    critical_hosted_services_rows: buildCriticalHostedRows(assessment, reportVM),
    vulnerabilities,
    dependency_summary_rows: buildDependencySummaryRows(assessment),
  };
}
