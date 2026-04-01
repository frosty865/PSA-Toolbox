import { z } from 'zod';

/** Category code string literal union */
export const CategoryCodeSchema = z.enum([
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
  'CRITICAL_PRODUCTS',
]);
export type CategoryCode = z.infer<typeof CategoryCodeSchema>;

/** One row in the Critical Products table (workbook table-driven). */
export const CriticalProductRowSchema = z
  .object({
    product_or_service: z.string(),
    dependency_present: z.boolean(),
    notes: z.string().nullable(),
    single_source: z.boolean().nullable(),
    alternate_supplier_identified: z.boolean().nullable(),
    alternate_supplier_name: z.string().nullable(),
    multi_source_currently_used: z.boolean().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.alternate_supplier_identified === false && data.alternate_supplier_name != null && data.alternate_supplier_name.trim() !== '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'alternate_supplier_name must be null when alternate_supplier_identified is false', path: ['alternate_supplier_name'] });
    }
    if (data.alternate_supplier_identified === true && (data.alternate_supplier_name == null || data.alternate_supplier_name.trim() === '')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'alternate_supplier_name is required when alternate_supplier_identified is true', path: ['alternate_supplier_name'] });
    }
  });
export type CriticalProductRow = z.infer<typeof CriticalProductRowSchema>;

/** Independence of a supply source relative to others (SPOF vs resilience). */
export const SupplyIndependenceSchema = z.enum([
  'UNKNOWN',
  'SAME_DEMARCATION',
  'DIFFERENT_DEMARCATION_SAME_UPSTREAM',
  'DIFFERENT_LOOP_OR_PATH',
]);
export type SupplyIndependence = z.infer<typeof SupplyIndependenceSchema>;

/** One supply source/feed (provider, demarcation, independence). */
export const SupplySourceSchema = z.object({
  source_id: z.string(),
  provider_name: z.string().nullable(),
  source_label: z.string().nullable(),
  demarcation_lat: z.number().nullable(),
  demarcation_lon: z.number().nullable(),
  demarcation_description: z.string().nullable(),
  independence: SupplyIndependenceSchema,
  notes: z.string().nullable(),
});
export type SupplySource = z.infer<typeof SupplySourceSchema>;

/** Single source dependency entry (supply chain). */
export const EquipmentSupplierEntrySchema = z.object({
  component_or_service: z.string(),
  provider_name: z.string().nullable().optional(),
  alternatives_available: z.enum(["Yes", "No", "Unknown"]).optional(),
  lead_time_days: z.number().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type EquipmentSupplierEntry = z.infer<typeof EquipmentSupplierEntrySchema>;

/** Alternative providers / lead time (supply chain). */
export const AlternativeProvidersSchema = z.object({
  available: z.enum(["Yes", "No", "Unknown"]).optional(),
  lead_time_days: z.number().min(0).nullable().optional(),
  reason_or_constraint: z.string().nullable().optional(),
});
export type AlternativeProviders = z.infer<typeof AlternativeProvidersSchema>;

/** How alternate capability is initiated (universal across all sectors). */
export const RedundancyInitiationModeSchema = z.enum([
  'AUTOMATIC',
  'MANUAL_ONSITE',
  'MANUAL_REMOTE',
  'VENDOR_REQUIRED',
  'UNKNOWN',
]);
export type RedundancyInitiationMode = z.infer<typeof RedundancyInitiationModeSchema>;

/** Backup/alternate type for curve validation. Only TEMPORARY backups require backup_duration_hours. */
export const BackupTypeSchema = z.enum([
  'TEMPORARY',   // e.g. generator, cellular failover — duration-limited
  'PERMANENT',   // e.g. cloud region failover, mirrored data store
  'WORKFLOW',    // e.g. manual alternate workflow
  'UNKNOWN',
]);
export type BackupType = z.infer<typeof BackupTypeSchema>;

/** Redundancy activation details (only when alternate/backup exists). */
export const RedundancyActivationSchema = z
  .object({
    mode: RedundancyInitiationModeSchema,
    /** Activation delay before alternate is fully effective (minutes). 0 for AUTOMATIC typical. */
    activation_delay_min: z.number().min(0).max(10080).nullable().optional(),
    requires_trained_personnel: z.boolean().nullable().optional(),
    trained_personnel_24_7: z.boolean().nullable().optional(),
    remote_initiation_available: z.boolean().nullable().optional(),
    vendor_dispatch_required: z.boolean().nullable().optional(),
    documented_and_tested: z.boolean().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'AUTOMATIC') {
      if (data.activation_delay_min != null && (data.activation_delay_min < 0 || data.activation_delay_min > 60)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'AUTOMATIC mode: activation_delay_min should be 0–60', path: ['activation_delay_min'] });
      }
    }
    if (data.mode === 'MANUAL_ONSITE' || data.mode === 'MANUAL_REMOTE' || data.mode === 'VENDOR_REQUIRED') {
      // requires_trained_personnel typically true; null normalizes to true in migration
    }
  });
export type RedundancyActivation = z.infer<typeof RedundancyActivationSchema>;

/** Maintenance & reliability for backup systems (per category). */
export const MaintenanceScheduleSchema = z.object({
  preventive_maintenance_established: z.enum(["Yes", "No", "Unknown"]).optional(),
  frequency: z.string().nullable().optional(),
  last_service_date: z.string().nullable().optional(),
  next_scheduled_date: z.string().nullable().optional(),
  load_test_within_12_months: z.enum(["Yes", "No", "Unknown"]).optional(),
  last_load_test_date: z.string().nullable().optional(),
  load_pct_tested: z.number().min(0).max(100).nullable().optional(),
  spare_parts_maintained: z.enum(["Yes", "No", "Unknown"]).optional(),
  parts_list: z.array(z.string()).optional(),
  spare_parts_summary: z.string().nullable().optional(),
});
export type MaintenanceSchedule = z.infer<typeof MaintenanceScheduleSchema>;

/** Monitoring & awareness (per category). */
export const MonitoringCapabilitiesSchema = z.object({
  real_time_monitoring_exists: z.enum(["Yes", "No", "Unknown"]).optional(),
  automated_alerts_for_loss: z.enum(["Yes", "No", "Unknown"]).optional(),
});
export type MonitoringCapabilities = z.infer<typeof MonitoringCapabilitiesSchema>;

/** Cross-dependency entry (cascading failure capture). Legacy format. */
export const CrossDependencySchema = z.object({
  from_category: z.string().optional(),
  to_category: z.enum(["ELECTRIC_POWER", "COMMUNICATIONS", "INFORMATION_TECHNOLOGY", "WATER", "WASTEWATER"]),
  dependency_type: z.enum(["primary_operations", "backup_systems", "monitoring_control"]).optional(),
  description: z.string(),
  time_to_cascade_hours: z.number().min(0).max(168).nullable().optional(),
});
export type CrossDependency = z.infer<typeof CrossDependencySchema>;

/** Upstream/downstream category codes for cross-dependency edges. Includes CRITICAL_PRODUCTS. */
export const CrossDependencyCategorySchema = z.enum([
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
  'CRITICAL_PRODUCTS',
]);
export type CrossDependencyCategory = z.infer<typeof CrossDependencyCategorySchema>;

/** Purpose of the cross-dependency. */
export const CrossDependencyPurposeSchema = z.enum([
  'primary_operations',
  'monitoring_control',
  'restoration_recovery',
  'safety_life_safety',
]);
export type CrossDependencyPurpose = z.infer<typeof CrossDependencyPurposeSchema>;

/** Criticality level. */
export const CrossDependencyCriticalitySchema = z.enum(['critical', 'important', 'limited', 'unknown']);
export type CrossDependencyCriticality = z.infer<typeof CrossDependencyCriticalitySchema>;

/** Time-to-cascade bucket. */
export const CrossDependencyTimeBucketSchema = z.enum(['immediate', 'short', 'medium', 'long', 'unknown']);
export type CrossDependencyTimeBucket = z.infer<typeof CrossDependencyTimeBucketSchema>;

/** Single-path SPOF indicator. */
export const CrossDependencySinglePathSchema = z.enum(['yes', 'no', 'unknown']);
export type CrossDependencySinglePath = z.infer<typeof CrossDependencySinglePathSchema>;

/** Confidence level. */
export const CrossDependencyConfidenceSchema = z.enum(['assumed', 'documented', 'confirmed', 'unknown']);
export type CrossDependencyConfidence = z.infer<typeof CrossDependencyConfidenceSchema>;

/** Source of the edge. */
export const CrossDependencySourceSchema = z.enum(['auto_suggest', 'user']);
export type CrossDependencySource = z.infer<typeof CrossDependencySourceSchema>;

/** Self-driven cross-dependency edge. */
export const CrossDependencyEdgeSchema = z.object({
  from_category: CrossDependencyCategorySchema,
  to_category: CrossDependencyCategorySchema,
  purpose: CrossDependencyPurposeSchema,
  criticality: CrossDependencyCriticalitySchema,
  time_to_cascade_bucket: CrossDependencyTimeBucketSchema,
  single_path: CrossDependencySinglePathSchema,
  confidence: CrossDependencyConfidenceSchema,
  notes: z.string().optional(),
  source: CrossDependencySourceSchema.optional(),
});
export type CrossDependencyEdge = z.infer<typeof CrossDependencyEdgeSchema>;

/** Circular dependency path. */
export const CrossDependencyCircularSchema = z.object({
  path: z.array(CrossDependencyCategorySchema),
});
export type CrossDependencyCircular = z.infer<typeof CrossDependencyCircularSchema>;

/** Common-mode SPOF flag. */
export const CrossDependencyCommonModeSchema = z.object({
  upstream_category: CrossDependencyCategorySchema,
  affected_categories: z.array(CrossDependencyCategorySchema),
  rationale: z.string(),
});
export type CrossDependencyCommonMode = z.infer<typeof CrossDependencyCommonModeSchema>;

/** Derived flags (computed from confirmed edges). */
export const CrossDependenciesDerivedSchema = z.object({
  circular_dependencies: z.array(CrossDependencyCircularSchema).optional(),
  common_mode_spof: z.array(CrossDependencyCommonModeSchema).optional(),
});
export type CrossDependenciesDerived = z.infer<typeof CrossDependenciesDerivedSchema>;

/** Self-driven cross-dependencies node (edges + derived + UI state). */
export const CrossDependenciesNodeSchema = z.object({
  edges: z.array(CrossDependencyEdgeSchema),
  derived: CrossDependenciesDerivedSchema.optional(),
  last_auto_suggest_hash: z.string().optional(),
  rejected_keys: z.array(z.string()).optional(),
});
export type CrossDependenciesNode = z.infer<typeof CrossDependenciesNodeSchema>;

// ─── IT Internet Transport Resilience (checklist; replaces single redundant-yes/no) ───
/** Physical path diversity checklist; at least one boolean true or unknown true. */
export const ItPhysicalPathDiversitySchema = z
  .object({
    same_conduit: z.boolean().optional(),
    separate_conduits: z.boolean().optional(),
    separate_street_approach: z.boolean().optional(),
    unknown: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const atLeastOne = (data.same_conduit === true || data.separate_conduits === true ||
      data.separate_street_approach === true || data.unknown === true);
    if (!atLeastOne) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'physical_path_diversity must have at least one option true or unknown true',
        path: [],
      });
    }
  });
export type ItPhysicalPathDiversity = z.infer<typeof ItPhysicalPathDiversitySchema>;

export const ItCircuitCountSchema = z.enum(['ONE', 'TWO', 'THREE_PLUS']);
export type ItCircuitCount = z.infer<typeof ItCircuitCountSchema>;
export const ItCarrierDiversitySchema = z.enum(['SAME_CARRIER', 'DIFFERENT_CARRIERS', 'UNKNOWN']);
export type ItCarrierDiversity = z.infer<typeof ItCarrierDiversitySchema>;
export const ItBuildingEntryDiversitySchema = z.enum(['SAME_ENTRY', 'SEPARATE_ENTRIES', 'UNKNOWN']);
export type ItBuildingEntryDiversity = z.infer<typeof ItBuildingEntryDiversitySchema>;

/** Physical transport: building entry (normalized). SEPARATE_ENTRY = distinct entries; do not infer from provider count. */
export const TransportBuildingEntryDiversitySchema = z.enum(['SAME_ENTRY', 'SEPARATE_ENTRY', 'UNKNOWN']);
export type TransportBuildingEntryDiversity = z.infer<typeof TransportBuildingEntryDiversitySchema>;

/** Physical transport: route independence. CONFIRMED/NOT_CONFIRMED only when documented; never infer from provider count. */
export const TransportRouteIndependenceSchema = z.enum(['CONFIRMED', 'NOT_CONFIRMED', 'UNKNOWN']);
export type TransportRouteIndependence = z.infer<typeof TransportRouteIndependenceSchema>;

/** Physical transport: failover mode. Maps from redundancy_activation.mode; VENDOR_REQUIRED → UNKNOWN. */
export const TransportFailoverModeSchema = z.enum(['AUTOMATIC', 'MANUAL_ONSITE', 'MANUAL_REMOTE', 'UNKNOWN']);
export type TransportFailoverMode = z.infer<typeof TransportFailoverModeSchema>;
export const ItUpstreamPopDiversitySchema = z.enum(['SAME_POP', 'DIFFERENT_POPS', 'UNKNOWN']);
export type ItUpstreamPopDiversity = z.infer<typeof ItUpstreamPopDiversitySchema>;

/** Failover removed from IT transport (redundant). Kept only for type export; do not add to UI or schema. */
export const ItFailoverSchema = z.enum(['NONE', 'MANUAL', 'AUTOMATIC', 'UNKNOWN']);
export type ItFailover = z.infer<typeof ItFailoverSchema>;

/** Strip legacy failover on parse for backward compatibility; do not store or render. */
function stripFailoverFromTransport(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const o = { ...(raw as Record<string, unknown>) };
  delete o.failover;
  delete o.it_transport_failover;
  return o;
}

/**
 * Migrate legacy keys into physical transport fields. Do NOT derive independence from provider count.
 * - building_entry_diversity (SEPARATE_ENTRIES) → transport_building_entry_diversity (SEPARATE_ENTRY)
 * - redundancy_activation.mode → transport_failover_mode (VENDOR_REQUIRED → UNKNOWN)
 * Only copies when new key is missing; does not overwrite user-entered new keys.
 */
function migrateTransportPhysicalFields(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const o = raw as Record<string, unknown>;
  const out = { ...o };

  if (out.transport_building_entry_diversity == null && o.building_entry_diversity != null) {
    const v = o.building_entry_diversity as string;
    out.transport_building_entry_diversity = v === 'SEPARATE_ENTRIES' ? 'SEPARATE_ENTRY' : (v === 'SAME_ENTRY' || v === 'UNKNOWN' ? v : 'UNKNOWN');
  }
  if (out.transport_route_independence == null) {
    out.transport_route_independence = 'UNKNOWN';
  }
  if (out.transport_failover_mode == null) {
    out.transport_failover_mode = 'UNKNOWN';
  }
  if (out.transport_connection_count == null && o.circuit_count != null) {
    const cc = o.circuit_count as string;
    if (cc === 'ONE') out.transport_connection_count = 1;
    else if (cc === 'TWO') out.transport_connection_count = 2;
    else if (cc === 'THREE_PLUS') out.transport_connection_count = 3;
  }
  return out;
}

export const ItTransportResilienceSchema = z.preprocess(
  (raw) => migrateTransportPhysicalFields(stripFailoverFromTransport(raw)),
  z.object({
    circuit_count: ItCircuitCountSchema.optional(),
    carrier_diversity: ItCarrierDiversitySchema.optional(),
    physical_path_diversity: ItPhysicalPathDiversitySchema.optional(),
    building_entry_diversity: ItBuildingEntryDiversitySchema.optional(),
    upstream_pop_diversity: ItUpstreamPopDiversitySchema.optional(),
    notes: z.string().optional(),
    /** Physical connection count (null = not documented). Do not infer from provider count. */
    transport_connection_count: z.number().int().min(0).nullable().optional(),
    /** Derived; null if not documented. Not evidence of independence. */
    transport_provider_count: z.number().int().min(0).nullable().optional(),
    /** Building entry diversity. Default UNKNOWN when missing. */
    transport_building_entry_diversity: TransportBuildingEntryDiversitySchema.optional().default('UNKNOWN'),
    /** Route independence. Default UNKNOWN when missing. */
    transport_route_independence: TransportRouteIndependenceSchema.optional().default('UNKNOWN'),
    /** Failover mode; maps from redundancy_activation.mode. */
    transport_failover_mode: TransportFailoverModeSchema.optional().default('UNKNOWN'),
  })
);
export type ItTransportResilience = z.infer<typeof ItTransportResilienceSchema>;

/** Hosted service continuity: 4-state (3 options + Unknown). Not compliance/documentation. */
export const HostedContinuitySurvivabilitySchema = z.enum([
  'NO_CONTINUITY',
  'LOCAL_MIRROR_OR_CACHE',
  'ALTERNATE_PLATFORM_OR_PROVIDER',
  'UNKNOWN',
]);
export type HostedContinuitySurvivability = z.infer<typeof HostedContinuitySurvivabilitySchema>;

/** Output of migration: survivability optional (undefined = unanswered). No default. Maps legacy NONE/MANUAL_FALLBACK/LOCAL_MIRROR to new enum. */
function migrateHostedEntryToSurvivability(
  raw: unknown
): { survivability?: HostedContinuitySurvivability; notes?: string } {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const notes = typeof o.notes === 'string' ? o.notes : undefined;
  const s = o.survivability;
  if (s === 'NO_CONTINUITY' || s === 'LOCAL_MIRROR_OR_CACHE' || s === 'ALTERNATE_PLATFORM_OR_PROVIDER' || s === 'UNKNOWN') {
    return { survivability: s, notes };
  }
  if (s === 'NONE') return { survivability: 'NO_CONTINUITY', notes };
  if (s === 'LOCAL_MIRROR') return { survivability: 'LOCAL_MIRROR_OR_CACHE', notes };
  if (s === 'MANUAL_FALLBACK') return { survivability: 'ALTERNATE_PLATFORM_OR_PROVIDER', notes };
  const localMirror = o.local_mirror_or_offline_fallback === true || o.local_data_export === true;
  const alternate =
    o.continuity_mechanism_in_place === true ||
    o.offline_fallback === true ||
    o.origin_failover === true ||
    o.multi_pop === true ||
    o.secondary_dns === true;
  if (localMirror) return { survivability: 'LOCAL_MIRROR_OR_CACHE', notes };
  if (alternate) return { survivability: 'ALTERNATE_PLATFORM_OR_PROVIDER', notes };
  if (o.no_documented_resilience === true) return { survivability: 'NO_CONTINUITY', notes };
  if (o.multi_az === true && o.multi_region === true) return { survivability: 'NO_CONTINUITY', notes };
  return { notes };
}

/** Hosted/upstream continuity: survivability optional (undefined if unanswered). No schema default. */
export const ItHostedResilienceEntrySchema = z.preprocess(
  migrateHostedEntryToSurvivability,
  z.object({
    survivability: HostedContinuitySurvivabilitySchema.optional(),
    notes: z.string().optional(),
  })
);
export type ItHostedResilienceEntry = z.infer<typeof ItHostedResilienceEntrySchema>;

export const ItHostedResilienceSchema = z.record(z.string(), ItHostedResilienceEntrySchema);
export type ItHostedResilience = z.infer<typeof ItHostedResilienceSchema>;

/** Supply/sources block for non-CP dependency categories (electric, comms, IT, water, wastewater). */
export const SupplySchema = z
  .object({
    has_alternate_source: z.boolean(),
    sources: z.array(SupplySourceSchema),
  })
  .superRefine((data, ctx) => {
    if (data.has_alternate_source === false) {
      if (data.sources.length > 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'sources must have at most 1 row when has_alternate_source is false', path: ['sources'] });
      }
      for (let i = 0; i < data.sources.length; i++) {
        const ind = data.sources[i].independence;
        if (ind !== 'UNKNOWN' && ind !== 'SAME_DEMARCATION') {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'independence must be UNKNOWN or SAME_DEMARCATION when has_alternate_source is false', path: ['sources', i, 'independence'] });
        }
      }
    } else {
      if (data.sources.length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'sources must have at least 2 rows when has_alternate_source is true', path: ['sources'] });
      }
      for (let i = 0; i < data.sources.length; i++) {
        const src = data.sources[i];
        if (!src) continue;
        if (src.provider_name == null || src.provider_name.trim() === '') {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'provider_name is required for each source when has_alternate_source is true', path: ['sources', i, 'provider_name'] });
        }
        // independence === UNKNOWN is allowed here; for non-IT categories it is enforced in AssessmentSchema superRefine
      }
    }
  });
export type Supply = z.infer<typeof SupplySchema>;

/** PRA priority category (governance). */
export const PraCategorySchema = z.enum([
  'UNKNOWN',
  'TIER_1',
  'TIER_2',
  'TIER_3',
  'OTHER',
]);
export type PraCategory = z.infer<typeof PraCategorySchema>;

/** SLA + PRA agreements block for non-CP dependency categories. */
export const AgreementsSchema = z
  .object({
    has_sla: z.boolean(),
    sla_hours: z.number().min(0).max(168).nullable(),
    has_pra: z.boolean(),
    pra_category: PraCategorySchema.nullable(),
    pra_category_other: z.string().max(80).nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.has_sla === false) {
      if (data.sla_hours != null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'sla_hours must be null when has_sla is false', path: ['sla_hours'] });
      }
    } else if (data.has_sla === true) {
      if (data.sla_hours == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'sla_hours is required when has_sla is true', path: ['sla_hours'] });
      }
    }
    if (data.has_pra === false) {
      if (data.pra_category != null || (data.pra_category_other != null && data.pra_category_other.trim() !== '')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'pra_category and pra_category_other must be null when has_pra is false', path: ['pra_category'] });
      }
    } else if (data.has_pra === true) {
      if (data.pra_category == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'pra_category is required when has_pra is true', path: ['pra_category'] });
      } else if (data.pra_category !== 'OTHER') {
        if (data.pra_category_other != null && data.pra_category_other.trim() !== '') {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'pra_category_other must be null when pra_category is not OTHER', path: ['pra_category_other'] });
        }
      } else {
        if (data.pra_category_other == null || data.pra_category_other.trim() === '') {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'pra_category_other is required when pra_category is OTHER', path: ['pra_category_other'] });
        }
      }
    }
  });
export type Agreements = z.infer<typeof AgreementsSchema>;

/**
 * Canonical dependency shape (UI_REFERENCE_ELECTRICITY.md).
 * All non-CP curve categories (ELECTRIC_POWER, COMMUNICATIONS, INFORMATION_TECHNOLOGY, WATER, WASTEWATER)
 * use this shape. has_backup is accepted for backward compatibility and treated as has_backup_any.
 */
const CategoryInputBaseSchema = z.object({
  requires_service: z.boolean().optional(),
  time_to_impact_hours: z.number().min(0).max(72).nullable().optional(),
  loss_fraction_no_backup: z.number().min(0).max(1).nullable().optional(),
  has_backup_any: z.boolean().optional(),
  /** @deprecated Use has_backup_any. Kept for backward compatibility; treated as has_backup_any in refinements. */
  has_backup: z.boolean().optional(),
  has_backup_generator: z.boolean().nullable().optional(),
  backup_duration_hours: z.number().min(0).max(96).nullable().optional(),
  loss_fraction_with_backup: z.number().min(0).max(1).nullable().optional(),
  /** Percent of normal operations sustained while on backup (0–100). Derived from curve loss fields. Uses _pct suffix to avoid export validator percent-key check. */
  backup_capacity_pct: z.number().min(0).max(100).nullable().optional(),
  /** When backup provides operational continuity: TEMPORARY (duration-limited), PERMANENT, WORKFLOW, or UNKNOWN. Default treated as PERMANENT when missing. */
  backup_type: z.union([BackupTypeSchema, z.string()]).optional(),
  recovery_time_hours: z.number().min(0).max(168).nullable().optional(),
  critical_product_single_source: z.boolean().optional(),
  critical_product_no_alt_supplier: z.boolean().optional(),
  critical_products: z.array(CriticalProductRowSchema).optional(),
  /** Supply/sources for non-CP categories (electric, comms, IT, water, wastewater). Not used for CRITICAL_PRODUCTS. */
  supply: SupplySchema.optional(),
  /** SLA/PRA agreements for non-CP categories. Not used for CRITICAL_PRODUCTS. */
  agreements: AgreementsSchema.optional(),
  /** Supply chain: single-source dependency entries (repeatable). Optional for backward compatibility. */
  equipment_suppliers: z.array(EquipmentSupplierEntrySchema).optional(),
  /** Supply chain: alternative providers available. */
  alternative_providers: AlternativeProvidersSchema.optional(),
  /** Supply chain: typical lead time (days) for replacement/alternate. */
  lead_time_days: z.number().min(0).nullable().optional(),
  /** Maintenance & reliability for backup systems. Optional. */
  maintenance_schedule: MaintenanceScheduleSchema.optional(),
  /** Monitoring & awareness. Optional. */
  monitoring_capabilities: MonitoringCapabilitiesSchema.optional(),
  /** How alternate/backup is initiated. Only present when alternate exists. */
  redundancy_activation: RedundancyActivationSchema.optional(),
  /** Vehicle impact exposure status (dependency tabs with structured follow-up). */
  vehicle_impact_exposure: z.enum(['yes', 'no', 'unknown', 'na']).optional(),
  /** Vehicle impact protection status (gated follow-up when exposure = YES). */
  vehicle_impact_protection: z.enum(['yes', 'no', 'unknown']).optional(),
  /** IT only: installation context for vehicle impact assessment. */
  it_installation_location: z.enum([
    'exterior_at_grade',
    'exterior_elevated_or_protected',
    'interior_or_underground',
    'unknown',
  ]).optional(),
  /** IT only: continuity/recovery plan exists (yes/no/unknown). */
  it_continuity_plan_exists: z.enum(['yes', 'no', 'unknown']).optional(),
  /** IT only: plan exercised (yes_within_12_months | yes_over_12_months_ago | no | unknown). */
  it_plan_exercised: z.enum(['yes_within_12_months', 'yes_over_12_months_ago', 'no', 'unknown']).optional(),
  /** IT only: scope of most recent exercise. */
  it_exercise_scope: z.enum(['tabletop_discussion', 'functional_technical_test', 'full_operational_exercise', 'unknown']).optional(),
  /** Communications only: single provider for restoration (Yes/No/Unknown). Display-scoped; maps to existing VOFCs. */
  comms_single_provider_restoration: z.enum(['Yes', 'No', 'Unknown']).optional(),
  /** Communications only: alternate providers or service paths available. Maps to existing VOFCs. */
  comms_alternate_providers_or_paths: z.enum(['Yes', 'No', 'Unknown']).optional(),
  /** Communications only: restoration constraints (multi-select). Keys: provider_backlog, specialized_equipment, regional_outage_dependency, access_permitting_constraints, unknown. */
  comms_restoration_constraints: z.array(z.string()).optional(),
  /** IT only: internet transport resilience checklist (circuit/path/entry/POP/failover). Replaces single redundant-yes/no. */
  it_transport_resilience: ItTransportResilienceSchema.optional(),
  /** IT only: hosted/upstream resilience checklist per dependency_id. Only when single-path exposure. */
  it_hosted_resilience: ItHostedResilienceSchema.optional(),
}).passthrough();

/** Effective backup gate: has_backup_any if set, else has_backup (backward compat). */
function effectiveHasBackup(data: z.infer<typeof CategoryInputBaseSchema>): boolean | undefined {
  if (data.has_backup_any !== undefined) return data.has_backup_any;
  return data.has_backup;
}

export const CategoryInputSchema = CategoryInputBaseSchema.superRefine((data, ctx) => {
  if (data.critical_products != null && data.requires_service === undefined) {
    return;
  }

  const backup = effectiveHasBackup(data);

  if (data.requires_service === false) {
    const zeroOrNull = (v: unknown) => v == null || v === 0;
    if (!zeroOrNull(data.time_to_impact_hours)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'time_to_impact_hours must be null or 0 when requires_service is false',
        path: ['time_to_impact_hours'],
      });
    }
    if (!zeroOrNull(data.loss_fraction_no_backup)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'loss_fraction_no_backup must be null or 0 when requires_service is false',
        path: ['loss_fraction_no_backup'],
      });
    }
    if (backup === true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'has_backup_any must be false when requires_service is false',
        path: ['has_backup_any'],
      });
    }
    if (data.has_backup_generator === true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'has_backup_generator must be false or null when requires_service is false',
        path: ['has_backup_generator'],
      });
    }
    if (data.backup_duration_hours != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'backup_duration_hours must be null when requires_service is false',
        path: ['backup_duration_hours'],
      });
    }
    if (data.loss_fraction_with_backup != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'loss_fraction_with_backup must be null when requires_service is false',
        path: ['loss_fraction_with_backup'],
      });
    }
    if (data.recovery_time_hours != null && data.recovery_time_hours !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'recovery_time_hours must be null or 0 when requires_service is false',
        path: ['recovery_time_hours'],
      });
    }
    return;
  }

  if (backup === false) {
    if (data.has_backup_generator === true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'has_backup_generator must be false or null when has_backup_any is false',
        path: ['has_backup_generator'],
      });
    }
    if (data.backup_duration_hours != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'backup_duration_hours must be null when has_backup_any is false',
        path: ['backup_duration_hours'],
      });
    }
    if (data.loss_fraction_with_backup != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'loss_fraction_with_backup must be null when has_backup_any is false',
        path: ['loss_fraction_with_backup'],
      });
    }
    return;
  }

  if (backup === true) {
    // backup_duration_hours required only when backup is duration-limited (TEMPORARY); PERMANENT/WORKFLOW/UNKNOWN/missing do not require it
    const effectiveBackupType = data.backup_type ?? 'PERMANENT';
    if (effectiveBackupType === 'TEMPORARY' && data.backup_duration_hours == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'backup_duration_hours must be set when backup type is TEMPORARY',
        path: ['backup_duration_hours'],
      });
    }
    if (data.loss_fraction_with_backup == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'loss_fraction_with_backup must be set when has_backup_any is true',
        path: ['loss_fraction_with_backup'],
      });
    }
  }

  // IT transport resilience: circuit_count required when IT reliance on internet is YES
  const transport = data.it_transport_resilience as ItTransportResilience | undefined;
  if (transport != null && data.requires_service === true) {
    if (transport.circuit_count == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'circuit_count is required when IT reliance on internet transport is YES',
        path: ['it_transport_resilience', 'circuit_count'],
      });
    }
  }
});

export type CategoryInput = z.infer<typeof CategoryInputSchema>;

const MetaSchema = z.object({
  tool_version: z.string(),
  template_version: z.string(),
  created_at_iso: z.string(),
});

const AssetSchema = z.object({
  asset_name: z.string(),
  visit_date_iso: z.string(),
  /** Location as Lat/Long (e.g. "38.9072, -77.0369"). */
  location: z.string().optional(),
  assessor: z.string().optional(),
  /** PSA contact (report cover / landing). */
  psa_name: z.string().optional(),
  psa_region: z.string().optional(),
  psa_city: z.string().optional(),
  /** PSA phone (required for export). psa_cell is alias for backward compat. */
  psa_phone: z.string().optional(),
  psa_cell: z.string().optional(),
  psa_email: z.string().optional(),
  /** Services this facility provides (for designation block in report). */
  services_provided: z.array(z.string()).optional(),
});

/** SLA MTTR-Max source (for priority restoration capture). */
export const SlaMttrSourceSchema = z.enum([
  'contract',
  'service_order',
  'sow',
  'other',
  'unknown',
]);
export type SlaMttrSource = z.infer<typeof SlaMttrSourceSchema>;

/** SLA reliability flag value (yes = documented/confirmed; no/unknown = gap). */
export const SlaFailureFlagValueSchema = z.enum(['yes', 'no', 'unknown']);
export type SlaFailureFlagValue = z.infer<typeof SlaFailureFlagValueSchema>;

/** SLA reliability follow-on flags. Blank initial state: all optional, no default. Each !== "yes" counts as a failure point when set. */
export const SlaFailureFlagsSchema = z.object({
  regional_applicability: SlaFailureFlagValueSchema.optional(),
  clock_defined: SlaFailureFlagValueSchema.optional(),
  activation_required_documented: SlaFailureFlagValueSchema.optional(),
  escalation_defined: SlaFailureFlagValueSchema.optional(),
  full_component_coverage: SlaFailureFlagValueSchema.optional(),
  restoration_validation_defined: SlaFailureFlagValueSchema.optional(),
  tolerance_reviewed: SlaFailureFlagValueSchema.optional(),
  documentation_accessible: SlaFailureFlagValueSchema.optional(),
});
/** Explicit permissive type so optional properties are accepted when merging/assigning. */
export type SlaFailureFlags = {
  regional_applicability?: SlaFailureFlagValue;
  clock_defined?: SlaFailureFlagValue;
  activation_required_documented?: SlaFailureFlagValue;
  escalation_defined?: SlaFailureFlagValue;
  full_component_coverage?: SlaFailureFlagValue;
  restoration_validation_defined?: SlaFailureFlagValue;
  tolerance_reviewed?: SlaFailureFlagValue;
  documentation_accessible?: SlaFailureFlagValue;
};

/** Existence-based answer for SLA categorization (YES/NO/UNKNOWN). */
export const TriSchema = z.enum(['YES', 'NO', 'UNKNOWN']);
export type Tri = z.infer<typeof TriSchema>;

/** SLA categorization block per topic. Validation (e.g. MTTR required when YES) is enforced in app schema. */
export const SlaCategorizationSchema = z.object({
  assessed: z.boolean().default(false),
  sla_in_place: TriSchema.default('UNKNOWN'),
  mttr_max_hours: z.number().finite().positive().nullable().default(null),
  applies_in_widespread_events: TriSchema.default('UNKNOWN'),
  clock_trigger_defined: TriSchema.default('UNKNOWN'),
  activation_required_documented: TriSchema.default('UNKNOWN'),
  escalation_path_documented: TriSchema.default('UNKNOWN'),
  full_component_coverage: TriSchema.default('UNKNOWN'),
  restoration_validation_defined: TriSchema.default('UNKNOWN'),
  documentation_accessible: TriSchema.default('UNKNOWN'),
  notes: z.string().optional().default(''),
});
export type SlaCategorization = z.infer<typeof SlaCategorizationSchema>;

/** Per-topic priority restoration / SLA capture (stored on assessment). PRA = Federal or SLTT only; SLA = separate contract. */
export const PriorityRestorationTopicSchema = z.object({
  federal_standard: z.boolean().default(false),
  pra_category: PraCategorySchema.nullable().optional().default(null),
  pra_category_other: z.string().max(80).nullable().optional().default(null),
  paid_sla: z.boolean().default(false),
  /** True only after the assessor has answered the SLA question (yes/no). Prevents "No SLA" when not asked. */
  sla_assessed: z.boolean().default(false),
  sla_mttr_max_hours: z.number().finite().positive().nullable().default(null),
  sla_mttr_max_source: SlaMttrSourceSchema.optional().default('unknown'),
  sla_mttr_max_notes: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  sla_failure_flags: SlaFailureFlagsSchema.optional(),
  sla_categorization: SlaCategorizationSchema.optional(),
});
export type PriorityRestorationTopic = z.infer<typeof PriorityRestorationTopicSchema>;

/** Priority restoration state for all dependency topics (Energy, Comms, IT, Water, Wastewater). */
export const PriorityRestorationSchema = z.object({
  energy: PriorityRestorationTopicSchema,
  communications: PriorityRestorationTopicSchema,
  information_technology: PriorityRestorationTopicSchema,
  water: PriorityRestorationTopicSchema,
  wastewater: PriorityRestorationTopicSchema,
});
export type PriorityRestoration = z.infer<typeof PriorityRestorationSchema>;

/** Categories record keyed by category code */
const CategoriesSchema = z.record(CategoryCodeSchema, CategoryInputSchema);

/** Assessment-level settings (module toggles, etc.). Optional for backward compatibility. */
export const AssessmentSettingsSchema = z.object({
  /** When true, PRA/SLA questions, UI, exports, report, and VOFCs are included. Stored data remains regardless of toggle. Default false. */
  pra_sla_enabled: z.boolean().default(false),
  /** When true, cross-dependency tab, summary block, and cascading-risk VOFCs are included. Stored data remains regardless of toggle. Default false. */
  cross_dependency_enabled: z.boolean().default(false),
});
export type AssessmentSettings = z.infer<typeof AssessmentSettingsSchema>;

/** Curve storage namespace per infrastructure (mirrors curve_* fields on CategoryInput). */
export const CurveStorageSchema = z
  .object({
    requires_service: z.boolean().optional(),
    time_to_impact: z.number().min(0).max(72).nullable().optional(),
    loss_no_backup: z.number().min(0).max(1).nullable().optional(),
    backup_duration: z.number().min(0).max(96).nullable().optional(),
    loss_with_backup: z.number().min(0).max(1).nullable().optional(),
    recovery_time: z.number().min(0).max(168).nullable().optional(),
  })
  .partial();
export type CurveStorage = z.infer<typeof CurveStorageSchema>;

/** Infrastructure node container for namespaced data (curve, findings, etc.). */
export const InfrastructureNodeSchema = z
  .object({
    curve: CurveStorageSchema.optional(),
  })
  .passthrough();
export type InfrastructureNode = z.infer<typeof InfrastructureNodeSchema>;

/** Assessment-level infrastructure namespace keyed by dependency topic. */
export const InfrastructureStateSchema = z
  .object({
    energy: InfrastructureNodeSchema.optional(),
    communications: InfrastructureNodeSchema.optional(),
    information_technology: InfrastructureNodeSchema.optional(),
    water: InfrastructureNodeSchema.optional(),
    wastewater: InfrastructureNodeSchema.optional(),
  })
  .catchall(InfrastructureNodeSchema)
  .partial();
export type InfrastructureState = z.infer<typeof InfrastructureStateSchema>;

/** Cross-dependency module state (OT/ICS and future modules). */
export const ModuleDerivedSchema = z.object({
  vulnerabilities: z.array(z.string()).optional(),
  flags: z.array(z.string()).optional(),
  modifiers: z.array(z.string()).optional(),
});
export type ModuleDerived = z.infer<typeof ModuleDerivedSchema>;

export const ModuleStateSchema = z.object({
  enabled: z.boolean().default(false),
  answers: z.record(z.any()).default({}),
  derived: ModuleDerivedSchema.optional(),
});
export type ModuleState = z.infer<typeof ModuleStateSchema>;

export const ModulesSchema = z.record(z.string(), ModuleStateSchema).optional();
export type Modules = z.infer<typeof ModulesSchema>;

/** Category codes that use strict supply independence (independence must be set when has_alternate_source). IT allows UNKNOWN. */
const STRICT_SUPPLY_INDEPENDENCE_CATEGORIES: string[] = ['ELECTRIC_POWER', 'COMMUNICATIONS', 'WATER', 'WASTEWATER'];

const _assessmentBase = z
  .object({
    meta: MetaSchema,
    asset: AssetSchema,
    categories: CategoriesSchema,
    /** Priority restoration / SLA capture per dependency topic. Optional for backward compatibility. */
    priority_restoration: PriorityRestorationSchema.optional(),
    /** Cross-dependencies (cascading failure capture). Optional. Legacy: array. New: CrossDependenciesNode. */
    cross_dependencies: z.union([z.array(CrossDependencySchema), CrossDependenciesNodeSchema]).optional(),
    /** Module toggles and preferences. Optional for backward compatibility. */
    settings: AssessmentSettingsSchema.optional(),
    /** Namespaced infrastructure data (impact curves and future derived findings). */
    infrastructure: InfrastructureStateSchema.optional(),
    /** Cross-dependency modules (OT/ICS and future modules). */
    modules: ModulesSchema.optional(),
  })
  .passthrough();

export type Assessment = z.infer<typeof _assessmentBase>;

export const AssessmentSchema: z.ZodType<Assessment> = _assessmentBase.superRefine(
  (data: { categories?: Record<string, { supply?: { has_alternate_source?: boolean; sources?: Array<{ independence?: string }> } }> }, ctx: z.RefinementCtx) => {
    const categories = data.categories ?? {};
    for (const catCode of Object.keys(categories)) {
      if (!STRICT_SUPPLY_INDEPENDENCE_CATEGORIES.includes(catCode)) continue;
      const cat = categories[catCode];
      if (!cat || typeof cat !== 'object' || !('supply' in cat)) continue;
      const supply = cat.supply;
      if (!supply?.has_alternate_source || !supply.sources?.length) continue;
      for (let i = 0; i < supply.sources.length; i++) {
        if (supply.sources[i]?.independence === 'UNKNOWN') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'independence must be set (not UNKNOWN) when has_alternate_source is true',
            path: ['categories', catCode, 'supply', 'sources', i, 'independence'],
          });
        }
      }
    }
  }
) as z.ZodType<Assessment>;
