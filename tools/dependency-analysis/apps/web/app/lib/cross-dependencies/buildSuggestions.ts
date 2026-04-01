/**
 * Self-driven cross-dependency auto-suggest engine.
 * Uses ONLY existing answered data; deterministic, no drift.
 */
import type { Assessment, CategoryCode, CrossDependencyEdge, CrossDependencyCategory } from 'schema';
import { getDigitalServiceOption } from '@/app/lib/catalog/digital_services_catalog';

const INFRA_CATEGORIES: CategoryCode[] = [
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
];

/** Confidence level for suggestion reasoning. */
export type SuggestionConfidence = 'ASSUMED' | 'INFERRED' | 'USER_CONFIRMED';

/** Reasoning payload for a suggested edge. */
export type SuggestionReason = {
  drivers: string[];
  sources: string[];
  downstream_failures?: string[];
  confidence: SuggestionConfidence;
};

/** Suggested edge with explainability. */
export type SuggestedEdge = CrossDependencyEdge & {
  reason: SuggestionReason;
};

export type DownstreamFailureIndicator = {
  category: CrossDependencyCategory;
  failures: string[];
  sources: string[];
};

const DOWNSTREAM_CATEGORY_ORDER: CrossDependencyCategory[] = [
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
];

const COMM_FUNCTION_LABELS: Record<string, string> = {
  SECURITY_COORDINATION: 'security coordination',
  EXEC_LEADERSHIP: 'executive leadership communications',
  EMERGENCY_RESPONSE: 'emergency response coordination',
  FACILITY_OPERATIONS: 'facility operations coordination',
  PUBLIC_MESSAGING: 'public messaging',
  DISPATCH_OPERATIONS: 'dispatch operations',
  OTHER: 'other command-and-control functions',
};

function uniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items.filter((v) => typeof v === 'string' && v.trim() !== '').map((v) => v.trim())));
}

function formatListPreview(items: string[], maxItems = 3): string {
  const deduped = uniqueStrings(items);
  if (deduped.length === 0) return '';
  if (deduped.length <= maxItems) return deduped.join(', ');
  return `${deduped.slice(0, maxItems).join(', ')} (+${deduped.length - maxItems} more)`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value == null || typeof value !== 'object') return undefined;
  return value as Record<string, unknown>;
}

function buildCommsDownstream(cats: Record<string, unknown>): DownstreamFailureIndicator | null {
  const comm = asRecord(cats.COMMUNICATIONS);
  if (!comm) return null;
  const failures: string[] = [];
  const sources: string[] = [];

  const functions = Array.isArray(comm.comm_voice_functions)
    ? uniqueStrings(
        comm.comm_voice_functions.map((f) => COMM_FUNCTION_LABELS[String(f)] ?? String(f).replace(/_/g, ' ').toLowerCase())
      )
    : [];
  if (functions.length > 0) {
    failures.push(`Command-and-control functions affected: ${formatListPreview(functions, 4)}.`);
    sources.push('COMMUNICATIONS.comm_voice_functions');
  }

  if (comm.comm_single_point_voice_failure === 'yes') {
    failures.push('Single voice pathway can disrupt dispatch and incident coordination.');
    sources.push('COMMUNICATIONS.comm_single_point_voice_failure');
  }

  if (comm.curve_requires_service === true && failures.length === 0) {
    failures.push('Loss of voice transport disrupts command-and-control and incident coordination.');
    sources.push('COMMUNICATIONS.curve_requires_service');
  }

  if (failures.length === 0) return null;
  return {
    category: 'COMMUNICATIONS',
    failures: uniqueStrings(failures),
    sources: uniqueStrings(sources),
  };
}

function buildItDownstream(cats: Record<string, unknown>): DownstreamFailureIndicator | null {
  const it = asRecord(cats.INFORMATION_TECHNOLOGY);
  if (!it) return null;
  const failures: string[] = [];
  const sources: string[] = [];

  const assets = Array.isArray(it['IT-2_upstream_assets'])
    ? (it['IT-2_upstream_assets'] as Array<Record<string, unknown>>)
    : [];
  const serviceNames = uniqueStrings(
    assets
      .map((row) => {
        const sid = String(row?.service_id ?? '').trim().toLowerCase();
        if (!sid) return '';
        if (sid === 'other') return String(row?.service_other ?? '').trim() || 'Other hosted service';
        return getDigitalServiceOption(sid)?.label ?? sid.replace(/_/g, ' ');
      })
      .filter((name) => name !== 'internet transport' && name !== 'other transport')
  );
  if (serviceNames.length > 0) {
    failures.push(`Critical hosted services become unreachable: ${formatListPreview(serviceNames, 3)}.`);
    sources.push('INFORMATION_TECHNOLOGY.IT-2_upstream_assets');
  }

  const hostedRes = asRecord(it.it_hosted_resilience) ?? {};
  const hostedValues = Object.values(hostedRes).map((entry) => asRecord(entry));
  const noContinuityCount = hostedValues.filter((entry) => entry?.survivability === 'NO_CONTINUITY').length;
  const unknownCount = hostedValues.filter((entry) => entry?.survivability === 'UNKNOWN').length;
  if (noContinuityCount > 0) {
    failures.push(`No continuity documented for ${noContinuityCount} hosted service(s).`);
    sources.push('INFORMATION_TECHNOLOGY.it_hosted_resilience');
  }
  if (unknownCount > 0) {
    failures.push(`Continuity posture is unknown for ${unknownCount} hosted service(s).`);
    sources.push('INFORMATION_TECHNOLOGY.it_hosted_resilience');
  }

  if (it.requires_service === true && failures.length === 0) {
    failures.push('Loss of internet/data connectivity disrupts hosted digital operations.');
    sources.push('INFORMATION_TECHNOLOGY.requires_service');
  }

  if (failures.length === 0) return null;
  return {
    category: 'INFORMATION_TECHNOLOGY',
    failures: uniqueStrings(failures),
    sources: uniqueStrings(sources),
  };
}

function buildWaterDownstream(cats: Record<string, unknown>): DownstreamFailureIndicator | null {
  const water = asRecord(cats.WATER);
  if (!water) return null;
  const failures: string[] = [];
  const sources: string[] = [];

  if (water.W_Q14_onsite_pumping === 'yes') {
    failures.push('Water pumps/boosters are required to maintain usable pressure.');
    sources.push('WATER.W_Q14_onsite_pumping');
  }
  if (water.W_Q15_backup_power_pumps === 'no' || water.W_Q15_backup_power_pumps === 'unknown') {
    failures.push('Water pumping continuity is weak without confirmed backup power.');
    sources.push('WATER.W_Q15_backup_power_pumps');
  }
  if (water.W_Q17_pump_alarming === 'no' || water.W_Q17_pump_alarming === 'unknown') {
    failures.push('Pump failure or low-pressure detection is limited or not confirmed.');
    sources.push('WATER.W_Q17_pump_alarming');
  }
  if (water.W_Q11_water_based_suppression === 'yes') {
    failures.push('Water-based fire suppression capability depends on water system continuity.');
    sources.push('WATER.W_Q11_water_based_suppression');
  }

  if (failures.length === 0) return null;
  return {
    category: 'WATER',
    failures: uniqueStrings(failures),
    sources: uniqueStrings(sources),
  };
}

function buildWastewaterDownstream(cats: Record<string, unknown>): DownstreamFailureIndicator | null {
  const ww = asRecord(cats.WASTEWATER);
  if (!ww) return null;
  const failures: string[] = [];
  const sources: string[] = [];

  if (ww.WW_Q8_onsite_pumping === 'yes') {
    failures.push('Wastewater lift/ejector pumps are required for discharge continuity.');
    sources.push('WASTEWATER.WW_Q8_onsite_pumping');
  }
  if (ww.WW_Q9_backup_power_pumps === 'no' || ww.WW_Q9_backup_power_pumps === 'unknown') {
    failures.push('Wastewater pumping continuity is weak without confirmed backup power.');
    sources.push('WASTEWATER.WW_Q9_backup_power_pumps');
  }
  if (ww.WW_Q11_pump_alarming === 'no' || ww.WW_Q11_pump_alarming === 'unknown') {
    failures.push('Detection for pump failure, high level, or backflow risk is limited or unknown.');
    sources.push('WASTEWATER.WW_Q11_pump_alarming');
  }
  if (ww.WW_Q13_holding_capacity === 'no' || ww.WW_Q13_holding_capacity === 'unknown') {
    failures.push('Holding/containment capacity may be insufficient during sustained outages.');
    sources.push('WASTEWATER.WW_Q13_holding_capacity');
  }

  if (failures.length === 0) return null;
  return {
    category: 'WASTEWATER',
    failures: uniqueStrings(failures),
    sources: uniqueStrings(sources),
  };
}

function buildElectricDownstream(cats: Record<string, unknown>): DownstreamFailureIndicator | null {
  const power = asRecord(cats.ELECTRIC_POWER);
  if (!power) return null;
  const failures: string[] = [];
  const sources: string[] = [];

  const water = asRecord(cats.WATER);
  if (water?.W_Q14_onsite_pumping === 'yes') {
    failures.push('Water pumps/boosters can fail to maintain pressure when electric power is lost.');
    sources.push('WATER.W_Q14_onsite_pumping');
  }

  const ww = asRecord(cats.WASTEWATER);
  if (ww?.WW_Q8_onsite_pumping === 'yes') {
    failures.push('Wastewater lift/ejector pumping can fail during electric outages.');
    sources.push('WASTEWATER.WW_Q8_onsite_pumping');
  }

  const comm = asRecord(cats.COMMUNICATIONS);
  const commFns = Array.isArray(comm?.comm_voice_functions) ? comm?.comm_voice_functions.length : 0;
  if (comm?.curve_requires_service === true || commFns > 0) {
    failures.push('Command-and-control voice and dispatch functions can degrade during power loss.');
    sources.push('COMMUNICATIONS.curve_requires_service');
    if (commFns > 0) sources.push('COMMUNICATIONS.comm_voice_functions');
  }

  const it = asRecord(cats.INFORMATION_TECHNOLOGY);
  const itAssets = Array.isArray(it?.['IT-2_upstream_assets']) ? it['IT-2_upstream_assets'].length : 0;
  if (it?.requires_service === true || itAssets > 0) {
    failures.push('Network transport equipment and access to critical hosted services can degrade during power loss.');
    sources.push('INFORMATION_TECHNOLOGY.requires_service');
    if (itAssets > 0) sources.push('INFORMATION_TECHNOLOGY.IT-2_upstream_assets');
  }

  if (power.requires_service === true && failures.length === 0) {
    failures.push('Loss of commercial power can cascade across dependent infrastructure operations.');
    sources.push('ELECTRIC_POWER.requires_service');
  }

  if (failures.length === 0) return null;
  return {
    category: 'ELECTRIC_POWER',
    failures: uniqueStrings(failures),
    sources: uniqueStrings(sources),
  };
}

/** Build a per-infrastructure list of likely downstream operational failures from completed answers. */
export function buildDownstreamFailureIndicators(assessment: Assessment): DownstreamFailureIndicator[] {
  const cats = (assessment.categories ?? {}) as Record<string, unknown>;
  const indicators = [
    buildElectricDownstream(cats),
    buildCommsDownstream(cats),
    buildItDownstream(cats),
    buildWaterDownstream(cats),
    buildWastewaterDownstream(cats),
  ].filter((x): x is DownstreamFailureIndicator => x != null && x.failures.length > 0);

  return indicators.sort(
    (a, b) =>
      DOWNSTREAM_CATEGORY_ORDER.indexOf(a.category) - DOWNSTREAM_CATEGORY_ORDER.indexOf(b.category)
  );
}

/** Time-to-cascade bucket from hours. */
function timeToCascadeBucket(hours: number): 'immediate' | 'short' | 'medium' | 'long' {
  if (hours <= 1) return 'immediate';
  if (hours <= 6) return 'short';
  if (hours <= 24) return 'medium';
  return 'long';
}

/** Compute stable hash of input signals for suggestion logic. */
export function computeSuggestionHash(assessment: Assessment): string {
  const parts: string[] = [];
  const cats = assessment.categories ?? {};
  for (const code of INFRA_CATEGORIES) {
    const c = cats[code];
    if (!c || typeof c !== 'object') continue;
    const obj = c as Record<string, unknown>;
    parts.push(`${code}:rs=${obj.requires_service}`);
    parts.push(`${code}:hb=${obj.has_backup_any ?? obj.has_backup}`);
    parts.push(`${code}:bt=${obj.backup_type ?? ''}`);
    parts.push(`${code}:tti=${obj.time_to_impact_hours ?? ''}`);
    parts.push(`${code}:rt=${obj.recovery_time_hours ?? ''}`);
  }
  const cp = cats.CRITICAL_PRODUCTS as { critical_products?: Array<{ single_source?: boolean | null; alternate_supplier_identified?: boolean | null }> } | undefined;
  const rows = cp?.critical_products ?? [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r) parts.push(`cp:${i}:ss=${r.single_source}`);
    if (r) parts.push(`cp:${i}:alt=${r.alternate_supplier_identified}`);
  }
  const str = parts.join('|');
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return `s${Math.abs(h).toString(36)}`;
}

/** Build suggested cross-dependency edges from assessment. De-duplicated by (from,to,purpose). */
export function buildCrossDependencySuggestions(
  assessment: Assessment,
  rejectedKeys: Set<string>
): SuggestedEdge[] {
  const suggestions: SuggestedEdge[] = [];
  const seen = new Set<string>();
  const cats = assessment.categories ?? {};
  const downstreamByCategory = new Map(
    buildDownstreamFailureIndicators(assessment).map((d) => [d.category, d] as const)
  );

  const edgeKey = (from: string, to: string, purpose: string) => `${from}→${to}:${purpose}`;
  const add = (e: SuggestedEdge) => {
    const k = edgeKey(e.from_category, e.to_category, e.purpose);
    if (seen.has(k) || rejectedKeys.has(k)) return;
    if (e.from_category === e.to_category) return; // no self-loops
    const downstream = downstreamByCategory.get(e.to_category);
    const mergedReason: SuggestionReason = downstream
      ? {
          ...e.reason,
          downstream_failures: uniqueStrings([
            ...(e.reason.downstream_failures ?? []),
            ...downstream.failures,
          ]),
          sources: uniqueStrings([...e.reason.sources, ...downstream.sources]),
        }
      : e.reason;
    seen.add(k);
    suggestions.push({ ...e, reason: mergedReason });
  };

  // RULE 1 — Requires service implies power dependency
  for (const code of INFRA_CATEGORIES) {
    if (code === 'ELECTRIC_POWER') continue;
    const c = cats[code];
    if (!c || typeof c !== 'object') continue;
    const obj = c as Record<string, unknown>;
    if (obj.requires_service !== true) continue;

    const tti = obj.time_to_impact_hours;
    const hours = typeof tti === 'number' && Number.isFinite(tti) ? Math.min(1, tti / 2) : 1;
    const timeBucket = timeToCascadeBucket(hours);

    const drivers: string[] = ['Category is required for primary operations.'];
    if (timeBucket === 'immediate') {
      drivers.push('Impact timing indicates immediate disruption.');
    }
    
    add({
      from_category: 'ELECTRIC_POWER' as CrossDependencyCategory,
      to_category: code as CrossDependencyCategory,
      purpose: 'primary_operations',
      criticality: 'critical',
      time_to_cascade_bucket: timeBucket,
      single_path: 'unknown',
      confidence: 'assumed',
      source: 'auto_suggest',
      reason: {
        drivers,
        sources: [`${code}.requires_service`, `${code}.time_to_impact_hours`],
        confidence: 'ASSUMED',
      },
    });
  }

  // RULE 2 — Backup method (Generator/Stored supply) implies restoration dependency on Critical Products
  const backupTypeLabels = ['Generator', 'Stored supply', 'generator', 'stored supply'];
  for (const code of INFRA_CATEGORIES) {
    const c = cats[code];
    if (!c || typeof c !== 'object') continue;
    const obj = c as Record<string, unknown>;
    const hasBackup = obj.has_backup_any === true || obj.has_backup === true;
    if (!hasBackup) continue;

    const bt = (obj.backup_type ?? '') as string;
    if (!backupTypeLabels.some((l) => bt.toLowerCase().includes(l.toLowerCase()))) continue;

    add({
      from_category: 'CRITICAL_PRODUCTS' as CrossDependencyCategory,
      to_category: code as CrossDependencyCategory,
      purpose: 'restoration_recovery',
      criticality: 'important',
      time_to_cascade_bucket: 'medium',
      single_path: 'unknown',
      confidence: 'assumed',
      source: 'auto_suggest',
      reason: {
        drivers: [
          'Backup method requires external supplies.',
          'Single upstream category supports critical restoration.',
        ],
        sources: [`${code}.has_backup`, `${code}.backup_type`],
        confidence: 'INFERRED',
      },
    });
  }

  // RULE 3 — Alternate service provider: no auto-edge (ambiguous). Skip.

  // RULE 4 — IT hosted/upstream services imply data transport dependency.
  // If IT upstream assets are documented, suggest COMMUNICATIONS -> INFORMATION_TECHNOLOGY.
  {
    const it = cats.INFORMATION_TECHNOLOGY as Record<string, unknown> | undefined;
    const requiresIt = it?.requires_service === true;
    const assets = (it?.['IT-2_upstream_assets'] as Array<Record<string, unknown>> | undefined) ?? [];
    const hostedCount = assets.filter((r) => {
      const sid = String(r?.service_id ?? '').toLowerCase();
      return sid && sid !== 'internet_transport' && sid !== 'other_transport';
    }).length;
    if (requiresIt && hostedCount > 0) {
      const tti = it?.time_to_impact_hours;
      const ttiHours = typeof tti === 'number' && Number.isFinite(tti) ? tti : 6;
      const bucket = timeToCascadeBucket(Math.min(ttiHours, 6));
      const tr = (it?.it_transport_resilience as Record<string, unknown> | undefined) ?? {};
      const connCount = typeof tr.transport_connection_count === 'number' ? tr.transport_connection_count : null;
      const circuit = typeof tr.circuit_count === 'string' ? tr.circuit_count : '';
      const singlePath =
        connCount === 1 || circuit === 'ONE'
          ? 'yes'
          : connCount !== null && connCount >= 2
            ? 'no'
            : 'unknown';
      const noContinuityCount = Object.values((it?.it_hosted_resilience as Record<string, { survivability?: string }> | undefined) ?? {}).filter(
        (v) => v?.survivability === 'NO_CONTINUITY'
      ).length;

      add({
        from_category: 'COMMUNICATIONS' as CrossDependencyCategory,
        to_category: 'INFORMATION_TECHNOLOGY' as CrossDependencyCategory,
        purpose: 'primary_operations',
        criticality: noContinuityCount > 0 ? 'critical' : 'important',
        time_to_cascade_bucket: bucket,
        single_path: singlePath,
        confidence: 'documented',
        source: 'auto_suggest',
        reason: {
          drivers: [
            `${hostedCount} hosted/upstream IT service(s) are documented.`,
            noContinuityCount > 0
              ? `${noContinuityCount} hosted service(s) show no continuity posture.`
              : 'Hosted services require external data transport reachability.',
          ],
          sources: ['INFORMATION_TECHNOLOGY.IT-2_upstream_assets', 'INFORMATION_TECHNOLOGY.it_transport_resilience', 'INFORMATION_TECHNOLOGY.it_hosted_resilience'],
          confidence: 'INFERRED',
        },
      });
    }
  }

  // RULE 5 — Monitoring/control: not auto-assumed. Skip.

  return suggestions;
}
