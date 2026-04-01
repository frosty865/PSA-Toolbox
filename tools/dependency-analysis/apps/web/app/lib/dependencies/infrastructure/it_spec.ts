/**
 * Canonical INFORMATION TECHNOLOGY dependency spec.
 * Mirrors Energy structure with IT-1 through IT-11 main questions.
 * Shares curve_* IDs with Energy for impact curve consistency.
 * Focus: operational dependency; does not expand into deep cyber controls.
 *
 * SECTION ORDER: INTERNET TRANSPORT (curve + IT-1) → CRITICAL HOSTED SERVICES (IT-2 + per-service continuity).
 * Failover is not part of the IT question set (removed); do not add it_failover or gate on failover.
 * Every question must have help_key (enforced at load).
 */
import { z } from 'zod';

// ─── Question IDs ─────────────────────────────────────────────────────────
export const IT_QUESTION_IDS = [
  'IT-1',
  'IT-2',
  'IT-3',
  'IT-4',
  'IT-5',
  'IT-6',
  'IT-7',
  'IT-11',
] as const;
export type ItQuestionId = (typeof IT_QUESTION_IDS)[number];

// ─── Shared enums (match Energy pattern) ────────────────────────────────────
export const DesignationSchema = z.enum(['primary', 'secondary', 'unknown']);
export type Designation = z.infer<typeof DesignationSchema>;

export const SharedCorridorSchema = z.enum(['yes', 'no', 'unknown']);
export type SharedCorridor = z.infer<typeof SharedCorridorSchema>;

export const YesNoUnknownSchema = z.enum(['yes', 'no', 'unknown']);
export type YesNoUnknown = z.infer<typeof YesNoUnknownSchema>;

export const YesNoUnknownOrNaSchema = z.enum(['yes', 'no', 'unknown', 'na']);
export type YesNoUnknownOrNa = z.infer<typeof YesNoUnknownOrNaSchema>;

type TransportType = 'VOICE_TRANSPORT' | 'DATA_TRANSPORT';
const IT_TRANSPORT_TYPE: TransportType = 'DATA_TRANSPORT';

export const ItInstallationLocationSchema = z.enum([
  'exterior_at_grade',
  'exterior_elevated_or_protected',
  'interior_or_underground',
  'unknown',
]);
export type ItInstallationLocation = z.infer<typeof ItInstallationLocationSchema>;

// ─── IT-1 Service Provider ───────────────────────────────────────────────
export const ItServiceProviderEntrySchema = z.object({
  provider_name: z.string().min(1, 'Provider name is required'),
  designation: DesignationSchema,
});
export type ItServiceProviderEntry = z.infer<typeof ItServiceProviderEntrySchema>;

// ─── IT-2 Critical Services (externally hosted/managed; catalog + Other) ─────
/** Normalize legacy row (asset_name_or_id) to new shape (service_id + service_other). */
function normalizeLegacyIt2Row(raw: unknown): unknown {
  if (raw == null || typeof raw !== 'object') return raw;
  const row = raw as Record<string, unknown>;
  if (row.service_id != null && String(row.service_id).trim() !== '') return raw;
  const legacyName = row.asset_name_or_id;
  if (legacyName != null && String(legacyName).trim() !== '') {
    return {
      ...row,
      service_id: 'other',
      service_other: String(legacyName).trim(),
      service_provider: row.service_provider ?? row.provider ?? '',
      asset_name_or_id: undefined,
    };
  }
  return raw;
}

const ItUpstreamAssetEntryBaseSchema = z.object({
  service_id: z.string().optional(), // Empty = incomplete row (allowed until user selects)
  service_other: z.string().optional(),
  service_provider: z.string().optional(),
  location: z.string().optional(),
  designation: DesignationSchema.optional().default('unknown'),
  notes: z.string().optional(),
  asset_name_or_id: z.string().optional(), // Legacy; ignored when service_id present
});

export const ItUpstreamAssetEntrySchema = ItUpstreamAssetEntryBaseSchema.superRefine((data, ctx) => {
  const id = (data.service_id ?? '').trim();
  if (id === '') return; // Incomplete row; skip
  if (id === 'other') {
    const other = (data.service_other ?? '').trim();
    if (other === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please specify the service name when selecting Other.',
        path: ['service_other'],
      });
    }
  }
});

export type ItUpstreamAssetEntry = z.infer<typeof ItUpstreamAssetEntrySchema>;

/** Preprocess each IT-2 row to migrate legacy asset_name_or_id → service_id=other + service_other. */
const ItUpstreamAssetEntryWithMigrationSchema = z.preprocess(
  normalizeLegacyIt2Row,
  ItUpstreamAssetEntrySchema
);

// ─── IT-4 Service Connection Entry ────────────────────────────────────────
export const ItConnectionEntrySchema = z.object({
  connection_label: z.string().min(1, 'Connection label is required'),
  facility_entry_location: z.string().min(1, 'Facility entry location is required'),
  associated_provider: z.string().optional(),
  shared_corridor_with_other_utilities: SharedCorridorSchema,
});
export type ItConnectionEntry = z.infer<typeof ItConnectionEntrySchema>;

// ─── IT-6 Component Protection ──────────────────────────────────────────────
export const ItComponentProtectionSchema = z.object({
  component_type: z.string().min(1, 'Component type is required'),
  location: z.string().min(1, 'Location is required'),
  protection_type: z.string().min(1, 'Protection type is required'),
});
export type ItComponentProtection = z.infer<typeof ItComponentProtectionSchema>;

// ─── Cyber / Continuity / Recovery (plan exercising) ────────────────────────
/** Q-IT-PLAN-EXISTS: Does the facility maintain an IT continuity or recovery plan? */
export const ItContinuityPlanExistsSchema = z.enum(['yes', 'no', 'unknown']);
export type ItContinuityPlanExists = z.infer<typeof ItContinuityPlanExistsSchema>;

/** Q-IT-PLAN-EXERCISED: Has the plan been exercised or tested? (only when plan exists = yes) */
export const ItPlanExercisedSchema = z.enum([
  'yes_within_12_months',
  'yes_over_12_months_ago',
  'no',
  'unknown',
]);
export type ItPlanExercised = z.infer<typeof ItPlanExercisedSchema>;

/** Q-IT-EXERCISE-SCOPE: Scope of most recent exercise (only when exercised = yes) */
export const ItExerciseScopeSchema = z.enum([
  'tabletop_discussion',
  'functional_technical_test',
  'full_operational_exercise',
  'unknown',
]);
export type ItExerciseScope = z.infer<typeof ItExerciseScopeSchema>;

// ─── Curve (chart) fields ──────────────────────────────────────────────────
export const ItCurveSchema = z.object({
  curve_requires_service: z.boolean().optional(),
  curve_primary_provider: z.string().optional(),
  curve_time_to_impact_hours: z.number().min(0).max(72).nullable().optional(),
  curve_loss_fraction_no_backup: z.number().min(0).max(1).nullable().optional(),
  curve_backup_available: YesNoUnknownSchema.optional(),
  curve_backup_duration_hours: z.number().min(0).max(96).nullable().optional(),
  curve_loss_fraction_with_backup: z.number().min(0).max(1).nullable().optional(),
  curve_recovery_time_hours: z.number().min(0).max(168).nullable().optional(),
  /** Redundancy initiation (only when backup/alternate exists). */
  redundancy_activation: z
    .object({
      mode: z.enum(['AUTOMATIC', 'MANUAL_ONSITE', 'MANUAL_REMOTE', 'VENDOR_REQUIRED', 'UNKNOWN']),
      activation_delay_min: z.number().min(0).max(10080).nullable().optional(),
      requires_trained_personnel: z.boolean().nullable().optional(),
      trained_personnel_24_7: z.boolean().nullable().optional(),
      remote_initiation_available: z.boolean().nullable().optional(),
      vendor_dispatch_required: z.boolean().nullable().optional(),
      documented_and_tested: z.boolean().nullable().optional(),
    })
    .optional(),
});
export type ItCurveInput = z.infer<typeof ItCurveSchema>;

// ─── Answers schema ────────────────────────────────────────────────────────
export const ItAnswersSchema = z
  .object({
    // Curve fields (primary/secondary ISP stored in supply.sources; curve_* used for questionnaire sync)
    curve_requires_service: z.boolean().optional(),
    curve_primary_provider: z.string().optional(),
    curve_secondary_provider: z.string().optional(),
    curve_time_to_impact_hours: z.number().min(0).max(72).nullable().optional(),
    curve_loss_fraction_no_backup: z.number().min(0).max(1).nullable().optional(),
    curve_backup_available: YesNoUnknownSchema.optional(),
    curve_loss_fraction_with_backup: z.number().min(0).max(1).nullable().optional(),
    curve_recovery_time_hours: z.number().min(0).max(168).nullable().optional(),
    /** Redundancy initiation (only when backup/alternate exists). */
    redundancy_activation: z
      .object({
        mode: z.enum(['AUTOMATIC', 'MANUAL_ONSITE', 'MANUAL_REMOTE', 'VENDOR_REQUIRED', 'UNKNOWN']),
        activation_delay_min: z.number().min(0).max(10080).nullable().optional(),
        requires_trained_personnel: z.boolean().nullable().optional(),
        trained_personnel_24_7: z.boolean().nullable().optional(),
        remote_initiation_available: z.boolean().nullable().optional(),
        vendor_dispatch_required: z.boolean().nullable().optional(),
        documented_and_tested: z.boolean().nullable().optional(),
      })
      .optional(),
    // IT-1 (optional for blank initial state)
    'IT-1_can_identify_providers': YesNoUnknownSchema.optional(),
    'IT-1_service_providers': z.array(ItServiceProviderEntrySchema).default([]),
    // IT-2
    'IT-2_can_identify_assets': YesNoUnknownOrNaSchema.optional(),
    'IT-2_upstream_assets': z.array(ItUpstreamAssetEntryWithMigrationSchema).default([]),
    // IT-3
    'IT-3_multiple_connections': YesNoUnknownSchema.optional(),
    'IT-3_connection_count': z.number().int().min(0).optional(),
    // IT-4
    'IT-4_physically_separated': YesNoUnknownOrNaSchema.optional(),
    'IT-4_service_connections': z.array(ItConnectionEntrySchema).default([]),
    // IT-5
    'IT-5_survivability': YesNoUnknownSchema.optional(),
    // IT-6
    'IT-6_components_protected': YesNoUnknownSchema.optional(),
    'IT-6_protections': z.array(ItComponentProtectionSchema).default([]),
    // IT-7
    'IT-7_installation_location': ItInstallationLocationSchema.optional(),
    'IT-7_vehicle_impact_exposure': YesNoUnknownOrNaSchema.optional(),
    'IT-7a_vehicle_impact_protection': YesNoUnknownSchema.optional(),
    // IT-11 (legacy single value; derived from it_pra_sla_providers[0] for conditions when per-provider used)
    'IT-11_restoration_coordination': YesNoUnknownSchema.optional(),
    /** PRA/SLA per ISP: restoration coordination and priority restoration by provider (from curve_primary_provider, curve_secondary_provider). */
    it_pra_sla_providers: z
      .array(
        z.object({
          name: z.string(),
          restoration_coordination: YesNoUnknownSchema.optional(),
          priority_restoration: YesNoUnknownSchema.optional(),
        })
      )
      .default([]),
    // Cyber / Continuity / Recovery (plan exercising)
    it_continuity_plan_exists: ItContinuityPlanExistsSchema.optional(),
    it_plan_exercised: ItPlanExercisedSchema.optional(),
    it_exercise_scope: ItExerciseScopeSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.curve_requires_service === true) {
      const provider = data.curve_primary_provider;
      if (provider == null || String(provider).trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provider information is required when reliance is YES.',
          path: ['curve_primary_provider'],
        });
      }
    }
    if (data['IT-1_can_identify_providers'] === 'yes' && data['IT-1_service_providers'].length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one service provider is required when identified.',
        path: ['IT-1_service_providers'],
      });
    }
    // IT-2 YES → entries optional; YES means "they can identify if needed"
    // IT-3 reframed: yes=single provider, no=multiple; no connection_count validation
    if (data['IT-4_physically_separated'] === 'yes' && data['IT-4_service_connections'].length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one service connection entry is required.',
        path: ['IT-4_service_connections'],
      });
    }
    if (data['IT-6_components_protected'] === 'yes' && data['IT-6_protections'].length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one component protection entry is required.',
        path: ['IT-6_protections'],
      });
    }
    if (
      data['IT-7_installation_location'] !== undefined &&
      data['IT-7_vehicle_impact_exposure'] !== undefined
    ) {
      if (
        data['IT-7_installation_location'] === 'interior_or_underground' &&
        data['IT-7_vehicle_impact_exposure'] !== 'na'
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Vehicle impact exposure is not applicable when installation is interior or underground.',
          path: ['IT-7_vehicle_impact_exposure'],
        });
      }
      if (
        data['IT-7_installation_location'] !== 'interior_or_underground' &&
        data['IT-7_vehicle_impact_exposure'] === 'na'
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select Yes, No, or Unknown for vehicle impact exposure when components are exterior.',
          path: ['IT-7_vehicle_impact_exposure'],
        });
      }
    }
    // IT-7a gated follow-up captured via default; mitigation narrative removed.
  });

export type ItAnswers = z.infer<typeof ItAnswersSchema>;

// ─── Vulnerability triggers ────────────────────────────────────────────────
export const IT_VULNERABILITY_TRIGGERS: Record<
  string,
  { no?: string; yes?: string; entry?: { field: string; value: unknown; vulnerability_id: string }[] }
> = {
  'IT-1': { no: 'IT_PROVIDER_CONCENTRATION' },
  'IT-3': { yes: 'IT_PROVIDER_CONCENTRATION' },
  'IT-5': { no: 'IT_TRANSPORT_SINGLE_PATH' },
  'it_plan_exercised': { no: 'IT_CONTINUITY_NOT_DEMONSTRATED' },
};

// ─── Question definitions ───────────────────────────────────────────────
/** Help keys for help panel / tooltip lookup. Every IT question must have one. */
export const IT_HELP_KEYS = [
  'internet_transport',
  'single_path_exposure',
  'demarc',
  'hosted_services',
  'hosted_continuity',
] as const;
export type ItHelpKey = (typeof IT_HELP_KEYS)[number];

export type ItQuestionDef = {
  id: ItQuestionId | string;
  prompt: string;
  helpText: string;
  /** Required. Used for help icon / panel lookup; prevents silent regression. */
  help_key: ItHelpKey | string;
  answerType: 'boolean' | 'enum' | 'integer' | 'repeatable' | 'number' | 'percent' | 'string';
  yesRequires: string[];
  vulnerabilityTrigger: string;
  transport_type: TransportType;
  feedsChart?: boolean;
  /** Soft-deprecated: hidden in UI, no vulnerability triggers; schema retained for backward compat. */
  deprecated?: boolean;
  /** Optional: Contextual help text for detailed explanation (e.g., when to use N/A). */
  help_text?: string;
};

/** IT question IDs that are soft-deprecated (physical/routing, or duplicate of other questions). */
export const IT_DEPRECATED_QUESTION_IDS = ['IT-4', 'IT-6'] as const;

// ─── SECTION: INTERNET TRANSPORT (curve + primary provider) ─────────────────
export const IT_CURVE_QUESTIONS: ItQuestionDef[] = [
  {
    id: 'curve_requires_service',
    prompt: 'Does the facility rely on internet/data connectivity for core operations?',
    helpText: 'Select YES if this infrastructure is required for normal operations. If NO, the impact curve will show no operational impact for this infrastructure.',
    help_key: 'internet_transport',
    answerType: 'boolean',
    yesRequires: [],
    vulnerabilityTrigger: '',
    transport_type: IT_TRANSPORT_TYPE,
    feedsChart: true,
    help_text: 'Select YES if normal facility operations depend on internet or external data connectivity. This initiates the impact assessment; if NO, no operational loss is assumed.',
  },
  {
    id: 'curve_primary_provider',
    prompt: 'Who provides primary internet/data connectivity?',
    helpText: 'Required when the facility relies on IT. Enter the name of the primary ISP or data connectivity provider.',
    help_key: 'internet_transport',
    answerType: 'string',
    yesRequires: [],
    vulnerabilityTrigger: '',
    transport_type: IT_TRANSPORT_TYPE,
    feedsChart: false,
    help_text: 'Enter the name of the primary internet or data connectivity provider (e.g., ISP, carrier). Required when reliance is YES.',
  },
  {
    id: 'curve_time_to_impact',
    prompt: 'If IT service is lost (without backup), how soon would the facility be severely impacted? (hours)',
    helpText: 'Estimate how many hours until operations are severely affected if this service is lost and no mitigation is available.',
    help_key: 'internet_transport',
    answerType: 'number',
    yesRequires: [],
    vulnerabilityTrigger: '',
    transport_type: IT_TRANSPORT_TYPE,
    feedsChart: true,
    help_text: 'Estimate in hours how quickly critical IT-dependent operations degrade if service is lost with no backup available. Use realistic estimates based on alternate cloud providers, manual processes, or offline capabilities.',
  },
  {
    id: 'curve_loss_no_backup',
    prompt: 'Once IT service is lost (without backup), what percentage of normal business functions are lost or degraded?',
    helpText: 'Estimate the percent of normal operations that would be lost or degraded without mitigation. Enter 0–100.',
    help_key: 'internet_transport',
    answerType: 'percent',
    yesRequires: [],
    vulnerabilityTrigger: '',
    transport_type: IT_TRANSPORT_TYPE,
    feedsChart: true,
    help_text: 'Enter the percentage (0–100) of facility functions that would be offline if IT service is lost without any backup. 100% means complete shutdown; 0% means no loss.',
  },
  {
    id: 'curve_backup_available',
    prompt: 'Is any backup or alternate IT capability available for this infrastructure?',
    helpText: 'Select YES if there is any alternate method (different provider, degraded-mode access, manual workaround) that could sustain operations. This gates the backup-specific curve questions.',
    help_key: 'internet_transport',
    answerType: 'boolean',
    yesRequires: [],
    vulnerabilityTrigger: 'NO or UNKNOWN → No backup IT capability',
    transport_type: IT_TRANSPORT_TYPE,
    feedsChart: true,
    help_text: 'Select YES if backup or alternate IT capability exists (different cloud provider, on-premises alternatives, manual workarounds, or degraded-mode access). Select NO if no backup exists. This answer determines whether subsequent backup-related questions are asked.',
  },
  {
    id: 'curve_loss_with_backup',
    prompt: 'Once IT service is lost (considering backup), what percentage of normal business functions are lost or degraded?',
    helpText: 'With mitigation in place, estimate the percent of normal operations still lost or degraded. Enter 0–100.',
    help_key: 'internet_transport',
    answerType: 'percent',
    yesRequires: [],
    vulnerabilityTrigger: '',
    transport_type: IT_TRANSPORT_TYPE,
    feedsChart: true,
    help_text: 'Enter the percentage (0–100) of facility functions that would still be offline or degraded even with backup IT capability active. This captures functions requiring the primary service explicitly.',
  },
  {
    id: 'curve_recovery_time',
    prompt: 'Once external IT service is restored, how long until full resumption of operations? (hours)',
    helpText: 'After service is restored, estimate how long it takes to return to normal operations.',
    help_key: 'internet_transport',
    answerType: 'number',
    yesRequires: [],
    vulnerabilityTrigger: '',
    transport_type: IT_TRANSPORT_TYPE,
    feedsChart: true,
    help_text: 'Estimate time (in hours, 0–168) to restore normal facility IT operations after the outage resolves.',
  },
];

// ─── SECTION: CRITICAL HOSTED SERVICES (IT-2 + per-service continuity) ─────
export const IT_QUESTIONS: ItQuestionDef[] = [
  {
    id: 'IT-1',
    prompt: 'Managed IT / Cyber Provider (MSP/MSSP)',
    helpText: 'If YES, list managed IT or cyber providers (MSP/MSSP) only. Connectivity providers (ISPs) belong in Internet Transport above.',
    help_key: 'internet_transport',
    answerType: 'repeatable',
    yesRequires: ['ServiceProvider entries (provider_name, designation)'],
    vulnerabilityTrigger: 'NO → Limited awareness of upstream IT service',
    transport_type: IT_TRANSPORT_TYPE,
    help_text: 'List managed IT or cyber security providers (MSP/MSSP) that supply critical IT services to this facility. Do not list connectivity providers (ISPs)—those are captured in Internet Transport above.',
  },
  {
    id: 'IT-2',
    prompt: 'Has the facility identified critical externally hosted or managed digital services relied upon for core operations (if any).',
    helpText: 'Examples: SaaS platforms, cloud-hosted applications, hosted identity services, managed IT provider platforms. If YES, list what is known; details may be limited. Select NA if the facility does not rely on externally hosted services.',
    help_key: 'hosted_services',
    answerType: 'repeatable',
    yesRequires: [],
    vulnerabilityTrigger: 'NO → Critical external services not identified',
    transport_type: IT_TRANSPORT_TYPE,
    help_text: 'Externally hosted services (SaaS platforms, cloud-hosted applications, identity services) are critical dependencies. Understanding which services you rely on helps identify shared points of failure. Select NA if the facility does not rely on externally hosted services; otherwise select YES, NO, or UNKNOWN.',
  },
  {
    id: 'IT-3',
    prompt: 'Do critical operations rely on a single external IT provider/platform (single point of dependency)?',
    helpText: 'Yes = single provider; No = multiple providers or alternate platforms exist.',
    help_key: 'single_path_exposure',
    answerType: 'boolean',
    yesRequires: [],
    vulnerabilityTrigger: 'Yes or Unknown → Single external IT provider dependency (or unknown provider concentration).',
    transport_type: IT_TRANSPORT_TYPE,
    help_text: 'Relying on a single external IT provider/platform creates single-point-of-failure risk. YES = single provider; NO = multiple providers or alternate platforms exist. UNKNOWN = provider concentration is unclear.',
  },
  {
    id: 'IT-4',
    prompt: 'Demarcation and path independence: are internet connections physically separated, and where does each terminate?',
    helpText:
      'Select Yes when connections use different facility entry points/rooms/conduits. Select No when they terminate in the same room/entry or share corridor segments. Add one row per connection with provider, demarcation location, and path-independence evidence.',
    help_key: 'single_path_exposure',
    answerType: 'repeatable',
    yesRequires: ['ItConnection entries (associated_provider, connection_label, facility_entry_location, shared_corridor_with_other_utilities)'],
    vulnerabilityTrigger: 'NO → Co-located entry points; shared_corridor YES → Collocated with other utilities',
    transport_type: IT_TRANSPORT_TYPE,
    help_text:
      'This question captures both demarcation detail and physical-path independence. Record each connection with provider name, exact termination location (e.g., room/IDF/MPOE), and whether the route shares corridor/entry with another connection or utility. This evidence drives Internet Transport resilience reporting.',
  },
  {
    id: 'IT-5',
    prompt: 'Can the alternate method (if used) support core operations at an acceptable level?',
    helpText: 'This is about external IT service continuity (alternate provider/platform, degraded-mode operations, manual workaround).',
    help_key: 'single_path_exposure',
    answerType: 'boolean',
    yesRequires: [],
    vulnerabilityTrigger: 'NO or Unknown → Fallback capability may not support critical operations.',
    transport_type: IT_TRANSPORT_TYPE,
    help_text: 'Evaluate whether your alternate method (alternate provider/platform, degraded-mode operations, manual workaround) can support core operations at an acceptable level. YES = alternate method is sufficient; NO = it is insufficient or untested.',
  },
  {
    id: 'IT-6',
    prompt: 'Are IT infrastructure components protected from accidental/intentional physical damage?',
    helpText: 'If YES, add one entry per component type with location and protection type.',
    help_key: 'demarc',
    answerType: 'repeatable',
    yesRequires: ['ItComponentProtection entries (component_type, location, protection_type)'],
    vulnerabilityTrigger: 'NO → Unprotected exterior components',
    transport_type: IT_TRANSPORT_TYPE,
    deprecated: true,
    help_text: 'Exterior IT components (network cabinets, fiber termination points, antenna installations) exposed to the public are vulnerable to accidental or intentional damage. List all exposed components and describe protection type.',
  },
  {
    id: 'IT-7',
    prompt: 'Where are critical IT infrastructure components installed relative to vehicle access?',
    helpText:
      'Answer based on cabling, network termination cabinets, or other IT infrastructure components relied upon for this dependency. Interior or underground installations automatically set vehicle impact to N/A.',
    help_key: 'demarc',
    answerType: 'enum',
    yesRequires: [],
    vulnerabilityTrigger: '',
    transport_type: IT_TRANSPORT_TYPE,
    help_text: 'Assess where critical IT infrastructure components (cabling, network termination cabinets, junction boxes) are installed relative to vehicle access. Interior or underground installations have no vehicle impact risk.',
  },
  {
    id: 'IT-7a',
    prompt: 'Are protective measures in place to reduce vehicle impact risk to IT infrastructure components?',
    helpText: 'Only shown when IT-7 indicates components are exterior and exposed to vehicle paths.',
    help_key: 'demarc',
    answerType: 'boolean',
    yesRequires: [],
    vulnerabilityTrigger: 'NO → Vehicle impact exposure without protection (condition code only)',
    transport_type: IT_TRANSPORT_TYPE,
    help_text: 'If vehicle impact is a concern (IT-7 indicates exterior exposure), confirm whether protective barriers or standoff distance reduce the risk. Examples: bollards, ground-mounted enclosures, elevated or recessed installations.',
  },
  {
    id: 'IT-11',
    prompt: 'Does the facility have established coordination with the external IT service provider for restoration during outages?',
    helpText: 'If YES, coordination is documented and restoration priority is understood.',
    help_key: 'internet_transport',
    answerType: 'boolean',
    yesRequires: [],
    vulnerabilityTrigger: 'NO → restoration realism gap',
    transport_type: IT_TRANSPORT_TYPE,
    help_text: 'In widespread outages, provider restoration follows a prioritization sequence. Confirm whether your facility has documented coordination (SLA, mutual aid agreements, priority restoration status) with the external IT service provider.',
  },
  {
    id: 'it_plan_exercised',
    prompt: 'Has the IT continuity or recovery plan been exercised or tested?',
    helpText: 'Only asked when plan exists (it_continuity_plan_exists Yes). NO/Unknown → plan may not be effective if not exercised.',
    help_key: 'internet_transport',
    answerType: 'enum',
    yesRequires: [],
    vulnerabilityTrigger: 'NO → Information technology recovery plans may not be effective if not exercised',
    transport_type: IT_TRANSPORT_TYPE,
    help_text: 'IT continuity or recovery plans that are never exercised may fail when needed. Confirm whether you routinely test or exercise your IT recovery plan to validate procedures and identify gaps.',
  },
];

// ─── Hosted continuity (per-service; only after hosted services selected) ──
/** Help key for hosted continuity. Gate only on it_hosted_services.length > 0; do not gate on transport. */
export const HOSTED_CONTINUITY_HELP_KEY: ItHelpKey = 'hosted_continuity';

/** Hosted continuity: 3 options + Unknown. Internet connectivity loss — hosted services unreachable. No transport/ISP wording (Communications evaluates those). */
export const HOSTED_CONTINUITY_OPTIONS: { value: 'NO_CONTINUITY' | 'LOCAL_MIRROR_OR_CACHE' | 'ALTERNATE_PLATFORM_OR_PROVIDER' | 'UNKNOWN'; label: string }[] = [
  { value: 'NO_CONTINUITY', label: 'No continuity — key functions stop.' },
  { value: 'LOCAL_MIRROR_OR_CACHE', label: 'Local mirror / offline copy allows limited operation.' },
  { value: 'ALTERNATE_PLATFORM_OR_PROVIDER', label: 'Alternate provider/platform/workflow already established.' },
  { value: 'UNKNOWN', label: 'Unknown.' },
];

/** Per-service hosted continuity question. Internet connectivity loss — hosted services unreachable; do not reference ISP, transport, or circuits (Communications module). */
export const HOSTED_CONTINUITY_TITLE = 'If internet connectivity to the facility is lost and externally hosted services become unreachable, how would operations continue?';

/** Per-service hosted continuity question definition. Show only when service is in it_hosted_services (IT-2). Do not gate on transport answers. */
export function getHostedContinuityQuestionDef(serviceId: string): ItQuestionDef {
  return {
    id: `it_hosted_continuity_${serviceId}`,
    prompt: HOSTED_CONTINUITY_TITLE,
    helpText: 'Assess operational impact when internet connectivity is lost and hosted services cannot be reached. Choose: no continuity (key functions stop), local mirror/offline copy (limited operation), or alternate provider/platform already established. ISP and circuit redundancy are evaluated in the Communications module.',
    help_key: HOSTED_CONTINUITY_HELP_KEY,
    answerType: 'enum',
    yesRequires: [],
    vulnerabilityTrigger: 'NO_CONTINUITY → Hosted service lacks workable continuity',
    transport_type: IT_TRANSPORT_TYPE,
  };
}

/** Throws if any IT question is missing help_key. Prevents silent regression. */
export function assertAllItQuestionsHaveHelpKey(): void {
  const all = [...IT_CURVE_QUESTIONS, ...IT_QUESTIONS];
  for (const q of all) {
    if (q.help_key === undefined || q.help_key === '') {
      throw new Error(`Missing help_key in IT spec: question id="${q.id}"`);
    }
  }
}
assertAllItQuestionsHaveHelpKey();

/**
 * Validation: for each selected hosted service, continuity must be selected.
 * Call with category (assessment.categories.INFORMATION_TECHNOLOGY).
 * Returns error messages; empty array if valid.
 */
export function validateHostedContinuityRequired(category: {
  'IT-2_upstream_assets'?: Array<{ service_id?: string; service_other?: string }>;
  it_hosted_resilience?: Record<string, { survivability?: string }>;
}): string[] {
  const assets = category['IT-2_upstream_assets'] ?? [];
  const resilience = category.it_hosted_resilience ?? {};
  const errors: string[] = [];
  for (const row of assets) {
    const sid = (row.service_id ?? '').toString().trim();
    if (!sid) continue;
    const depKey = sid.toLowerCase() === 'other' ? `other_${(row.service_other ?? '').toString().trim() || 'other'}` : sid;
    const entry = resilience[depKey];
    const surv = entry?.survivability;
    if (surv === undefined || surv === '') {
      errors.push('Continuity must be selected for each critical hosted service.');
      break;
    }
  }
  return errors;
}

/** Default IT answers (all blank). */
export function getDefaultItAnswers(): ItAnswers {
  return {
    curve_requires_service: undefined,
    curve_primary_provider: undefined,
    curve_secondary_provider: undefined,
    curve_time_to_impact_hours: undefined,
    curve_loss_fraction_no_backup: undefined,
    curve_loss_fraction_with_backup: undefined,
    curve_recovery_time_hours: undefined,
    redundancy_activation: undefined,
    'IT-1_can_identify_providers': undefined,
    'IT-1_service_providers': [],
    'IT-2_can_identify_assets': undefined,
    'IT-2_upstream_assets': [],
    'IT-3_multiple_connections': undefined,
    'IT-3_connection_count': undefined,
    'IT-4_physically_separated': undefined,
    'IT-4_service_connections': [],
    'IT-5_survivability': undefined,
    'IT-6_components_protected': undefined,
    'IT-6_protections': [],
    'IT-7_installation_location': undefined,
    'IT-7_vehicle_impact_exposure': undefined,
    'IT-7a_vehicle_impact_protection': undefined,
    'IT-11_restoration_coordination': undefined,
    it_pra_sla_providers: [],
    it_continuity_plan_exists: undefined,
    it_plan_exercised: undefined,
    it_exercise_scope: undefined,
  };
}
