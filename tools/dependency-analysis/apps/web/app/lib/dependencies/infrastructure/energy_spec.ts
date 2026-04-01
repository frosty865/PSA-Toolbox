/**
 * Canonical ENERGY dependency spec (single source of truth).
 * LOCKED question set E-2 through E-11 with YES data requirements and vulnerability triggers.
 */
import { z } from 'zod';

// ─── Question IDs ─────────────────────────────────────────────────────────
export const ENERGY_QUESTION_IDS = [
  'E-2',
  'E-3',
  'E-4',
  'E-5',
  'E-6',
  'E-7',
  'E-8',
  'E-9',
  'E-10',
] as const;
export type EnergyQuestionId = (typeof ENERGY_QUESTION_IDS)[number];

// ─── Shared enums ─────────────────────────────────────────────────────────
export const DesignationSchema = z.enum(['primary', 'secondary', 'unknown']);
export type Designation = z.infer<typeof DesignationSchema>;

export const SharedCorridorSchema = z.enum(['yes', 'no', 'unknown']);
export type SharedCorridor = z.infer<typeof SharedCorridorSchema>;

export const BackupAssetTypeSchema = z.enum(['generator', 'ups', 'other']);
export type BackupAssetType = z.infer<typeof BackupAssetTypeSchema>;

export const SupportedLoadClassificationSchema = z.enum([
  'life_safety',
  'critical_core_services',
  'full_facility_load',
]);
export type SupportedLoadClassification = z.infer<typeof SupportedLoadClassificationSchema>;

export const FuelSourceSchema = z.enum(['onsite', 'external', 'mixed', 'unknown']);
export type FuelSource = z.infer<typeof FuelSourceSchema>;

export const TestFrequencySchema = z.enum(['monthly', 'quarterly', 'semi_annual', 'annual', 'other', 'unknown']);
export type TestFrequency = z.infer<typeof TestFrequencySchema>;

export const LoadConditionSchema = z.enum(['full', 'partial', 'unknown']);
export type LoadCondition = z.infer<typeof LoadConditionSchema>;

export const CoordinationNatureSchema = z.enum(['informal', 'documented', 'contractual', 'unknown']);
export type CoordinationNature = z.infer<typeof CoordinationNatureSchema>;

/** Main question answer: Yes, No, or Unknown. Unknown does not trigger NO-based vulnerabilities. */
export const YesNoUnknownSchema = z.enum(['yes', 'no', 'unknown']);
export type YesNoUnknown = z.infer<typeof YesNoUnknownSchema>;

/** Yes/No/Unknown with N/A for questions that do not apply (e.g. only one service connection). */
export const YesNoUnknownOrNaSchema = z.enum(['yes', 'no', 'unknown', 'na']);
export type YesNoUnknownOrNa = z.infer<typeof YesNoUnknownOrNaSchema>;

// ─── E-2 Substations (if known; location optional free text) ───────────────
export const SubstationEntrySchema = z.object({
  substation_name_or_id: z.string().min(1, 'Substation name or ID is required'),
  location: z.string().optional(), // Optional: free text or coordinates
  utility_provider: z.string().min(1, 'Utility provider is required'),
  designation: DesignationSchema,
});
export type SubstationEntry = z.infer<typeof SubstationEntrySchema>;

// ─── E-4 Service Connections ───────────────────────────────────────────────
export const ServiceConnectionEntrySchema = z.object({
  connection_label: z.string().min(1, 'Connection label is required'),
  facility_entry_location: z.string().min(1, 'Facility entry (Lat/Long) is required'),
  associated_substation: z.string().optional(),
  shared_corridor_with_other_utilities: SharedCorridorSchema,
});
export type ServiceConnectionEntry = z.infer<typeof ServiceConnectionEntrySchema>;

// ─── E-5 Single connection supports core ops ───────────────────────────────
export const CoreOpsCapableSchema = z.object({
  capable_connection_labels: z.array(z.string().min(1)).min(1, 'At least one capable connection is required'),
});
export type CoreOpsCapable = z.infer<typeof CoreOpsCapableSchema>;

// ─── E-6 Exterior electrical protection ───────────────────────────────────
export const ExteriorElectricalAssetProtectionSchema = z.object({
  component_type: z.string().min(1, 'Component type is required'),
  location: z.string().min(1, 'Lat/Long is required'),
  protection_type: z.string().min(1, 'Protection type is required'),
});
export type ExteriorElectricalAssetProtection = z.infer<typeof ExteriorElectricalAssetProtectionSchema>;

/** Dropdown options for E-6 "Unprotected exterior electrical components" (Vulnerability: NO). */
export const EXTERIOR_ELECTRICAL_COMPONENT_OPTIONS: { label: string; options: string[] }[] = [
  {
    label: 'Primary Distribution',
    options: [
      'Service Entrance Conductors',
      'Exterior Busway (Bus Duct)',
      'Main Distribution Panel (MDP)',
      'Switchgear (Outdoor)',
      'Switchboard (Outdoor)',
      'Utility Service Disconnect',
      'Meter Bank / Meter Stack',
    ],
  },
  {
    label: 'Power Transformation',
    options: [
      'Pad-Mounted Transformer (Utility-Owned)',
      'Building-Owned Transformer',
      'Step-Up / Step-Down Transformer',
    ],
  },
  {
    label: 'Generation / Backup',
    options: [
      'Generator (Fixed)',
      'Automatic Transfer Switch (ATS)',
      'Paralleling Gear',
      'Fuel Pump / Day Tank Controls (Exterior)',
    ],
  },
  {
    label: 'Secondary Distribution',
    options: [
      'Subpanel (Exterior)',
      'Motor Control Center (MCC)',
      'Distribution Cabinet / Junction Cabinet',
      'Exterior Disconnect Switch',
    ],
  },
  {
    label: 'Infrastructure Support',
    options: [
      'Grounding / Bonding System (Exterior)',
      'Conduit Bank / Riser',
      'Overhead Service Drop',
      'EV Charging Electrical Cabinet',
    ],
  },
  {
    label: 'Other',
    options: ['Other (Specify)'],
  },
];

// ─── E-8 Backup power assets ──────────────────────────────────────────────
export const BackupPowerAssetSchema = z
  .object({
    asset_type: BackupAssetTypeSchema,
    supported_load_classification: z
      .array(SupportedLoadClassificationSchema)
      .min(1, 'At least one supported load classification is required'),
    capacity_kw_or_description: z.string().min(1, 'Capacity or description is required'),
    fuel_type: z.string().optional(),
    estimated_runtime: z.string().min(1, 'Estimated runtime is required (use "unknown" if not known)'),
  })
  .superRefine((data, ctx) => {
    if (data.asset_type === 'generator' && (!data.fuel_type || !data.fuel_type.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Fuel type is required for generator assets.',
        path: ['fuel_type'],
      });
    }
  });
export type BackupPowerAsset = z.infer<typeof BackupPowerAssetSchema>;

// ─── E-9 Fuel sustainment (YES details) ─────────────────────────────────────
export const FuelSupplierEntrySchema = z.object({
  supplier_name: z.string(),
  estimated_resupply_timeframe: z.string().optional(),
  contracted_sla: z.string().optional(),
});
export type FuelSupplierEntry = z.infer<typeof FuelSupplierEntrySchema>;

export const FuelSustainmentSchema = z.preprocess(
  (val) => {
    if (val == null || typeof val !== 'object') return val;
    const o = val as Record<string, unknown>;
    if (Array.isArray(o.suppliers)) return val;
    // Migrate legacy: supplier_names + estimated_resupply_timeframe → suppliers
    const names = Array.isArray(o.supplier_names) ? (o.supplier_names as string[]) : [];
    const singleTimeframe = typeof o.estimated_resupply_timeframe === 'string' ? o.estimated_resupply_timeframe : undefined;
    const suppliers = names.length
      ? names.map((name, i) => ({
          supplier_name: name,
          estimated_resupply_timeframe: i === 0 ? singleTimeframe : undefined,
          contracted_sla: undefined,
        }))
      : singleTimeframe
        ? [{ supplier_name: '', estimated_resupply_timeframe: singleTimeframe, contracted_sla: undefined }]
        : [];
    return { ...o, suppliers };
  },
  z.object({
    fuel_source: FuelSourceSchema,
    suppliers: z.array(FuelSupplierEntrySchema).default([]),
  })
);
export type FuelSustainment = z.infer<typeof FuelSustainmentSchema>;

// ─── E-10 Backup testing (YES details) ────────────────────────────────────
export const BackupTestingSchema = z.object({
  test_frequency: TestFrequencySchema,
  load_condition: LoadConditionSchema,
  last_test_date: z.string().min(1, 'Last test date or "unknown" is required'),
});
export type BackupTesting = z.infer<typeof BackupTestingSchema>;

// ─── Curve (chart) fields: drive the impact curve when present ───────────
export const EnergyCurveSchema = z.object({
  curve_requires_service: z.boolean().optional(),
  curve_time_to_impact_hours: z.number().min(0).max(72).nullable().optional(),
  curve_loss_fraction_no_backup: z.number().min(0).max(1).nullable().optional(),
  curve_backup_available: YesNoUnknownSchema.optional(),
  curve_backup_duration_hours: z.number().min(0).max(96).nullable().optional(),
  curve_loss_fraction_with_backup: z.number().min(0).max(1).nullable().optional(),
  curve_recovery_time_hours: z.number().min(0).max(168).nullable().optional(),
});
export type EnergyCurveInput = z.infer<typeof EnergyCurveSchema>;

// ─── Answers schema (per-question) ────────────────────────────────────────
export const EnergyAnswersSchema = z
  .object({
    // Curve (feeds impact chart)
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
    // E-2
    'E-2_can_identify_substations': YesNoUnknownSchema.optional(),
    'E-2_substations': z.array(SubstationEntrySchema).default([]),
    // E-3
    'E-3_more_than_one_connection': YesNoUnknownSchema.optional(),
    'E-3_service_connection_count': z.number().int().min(0).optional(),
    // E-4 (N/A when only one service connection)
    'E-4_physically_separated': YesNoUnknownOrNaSchema.optional(),
    'E-4_service_connections': z.array(ServiceConnectionEntrySchema).default([]),
    // E-5
    'E-5_single_supports_core_ops': YesNoUnknownSchema.optional(),
    'E-5_core_ops_capable': CoreOpsCapableSchema.optional(),
    // E-6
    'E-6_exterior_protected': YesNoUnknownSchema.optional(),
    'E-6_exterior_protections': z.array(ExteriorElectricalAssetProtectionSchema).default([]),
    // E-7
    'E-7_vehicle_impact_exposure': YesNoUnknownSchema.optional(),
    'E-7a_vehicle_impact_protection': YesNoUnknownSchema.optional(),
    // E-8
    'E-8_backup_power_available': YesNoUnknownSchema.optional(),
    'E-8_backup_assets': z.array(BackupPowerAssetSchema).default([]),
    /** @deprecated When E-8 = yes: legacy primary method label kept for backward compatibility. */
    backup_primary_method: z.string().optional(),
    // E-9
    'E-9_refuel_sustainment_established': YesNoUnknownSchema.optional(),
    'E-9_sustainment': FuelSustainmentSchema.optional(),
    // E-10
    'E-10_tested_under_load': YesNoUnknownSchema.optional(),
    'E-10_testing': BackupTestingSchema.optional(),
    // E-11 Provider restoration coordination
    'E-11_provider_restoration_coordination': YesNoUnknownSchema.optional(),
  })
  .superRefine((data, ctx) => {
    // Reliance YES → provider required
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
    // E-2 YES → entries optional; YES means "they can identify if needed"
    // E-3 YES → service_connection_count >= 2 and must match E-4 entries when E-4 is YES
    if (data['E-3_more_than_one_connection'] === 'yes') {
      const count = data['E-3_service_connection_count'];
      if (count == null || count < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Service connection count must be at least 2 when the facility has more than one connection.',
          path: ['E-3_service_connection_count'],
        });
      }
      if (data['E-4_physically_separated'] === 'yes') {
        const entries = data['E-4_service_connections'].length;
        if (count != null && entries !== count) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Service connection count (${count}) must equal the number of service connection entries (${entries}).`,
            path: ['E-4_service_connections'],
          });
        }
      }
    }
    // E-4 YES → at least one service connection; count must match E-3 if E-3 YES. N/A skips these requirements.
    if (data['E-4_physically_separated'] === 'yes' && data['E-4_service_connections'].length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one service connection entry is required when connections are physically separated.',
        path: ['E-4_service_connections'],
      });
    }
    // E-5 YES → core_ops_capable required
    if (data['E-5_single_supports_core_ops'] === 'yes') {
      if (!data['E-5_core_ops_capable']) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Capable connection labels are required when at least one connection supports core operations.',
          path: ['E-5_core_ops_capable'],
        });
      }
    }
    // E-6 YES → at least one protection entry
    if (data['E-6_exterior_protected'] === 'yes' && data['E-6_exterior_protections'].length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one exterior protection entry is required when components are protected.',
        path: ['E-6_exterior_protections'],
      });
    }
    // E-8 YES → at least one backup asset
    if (data['E-8_backup_power_available'] === 'yes' && data['E-8_backup_assets'].length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one backup power asset is required when backup power is available.',
        path: ['E-8_backup_assets'],
      });
    }
    // E-9 YES → sustainment details required
    if (data['E-9_refuel_sustainment_established'] === 'yes' && !data['E-9_sustainment']) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Fuel source and sustainment details are required when refueling procedures are established.',
        path: ['E-9_sustainment'],
      });
    }
    // E-10 YES → testing details required (for narrative)
    if (data['E-10_tested_under_load'] === 'yes' && !data['E-10_testing']) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Test frequency, load condition, and last test date are required when backup is tested under load.',
        path: ['E-10_testing'],
      });
    }
  });

export type EnergyAnswers = z.infer<typeof EnergyAnswersSchema>;

// ─── Vulnerability trigger rules (for reference; derivation in derive_energy_findings) ───
export type VulnerabilityTriggerRule =
  | { when: 'answer'; questionId: EnergyQuestionId; value: boolean }
  | { when: 'any_entry'; questionId: EnergyQuestionId; field: string; value: unknown };

/**
 * Canonical map: every vulnerability MUST be triggered by a question outcome.
 * Format: questionId -> outcome ('no' | 'yes' | 'entry') -> vulnerability_id.
 * 'entry' = triggered by an entry field (e.g. E-4 shared_corridor yes on any connection).
 */
export const ENERGY_VULNERABILITY_TRIGGERS: Record<
  string,
  { no?: string; yes?: string; entry?: { field: string; value: unknown; vulnerability_id: string }[] }
> = {
  'E-3': { no: 'ENERGY_FEED_DIVERSITY' },
  'E-4': { no: 'ENERGY_FEED_DIVERSITY' },
  'E-5': { no: 'ENERGY_FEED_DIVERSITY' },
  'E-8': {
    no: 'ENERGY_BACKUP_ABSENT',
    entry: [
      { field: 'supported_load_classification', value: 'critical_core_services', vulnerability_id: 'ENERGY_BACKUP_ABSENT' },
      { field: 'supported_load_classification', value: 'full_facility_load', vulnerability_id: 'ENERGY_BACKUP_ABSENT' },
    ],
  },
  'E-9': { no: 'ENERGY_BACKUP_SUSTAIN_TEST' },
  'E-10': { no: 'ENERGY_BACKUP_SUSTAIN_TEST' },
};

// ─── Question metadata (prompts, help, answer type, YES requirements) ──────
export type EnergyQuestionDef = {
  id: EnergyQuestionId | string;
  prompt: string;
  helpText: string;
  answerType: 'boolean' | 'enum' | 'integer' | 'repeatable' | 'number' | 'percent' | 'string';
  yesRequires: string[];
  vulnerabilityTrigger: string;
  /** When true, this question can trigger a vulnerability; vulnerability_id required. */
  triggers_vulnerability?: boolean;
  /** Required when triggers_vulnerability is true. Must match ENERGY_VULNERABILITY_TRIGGERS. */
  vulnerability_id?: string;
  /** When true, this question feeds the impact curve chart. */
  feedsChart?: boolean;
  /** Optional: Contextual help text for detailed explanation (e.g., when to use N/A). */
  help_text?: string;
};

/** Curve (chart) questions — answers drive the impact curve. Shown first. */
export const ENERGY_CURVE_QUESTIONS: EnergyQuestionDef[] = [
  {
    id: 'curve_requires_service',
    prompt: 'Does the facility rely on electric power for core operations?',
    helpText: 'Select YES if this infrastructure is required for normal operations. If NO, the impact curve will show no operational impact for this infrastructure.',
    answerType: 'boolean',
    yesRequires: [],
    vulnerabilityTrigger: '',
    feedsChart: true,
    help_text: 'Select YES if normal facility operations depend on electric power. Select NO if facility can operate indefinitely without grid power (e.g., fully off-grid operations). If NO, remaining curve questions are skipped.',
  },
  {
    id: 'curve_primary_provider',
    prompt: 'Who provides electric power to the facility/site?',
    helpText: 'Required when the facility relies on electric power. Enter the name of the electric utility or provider.',
    answerType: 'string',
    yesRequires: [],
    vulnerabilityTrigger: '',
    feedsChart: false,
    help_text: 'Enter the name of the electric utility or provider that supplies power to this facility/site. Required when reliance is YES.',
  },
  {
    id: 'curve_time_to_impact',
    prompt: 'If electric supply is lost (without backup), how soon would the facility be severely impacted? (hours)',
    helpText: 'Estimate how many hours until operations are severely affected if this service is lost and no mitigation is available.',
    answerType: 'number',
    yesRequires: [],
    vulnerabilityTrigger: '',
    feedsChart: true,
    help_text: 'Estimate in hours how quickly critical operations degrade if grid power is lost with no backup available. Use realistic estimates based on generator startup time, battery capacity, or manual workarounds.',
  },
  {
    id: 'curve_loss_no_backup',
    prompt: 'Once electric supply is lost (without backup), what percentage of normal business functions are lost or degraded?',
    helpText: 'Estimate the percent of normal operations that would be lost or degraded without mitigation. Enter 0–100.',
    answerType: 'percent',
    yesRequires: [],
    vulnerabilityTrigger: '',
    feedsChart: true,
    help_text: 'Enter the percentage (0–100) of facility functions that would be offline if grid power is lost without any backup. 100% means complete shutdown; 0% means no loss.',
  },
  {
    id: 'curve_backup_available',
    prompt: 'Is any backup or alternate power capability available for this infrastructure?',
    helpText: 'Select YES if there is any backup power (generator, UPS, etc.) or alternate supply that could sustain operations. This gates the backup-specific curve questions.',
    answerType: 'boolean',
    yesRequires: [],
    vulnerabilityTrigger: 'NO or UNKNOWN → No backup power capability',
    feedsChart: true,
    help_text: 'Select YES if backup systems (generator, UPS, alternate fuel sources, or grid interconnects) exist to sustain operations during grid outages. Select NO if no backup exists. This answer determines whether subsequent backup-related questions are asked.',
  },
  {
    id: 'curve_backup_duration',
    prompt: 'How many hours can backup power sustain operations without refueling?',
    helpText: 'Estimate how long mitigation can sustain operations before impacts increase (hours).',
    answerType: 'number',
    yesRequires: [],
    vulnerabilityTrigger: '',
    feedsChart: true,
    help_text: 'Estimate the duration (in hours, 0–96) that backup power can sustain full facility operations before manual intervention (refueling) or capacity depletion occurs.',
  },
  {
    id: 'curve_loss_with_backup',
    prompt: 'Once electric supply is lost (considering backup), what percentage of normal business functions are lost or degraded?',
    helpText: 'With mitigation in place, estimate the percent of normal operations still lost or degraded. Enter 0–100.',
    answerType: 'percent',
    yesRequires: [],
    vulnerabilityTrigger: '',
    feedsChart: true,
    help_text: 'Enter the percentage (0–100) of facility functions that would still be offline or degraded even with backup power active. This captures partial load scenarios or functions requiring grid power explicitly.',
  },
  {
    id: 'curve_recovery_time',
    prompt: 'Once external service is restored, how long until full resumption of operations? (hours)',
    helpText: 'After service is restored, estimate how long it takes to return to normal operations.',
    answerType: 'number',
    yesRequires: [],
    vulnerabilityTrigger: '',
    feedsChart: true,
    help_text: 'Estimate time (in hours, 0–168) to restore normal facility operations after grid power returns. Includes utility restoration time, system restart, and data recovery.',
  },
];

export const ENERGY_QUESTIONS: EnergyQuestionDef[] = [
  {
    id: 'E-2',
    prompt: 'If known, which key upstream substation(s) may affect service to this site?',
    helpText: 'Optional. If YES, you may add entries for substations you know; 0 entries is acceptable. Location is free text (nearest facility, general area) — coordinates not required.',
    answerType: 'repeatable',
    yesRequires: [],
    vulnerabilityTrigger: 'NO → Upstream substation(s) unknown',
    help_text: 'Select YES if you can identify specific substations that feed this facility (e.g., from utility maps, field observations). If you don\'t know or prefer not to list them, select NO. This is informational and helps contextualize upstream risk.',
  },
  {
    id: 'E-3',
    prompt: 'Does the facility have more than one electric service connection?',
    helpText: 'If YES, enter the number of service connections (must be ≥ 2).',
    answerType: 'integer',
    yesRequires: ['service_connection_count (≥ 2)'],
    vulnerabilityTrigger: 'NO → Single point of failure (electric)',
    help_text: 'Multiple service connections reduce single-point-of-failure risk. Enter the exact number of independent connections (must be ≥ 2 to satisfy YES). If you have only one connection, select NO.',
  },
  {
    id: 'E-4',
    prompt: 'Are service connections physically separated and independently routed into the facility?',
    helpText: 'Only asked when the facility has more than one service connection (E-3 Yes). If only one connection, use N/A. If YES, add one entry per connection. Number of entries must match service connection count.',
    answerType: 'repeatable',
    yesRequires: ['ServiceConnection entries (connection_label, facility_entry Lat/Long, shared_corridor_with_other_utilities)'],
    vulnerabilityTrigger: 'NO → Co-located entry points; N/A when only one connection',
    help_text: 'Geographic separation of service connections reduces risk from localized events (construction damage, vehicle strikes). For each connection, provide entry location (Lat/Long or facility address) and note if it shares a utility corridor with other systems.',
  },
  {
    id: 'E-5',
    prompt: 'Is at least one service connection capable of supporting core operations independently?',
    helpText: 'If YES, enter the connection label (single connection when E-3 is No) or multiple labels when E-3 is Yes.',
    answerType: 'repeatable',
    yesRequires: ['capable_connection_labels (min 1)'],
    vulnerabilityTrigger: 'NO → Insufficient load survivability',
    help_text: 'Identify which service connection(s) can independently sustain your critical operations. This addresses whether facility operations can survive loss of any single connection. Enter at least one capable connection label.',
  },
  {
    id: 'E-6',
    prompt: 'Are exterior electrical components protected from accidental/intentional damage?',
    helpText: 'If YES, add one entry per component type with Lat/Long and protection type.',
    answerType: 'repeatable',
    yesRequires: ['ExteriorElectricalAssetProtection entries (component_type, Lat/Long, protection_type)'],
    vulnerabilityTrigger: 'NO → Unprotected exterior electrical components',
    help_text: 'Exterior components (transformers, switchgear, conduit) exposed to the public are vulnerable to accidental or intentional damage. List all exposed components and describe protection type (bollards, barriers, fences, etc.). Location helps contextualize risk.',
  },
  {
    id: 'E-7',
    prompt: 'Are exterior electrical components exposed to potential vehicle impact?',
    helpText: 'If YES, confirm whether protective measures are in place (see follow-up).',
    answerType: 'boolean',
    yesRequires: [],
    vulnerabilityTrigger: 'YES → Vehicle impact exposure (see gated protection follow-up)',
    help_text: 'Assess whether facility parking areas, loading docks, or public right-of-ways could result in vehicle contact with electrical infrastructure (transformers, service pedestals, meter banks). This is common in facilities with street-accessible entrances.',
  },
  {
    id: 'E-7a',
    prompt: 'Are protective measures in place to reduce vehicle impact risk to exterior electrical components (e.g., bollards, barriers, standoff, grade separation)?',
    helpText: 'Only shown when E-7 = YES. Answer with YES/NO/UNKNOWN to capture whether protection exists.',
    answerType: 'boolean',
    yesRequires: [],
    vulnerabilityTrigger: 'NO → Exposed without protective measures (condition code only)',
    help_text: 'If vehicle impact is a concern (E-7 = YES), confirm whether protective barriers or standoff distance reduce the risk. Examples: bollards, jersey barriers, concrete plant boxes, elevated platforms, or location away from traffic patterns.',
  },
  {
    id: 'E-8',
    prompt: 'Does the facility have backup power available during loss of commercial power?',
    helpText: 'If YES, add each backup asset and select supported load classification(s): Life Safety, Critical/Core Services, Full Facility Load.',
    answerType: 'repeatable',
    yesRequires: ['BackupPowerAsset entries (asset_type, supported_load_classification, capacity, estimated_runtime)'],
    vulnerabilityTrigger: 'NO or only life_safety → No alternate power capability for core operations',
    help_text: 'Document all backup power systems including generators, UPS, battery backup, or alternate grid interconnections. For each, specify asset type, which facility loads it supports (life-safety only vs. critical operations), capacity, and estimated runtime.',
  },
  {
    id: 'E-9',
    prompt: 'Are refueling/sustainment procedures established for extended backup operation?',
    helpText: 'Only asked when backup power is available (E-8 Yes). If YES, provide fuel source and optional supplier/timeframe.',
    answerType: 'boolean',
    yesRequires: ['fuel_source (onsite|external|mixed|unknown)'],
    vulnerabilityTrigger: 'NO → No refueling/sustainment planning',
    help_text: 'For backup power to sustain operations beyond its storage capacity, fuel or sustainment procedures must exist. Specify fuel source (onsite tanks, external supply contracts, mixed). This is critical for extended outages lasting days or weeks.',
  },
  {
    id: 'E-10',
    prompt: 'Are backup power systems routinely tested under operational load?',
    helpText: 'Only asked when backup power is available (E-8 Yes). If YES, provide test frequency, load condition, and last test date (used in narrative only).',
    answerType: 'boolean',
    yesRequires: ['test_frequency, load_condition, last_test_date'],
    vulnerabilityTrigger: 'NO → Backup power reliability uncertain',
    help_text: 'Backup systems that are never tested under load may fail when needed. Document test frequency (monthly, quarterly, annual), load condition (full, partial), and last test date to establish maintenance rigor.',
  },
  {
    id: 'E-11',
    prompt: 'Does the facility have established coordination with the electric utility provider for restoration?',
    helpText: 'If YES, coordination is documented and restoration priority is understood.',
    answerType: 'boolean',
    yesRequires: [],
    vulnerabilityTrigger: 'NO → No restoration coordination arrangement',
    help_text: 'In widespread outages, utility restoration follows a prioritization sequence. Confirm whether your facility has documented coordination (SLA, mutual aid agreements, priority restoration status) with the electric utility provider.',
  },
];

/** Default energy answers (all blank). */
export function getDefaultEnergyAnswers(): EnergyAnswers {
  return {
    curve_requires_service: undefined,
    curve_primary_provider: undefined,
    curve_time_to_impact_hours: undefined,
    curve_loss_fraction_no_backup: undefined,
    curve_backup_available: undefined,
    curve_backup_duration_hours: undefined,
    curve_loss_fraction_with_backup: undefined,
    curve_recovery_time_hours: undefined,
    redundancy_activation: undefined,
    'E-2_can_identify_substations': undefined,
    'E-2_substations': [],
    'E-3_more_than_one_connection': undefined,
    'E-3_service_connection_count': undefined,
    'E-4_physically_separated': undefined,
    'E-4_service_connections': [],
    'E-5_single_supports_core_ops': undefined,
    'E-5_core_ops_capable': undefined,
    'E-6_exterior_protected': undefined,
    'E-6_exterior_protections': [],
    'E-7_vehicle_impact_exposure': undefined,
    'E-7a_vehicle_impact_protection': undefined,
    'E-8_backup_power_available': undefined,
    'E-8_backup_assets': [],
    backup_primary_method: undefined,
    'E-9_refuel_sustainment_established': undefined,
    'E-9_sustainment': undefined,
    'E-10_tested_under_load': undefined,
    'E-10_testing': undefined,
    'E-11_provider_restoration_coordination': undefined,
  };
}
