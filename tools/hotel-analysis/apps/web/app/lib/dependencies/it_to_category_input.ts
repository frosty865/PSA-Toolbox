/**
 * Map ItAnswers to INFORMATION_TECHNOLOGY CategoryInput.
 * Authoritative store for ISP list is supply.sources[] (Primary = sources[0], Secondary = sources[1]).
 * curve_primary_provider / curve_secondary_provider sync from questionnaire; ISPs must never be in IT-1_service_providers.
 */
import type { CategoryInput, ItTransportResilience, Supply, SupplySource } from 'schema';
import type { ItAnswers } from './infrastructure/it_spec';
import { isTransportProvider } from '@/app/lib/report/it/hosted_service_registry';

/** Back-compat: read string keys that may exist in stored assessments but are no longer on the typed answers object. */
function legacyStringAnswer(obj: unknown, key: string): string | null | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const v = (obj as Record<string, unknown>)[key];
  if (v === null || v === undefined) return v as null | undefined;
  return typeof v === 'string' ? v : undefined;
}

function newSourceId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `src-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultSupplySource(providerName: string | null): SupplySource {
  return {
    source_id: newSourceId(),
    provider_name: providerName ?? null,
    source_label: null,
    demarcation_lat: null,
    demarcation_lon: null,
    demarcation_description: null,
    independence: 'UNKNOWN',
    notes: null,
  };
}

/** Build IT supply.sources from primary/secondary ISP (questionnaire or existing supply). */
function buildItSupplyFromProviders(
  primary: string | undefined | null,
  secondary: string | undefined | null,
  existingSupply: Supply | undefined
): Supply {
  const existingSources = existingSupply?.sources ?? [];
  const hasSecondary = (secondary ?? '').trim() !== '';
  const hasExistingSecondary = existingSources[1] != null;
  const sources: SupplySource[] = [];
  const primaryName = (primary ?? '').trim() || null;
  const secondaryName = (secondary ?? '').trim() || null;
  sources[0] = existingSources[0]
    ? { ...existingSources[0], provider_name: primaryName ?? existingSources[0].provider_name }
    : defaultSupplySource(primaryName);
  if (hasSecondary || hasExistingSecondary) {
    sources[1] = existingSources[1]
      ? { ...existingSources[1], provider_name: secondaryName || existingSources[1].provider_name }
      : defaultSupplySource(secondaryName);
  }
  return {
    has_alternate_source: sources.length >= 2,
    sources,
  };
}

/** Migration: if supply has 1 source and IT-1 contains an ISP, move that ISP to supply.sources and remove from IT-1. */
function migrateIspFromIt1ToSupply(
  supply: Supply,
  it1Providers: Array<{ provider_name?: string; designation?: string }>
): { supply: Supply; it1Filtered: Array<{ provider_name: string; designation: string }> } {
  if (!it1Providers?.length || supply.sources.length !== 1) {
    const filtered = (it1Providers ?? []).filter(
      (p) => !isTransportProvider((p.provider_name ?? '').trim())
    ) as Array<{ provider_name: string; designation: string }>;
    return { supply, it1Filtered: filtered };
  }
  const ispEntry = it1Providers.find((p) => isTransportProvider((p.provider_name ?? '').trim()));
  if (!ispEntry) {
    const filtered = it1Providers.filter(
      (p) => !isTransportProvider((p.provider_name ?? '').trim())
    ) as Array<{ provider_name: string; designation: string }>;
    return { supply, it1Filtered: filtered };
  }
  const name = (ispEntry.provider_name ?? '').trim();
  if (!name) return { supply, it1Filtered: it1Providers as Array<{ provider_name: string; designation: string }> };
  const secondSource = defaultSupplySource(name);
  const newSupply: Supply = {
    has_alternate_source: true,
    sources: [...supply.sources, secondSource],
  };
  const it1Filtered = (
    it1Providers
      .filter((p) => (p.provider_name ?? '').trim() !== name || !isTransportProvider((p.provider_name ?? '').trim()))
      .filter((p) => !isTransportProvider((p.provider_name ?? '').trim()))
  ) as Array<{ provider_name: string; designation: string }>;
  return { supply: newSupply, it1Filtered };
}

/** Run on load/export: move ISP from IT-1 to supply.sources when applicable; normalize has_alternate_source. */
export function migrateAssessmentItIsp(assessment: { categories?: Record<string, unknown> }): void {
  const itCat = assessment.categories?.INFORMATION_TECHNOLOGY as Record<string, unknown> | undefined;
  if (!itCat || typeof itCat !== 'object') return;
  const supply = itCat.supply as Supply | undefined;
  const it1 = (itCat['IT-1_service_providers'] as Array<{ provider_name?: string; designation?: string }>) ?? [];
  const { supply: newSupply, it1Filtered } = migrateIspFromIt1ToSupply(
    supply ?? { has_alternate_source: false, sources: [] },
    it1
  );
  const finalSupply: Supply = { ...newSupply, has_alternate_source: newSupply.sources.length >= 2 };
  if (supply != null || newSupply.sources.length > 0) itCat.supply = finalSupply;
  if (it1Filtered.length !== it1.length) itCat['IT-1_service_providers'] = it1Filtered;
}

/** Map legacy supply.sources (Independence) to it_transport_resilience for report/UI. */
export function migrateLegacyItSupplyToTransportResilience(supply: Supply | undefined): ItTransportResilience | undefined {
  if (!supply?.sources?.length) return undefined;
  const sources = supply.sources;
  const circuitCount = sources.length >= 3 ? 'THREE_PLUS' : sources.length === 2 ? 'TWO' : 'ONE';
  return {
    circuit_count: circuitCount,
    carrier_diversity: 'UNKNOWN',
    physical_path_diversity: { unknown: true },
    building_entry_diversity: 'UNKNOWN',
    upstream_pop_diversity: 'UNKNOWN',
    notes: undefined,
    transport_building_entry_diversity: 'UNKNOWN',
    transport_route_independence: 'UNKNOWN',
    transport_failover_mode: 'UNKNOWN',
  };
}
import {
  clearDependentFields,
  DEPENDENTS_WHEN_REQUIRES_SERVICE_FALSE,
  DEPENDENTS_WHEN_HAS_BACKUP_FALSE,
} from '@/lib/clear-dependent-fields';

export function itAnswersToInformationTechnologyCategoryInput(
  answers: ItAnswers,
  existingCategory: Partial<CategoryInput> = {}
): CategoryInput {
  const requires_service = answers.curve_requires_service !== false;
  const existing = existingCategory as Record<string, unknown>;

  // IT continuity: backup = secondary ISP (supply) or curve_backup_available (UI). Do not use removed IT-8/alternate-method block.
  // curve_secondary_provider was removed from the current IT answer type; read it via legacy accessor for older stored assessments.
  const builtSupply = buildItSupplyFromProviders(
    (answers.curve_primary_provider ?? existing.curve_primary_provider) as string | null | undefined,
    (legacyStringAnswer(answers, 'curve_secondary_provider') ?? legacyStringAnswer(existing, 'curve_secondary_provider')) as string | null | undefined,
    existing.supply as Supply | undefined
  );
  const has_backup_any =
    builtSupply.has_alternate_source || answers.curve_backup_available === 'yes';

  const curveOut: Record<string, unknown> = {
    ...existingCategory,
    requires_service,
    curve_primary_provider: requires_service ? (answers.curve_primary_provider ?? existing.curve_primary_provider ?? null) : null,
    curve_secondary_provider: requires_service ? (legacyStringAnswer(answers, 'curve_secondary_provider') ?? legacyStringAnswer(existing, 'curve_secondary_provider') ?? null) : null,
    time_to_impact_hours: answers.curve_time_to_impact_hours ?? existingCategory.time_to_impact_hours ?? null,
    loss_fraction_no_backup:
      answers.curve_loss_fraction_no_backup ?? existingCategory.loss_fraction_no_backup ?? null,
    has_backup_any,
    has_backup: has_backup_any,
    backup_duration_hours: has_backup_any ? (existingCategory.backup_duration_hours ?? null) : null,
    loss_fraction_with_backup: has_backup_any
      ? (answers.curve_loss_fraction_with_backup ?? existingCategory.loss_fraction_with_backup ?? null)
      : null,
    redundancy_activation: (() => {
      if (!has_backup_any) return undefined;
      const raw = answers.redundancy_activation ?? existingCategory.redundancy_activation;
      if (raw == null || typeof raw !== 'object') return undefined;
      const o = raw as Record<string, unknown>;
      return (o.mode != null ? raw : { ...o, mode: 'UNKNOWN' }) as CategoryInput['redundancy_activation'];
    })(),
    recovery_time_hours:
      answers.curve_recovery_time_hours ?? existingCategory.recovery_time_hours ?? null,
    backup_capacity_pct: undefined,
    backup_type: undefined,
  };

  let out = curveOut;
  if (requires_service === false) {
    out = clearDependentFields(out as Record<string, unknown>, [...DEPENDENTS_WHEN_REQUIRES_SERVICE_FALSE]);
  }
  if (has_backup_any === false) {
    out = clearDependentFields(out as Record<string, unknown>, [...DEPENDENTS_WHEN_HAS_BACKUP_FALSE]);
  }

  const vehicleExposure = answers['IT-7_vehicle_impact_exposure'];
  const vehicleProtection = vehicleExposure === 'yes' ? answers['IT-7a_vehicle_impact_protection'] ?? 'unknown' : 'unknown';
  (out as Record<string, unknown>).vehicle_impact_exposure = vehicleExposure;
  (out as Record<string, unknown>).vehicle_impact_protection = vehicleProtection;
  (out as Record<string, unknown>).it_installation_location = answers['IT-7_installation_location'];

  // Preserve Cyber block (plan exercising) from existing; questionnaire can also set via answers
  const merged = {
    ...out,
    it_continuity_plan_exists: answers.it_continuity_plan_exists ?? (existingCategory as Record<string, unknown>).it_continuity_plan_exists,
    it_plan_exercised: answers.it_plan_exercised ?? (existingCategory as Record<string, unknown>).it_plan_exercised,
    it_exercise_scope: answers.it_exercise_scope ?? (existingCategory as Record<string, unknown>).it_exercise_scope,
  };

  // Spread all ItAnswers keys for persistence (passthrough in schema). Omit removed IT-8/9/10 alternate-method keys.
  const itKeys = [
    'curve_requires_service',
    'curve_primary_provider',
    'curve_secondary_provider',
    'curve_time_to_impact_hours',
    'curve_loss_fraction_no_backup',
    'curve_loss_fraction_with_backup',
    'curve_recovery_time_hours',
    'redundancy_activation',
    'IT-1_can_identify_providers',
    'IT-1_service_providers',
    'IT-2_can_identify_assets',
    'IT-2_upstream_assets',
    'IT-3_multiple_connections',
    'IT-3_connection_count',
    'IT-4_physically_separated',
    'IT-4_service_connections',
    'IT-5_survivability',
    'IT-6_components_protected',
    'IT-6_protections',
    'IT-7_installation_location',
    'IT-7_vehicle_impact_exposure',
    'IT-7a_vehicle_impact_protection',
    'IT-11_restoration_coordination',
    'it_pra_sla_providers',
    'it_continuity_plan_exists',
    'it_plan_exercised',
    'it_exercise_scope',
  ] as const;

  for (const key of itKeys) {
    const v = answers[key];
    if (v !== undefined) (merged as Record<string, unknown>)[key] = v;
  }

  // IT supply: authoritative store for ISPs. Run migration (IT-1 ISP → supply).
  const it1Raw = (merged as Record<string, unknown>)['IT-1_service_providers'] as Array<{ provider_name?: string; designation?: string }> | undefined;
  const { supply: finalSupply, it1Filtered } = migrateIspFromIt1ToSupply(builtSupply, it1Raw ?? []);
  (merged as Record<string, unknown>).supply = finalSupply;
  (merged as Record<string, unknown>)['IT-1_service_providers'] = it1Filtered;

  // PRA/SLA: per-ISP providers array for reporter/schema; conditions use primary provider's restoration_coordination (injected in normalize_conditions).
  const providers = answers.it_pra_sla_providers ?? [];
  if (providers.length > 0) {
    (merged as Record<string, unknown>).pra_sla = {
      ...((existing.pra_sla as Record<string, unknown> | undefined) ?? {}),
      providers: providers.map((p) => ({
        name: p.name,
        restoration_coordination: p.restoration_coordination,
        priority_restoration: p.priority_restoration,
      })),
    };
  } else {
    // Legacy: single restoration_coordination when no per-provider data
    const restorationCoord = answers['IT-11_restoration_coordination'];
    if (restorationCoord !== undefined) {
      (merged as Record<string, unknown>).pra_sla = {
        ...((existing.pra_sla as Record<string, unknown> | undefined) ?? {}),
        restoration_coordination: restorationCoord,
      };
    }
  }

  // Preserve transport/hosted resilience (edited on category; not in answers). Migrate legacy supply if needed.
  if (existing.it_transport_resilience != null) {
    (merged as Record<string, unknown>).it_transport_resilience = existing.it_transport_resilience;
  } else if (existing.supply != null) {
    const migrated = migrateLegacyItSupplyToTransportResilience(existing.supply as Supply);
    if (migrated) (merged as Record<string, unknown>).it_transport_resilience = migrated;
  }
  if (existing.it_hosted_resilience != null) (merged as Record<string, unknown>).it_hosted_resilience = existing.it_hosted_resilience;

  // Preserve raw answers for question-driven vulnerability evaluation
  (merged as Record<string, unknown>).answers = answers;

  return merged as CategoryInput;
}


/** Migrate legacy IT-2 row (asset_name_or_id) to service_id + service_other. */
function migrateIt2Row(row: unknown): unknown {
  if (row == null || typeof row !== 'object') return row;
  const r = row as Record<string, unknown>;
  if (r.service_id != null && String(r.service_id).trim() !== '') return row;
  const legacyName = r.asset_name_or_id;
  if (legacyName != null && String(legacyName).trim() !== '') {
    return {
      ...r,
      service_id: 'other',
      service_other: String(legacyName).trim(),
      service_provider: r.service_provider ?? r.provider ?? '',
      asset_name_or_id: undefined,
    };
  }
  return row;
}

/** Extract ItAnswers from CategoryInput for initializing the questionnaire (e.g. when returning to tab). */
export function categoryInputToItAnswers(category: Partial<CategoryInput> | undefined): Partial<ItAnswers> {
  if (!category || typeof category !== 'object') return {};
  const c = category as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  // Primary/secondary ISP come from supply.sources (authoritative), not curve_* on category
  const supply = c.supply as Supply | undefined;
  const sources = supply?.sources ?? [];
  if (sources[0] != null) {
    const name = (sources[0].provider_name ?? '').trim();
    if (name) out.curve_primary_provider = name;
  }
  if (sources[1] != null) {
    const name = (sources[1].provider_name ?? '').trim();
    if (name) out.curve_secondary_provider = name;
  }

  // PRA/SLA: read per-provider list or legacy single restoration_coordination
  const praSla = c.pra_sla as
    | { providers?: Array<{ name: string; restoration_coordination?: string; priority_restoration?: string }>; restoration_coordination?: string }
    | undefined;
  if (praSla?.providers != null && Array.isArray(praSla.providers) && praSla.providers.length > 0) {
    out.it_pra_sla_providers = praSla.providers.map((p) => ({
      name: p.name,
      restoration_coordination: p.restoration_coordination,
      priority_restoration: p.priority_restoration,
    }));
  } else if (praSla?.restoration_coordination !== undefined) {
    out['IT-11_restoration_coordination'] = praSla.restoration_coordination;
    // Migrate to single-provider entry when we have a primary provider name
    const primaryName = (sources[0]?.provider_name ?? '').trim() || (c.curve_primary_provider as string)?.trim();
    if (primaryName) {
      out.it_pra_sla_providers = [
        { name: primaryName, restoration_coordination: praSla.restoration_coordination, priority_restoration: undefined },
      ];
    }
  }

  const keys = [
    'curve_requires_service',
    'curve_time_to_impact_hours',
    'curve_loss_fraction_no_backup',
    'curve_loss_fraction_with_backup',
    'curve_recovery_time_hours',
    'redundancy_activation',
    'IT-1_can_identify_providers',
    'IT-1_service_providers',
    'IT-2_can_identify_assets',
    'IT-2_upstream_assets',
    'IT-3_multiple_connections',
    'IT-3_connection_count',
    'IT-4_physically_separated',
    'IT-4_service_connections',
    'IT-5_survivability',
    'IT-6_components_protected',
    'IT-6_protections',
    'IT-7_installation_location',
    'IT-7_vehicle_impact_exposure',
    'IT-7a_vehicle_impact_protection',
    'IT-11_restoration_coordination',
    'it_pra_sla_providers',
    'it_continuity_plan_exists',
    'it_plan_exercised',
    'it_exercise_scope',
  ];
  for (const key of keys) {
    if (key in c && c[key] !== undefined) {
      let val = c[key];
      if (key === 'IT-2_upstream_assets' && Array.isArray(val)) {
        val = val.map(migrateIt2Row);
      }
      out[key] = val;
    }
  }
  return out as Partial<ItAnswers>;
}
