/**
 * Communications (Voice / Command & Control) — PACE-based spec.
 * LOCK: Voice/radio/dispatch transport only. Do NOT include internet/data transport (see IT tab).
 */
import { z } from 'zod';

// ─── LOCK: Doctrine block (used by UI) ───────────────────────────────────
export const COMMUNICATIONS_TAB_ID = 'COMMUNICATIONS' as const;

export const COMMUNICATIONS_PURPOSE_BLOCK = {
  purpose:
    'Evaluates dependency on external voice/radio/dispatch transport for command & control and incident coordination. Measures operational impact of losing voice communications.',
  includes: [
    'Voice/radio/cellular/satellite voice transport',
    'Command & control and dispatch systems',
    'Operational impact of loss (timing, functional loss, recovery)',
    'PACE plan (Primary / Alternate / Contingency / Emergency)',
    'Upstream provider and carrier context',
  ],
  excludes: [
    'Internet/data connectivity (see Information Technology tab)',
    'Internal IT architecture, cybersecurity governance',
    'CCTV/access control networks',
    'Physical hardening of telecom cabinets (bollards, vehicle impact)',
  ],
  curve_driver: 'Loss of external voice/command communications',
  boundary_warning:
    'Do NOT answer with internet/data connectivity details; that belongs in the Information Technology tab.',
} as const;

// ─── Enums (dropdown options) ─────────────────────────────────────────────
export const COMM_VOICE_FUNCTION_VALUES = [
  'SECURITY_COORDINATION',
  'EXEC_LEADERSHIP',
  'EMERGENCY_RESPONSE',
  'FACILITY_OPERATIONS',
  'PUBLIC_MESSAGING',
  'DISPATCH_OPERATIONS',
  'OTHER',
] as const;
export type CommVoiceFunction = (typeof COMM_VOICE_FUNCTION_VALUES)[number];

export const COMM_PACE_SYSTEM_TYPE_VALUES = [
  'CELLULAR_VOICE',
  'PUSH_TO_TALK_CELLULAR',
  'LANDLINE_VOIP_TRUNK',
  'RADIO_ANALOG',
  'RADIO_DIGITAL',
  'PUBLIC_SAFETY_RADIO_NETWORK',
  'SATELLITE_PHONE',
  'INTERNAL_PA',
  'MANUAL_RUNNER',
  'NONE',
  'UNKNOWN',
] as const;
export type CommPaceSystemType = (typeof COMM_PACE_SYSTEM_TYPE_VALUES)[number];

/** Cellular-only: shown when system_type is CELLULAR_VOICE or PUSH_TO_TALK_CELLULAR */
export const COMM_CELLULAR_DIVERSITY_VALUES = ['SINGLE_CARRIER', 'MULTI_CARRIER', 'UNKNOWN'] as const;
export type CommCellularDiversity = (typeof COMM_CELLULAR_DIVERSITY_VALUES)[number];

export const COMM_CELLULAR_PRIORITY_VALUES = ['NONE', 'WPS_GETS', 'FIRSTNET', 'UNKNOWN'] as const;
export type CommCellularPriority = (typeof COMM_CELLULAR_PRIORITY_VALUES)[number];

export const COMM_CELLULAR_COVERAGE_VALUES = [
  'GOOD_INDOOR',
  'LIMITED_INDOOR',
  'REQUIRES_DAS_BOOSTERS',
  'UNKNOWN',
] as const;
export type CommCellularCoverage = (typeof COMM_CELLULAR_COVERAGE_VALUES)[number];

/** Display labels for cellular dropdowns (avoids raw enum in UI and clarifies NONE/UNKNOWN). */
export const COMM_CELLULAR_DIVERSITY_LABELS: Record<CommCellularDiversity, string> = {
  SINGLE_CARRIER: 'Single carrier',
  MULTI_CARRIER: 'Multiple carriers',
  UNKNOWN: 'Unknown',
};
export const COMM_CELLULAR_PRIORITY_LABELS: Record<CommCellularPriority, string> = {
  NONE: 'No priority service (standard commercial)',
  WPS_GETS: 'Wireless Priority Service (WPS) / GETS',
  FIRSTNET: 'FirstNet',
  UNKNOWN: 'Unknown',
};
export const COMM_CELLULAR_COVERAGE_LABELS: Record<CommCellularCoverage, string> = {
  GOOD_INDOOR: 'Good indoor coverage',
  LIMITED_INDOOR: 'Limited indoor coverage',
  REQUIRES_DAS_BOOSTERS: 'Requires DAS / boosters',
  UNKNOWN: 'Unknown',
};

/** Device power (cellular, radio, satellite): battery/charging at device. Not tower power. */
export const COMM_DEVICE_POWER_VALUES = [
  'BATTERY_ONLY',
  'BATTERY_PLUS_CHARGING',
  'CHARGING_DEPENDS_FACILITY_POWER',
  'CHARGING_SUPPORTED_BY_GENERATOR',
  'UNKNOWN',
] as const;
export type CommDevicePower = (typeof COMM_DEVICE_POWER_VALUES)[number];

/** Display labels for device power (avoids redundancy with "charging" options). */
export const COMM_DEVICE_POWER_LABELS: Record<CommDevicePower, string> = {
  BATTERY_ONLY: 'Battery only (no charging during outage)',
  BATTERY_PLUS_CHARGING: 'Battery with charging available',
  CHARGING_DEPENDS_FACILITY_POWER: 'Charging depends on facility power',
  CHARGING_SUPPORTED_BY_GENERATOR: 'Charging supported by generator',
  UNKNOWN: 'Unknown',
};

/** Radio mode (radio types only). */
export const COMM_RADIO_MODE_VALUES = [
  'SIMPLEX_DIRECT',
  'REPEATER',
  'TRUNKED_NETWORK',
  'UNKNOWN',
] as const;
export type CommRadioMode = (typeof COMM_RADIO_MODE_VALUES)[number];

/** Display labels for radio mode. */
export const COMM_RADIO_MODE_LABELS: Record<CommRadioMode, string> = {
  SIMPLEX_DIRECT: 'Simplex (direct)',
  REPEATER: 'Repeater',
  TRUNKED_NETWORK: 'Trunked network',
  UNKNOWN: 'Unknown',
};

/** Internal PA coverage (optional). */
export const COMM_PA_COVERAGE_VALUES = ['BUILDING_WIDE', 'PARTIAL', 'UNKNOWN'] as const;
export type CommPaCoverage = (typeof COMM_PA_COVERAGE_VALUES)[number];

export const COMM_CARRIER_DEPENDENCY_VALUES = [
  'SINGLE_COMMERCIAL',
  'MULTIPLE_COMMERCIAL',
  'PUBLIC_SAFETY_NETWORK',
  'PRIVATE_RADIO_NETWORK',
  'SAT_PROVIDER',
  'INTERNAL_ONLY',
  'UNKNOWN',
] as const;
export type CommCarrierDependency = (typeof COMM_CARRIER_DEPENDENCY_VALUES)[number];

export const COMM_ROUTE_DIVERSITY_VALUES = [
  'DISTINCT_ROUTES',
  'SHARED_CORRIDOR',
  'SHARED_ENTRY_POINT',
  'NOT_APPLICABLE',
  'UNKNOWN',
] as const;
export type CommRouteDiversity = (typeof COMM_ROUTE_DIVERSITY_VALUES)[number];

export const COMM_POWER_DEPENDENCY_VALUES = [
  'FACILITY_POWER_ONLY',
  'EXTERNAL_TOWER_REPEATER_POWER',
  'BATTERY_LT_4H',
  'BATTERY_4_TO_24H',
  'GENERATOR_BACKED',
  'UNKNOWN',
] as const;
export type CommPowerDependency = (typeof COMM_POWER_DEPENDENCY_VALUES)[number];

export const COMM_REGIONAL_SURVIVABILITY_VALUES = [
  'LIKELY_REMAIN_OPERATIONAL',
  'LIKELY_FAIL_REGIONAL',
  'DEPENDS_ON_SAME_UPSTREAM_AS_PRIMARY',
  'UNKNOWN',
] as const;
export type CommRegionalSurvivability = (typeof COMM_REGIONAL_SURVIVABILITY_VALUES)[number];

/** Display labels for regional survivability (cellular context: LIKELY_FAIL_REGIONAL = tower/backhaul/congestion) */
export const COMM_REGIONAL_SURVIVABILITY_LABELS: Record<CommRegionalSurvivability, string> = {
  LIKELY_REMAIN_OPERATIONAL: 'Likely to remain operational',
  LIKELY_FAIL_REGIONAL:
    'Likely to fail (tower power/backhaul or regional congestion)',
  DEPENDS_ON_SAME_UPSTREAM_AS_PRIMARY: 'Depends on same upstream as primary',
  UNKNOWN: 'Unknown',
};
export const COMM_REGIONAL_SURVIVABILITY_HELP =
  'Regional outcome only. Towers and backhaul are outside facility control; select UNKNOWN if not verifiable.';

/** Power scope for PACE layers that depend on carrier/tower (cellular, VoIP). Device power only = battery/charging at device; not tower/backhaul. */
export const COMM_POWER_SCOPE_VALUES = [
  'DEVICE_ONLY',
  'INFRASTRUCTURE_ASSESSED',
  'UNKNOWN',
] as const;
export type CommPowerScope = (typeof COMM_POWER_SCOPE_VALUES)[number];
export const COMM_POWER_SCOPE_LABELS: Record<CommPowerScope, string> = {
  DEVICE_ONLY: 'Device power only (battery/charging)',
  INFRASTRUCTURE_ASSESSED: 'Carrier/network power assessed',
  UNKNOWN: 'Unknown (treated as Device only)',
};

export const COMM_INTEROPERABILITY_VALUES = ['FULL', 'PARTIAL', 'NONE', 'UNKNOWN'] as const;
export type CommInteroperability = (typeof COMM_INTEROPERABILITY_VALUES)[number];

// Zod schemas for validation
export const CommVoiceFunctionSchema = z.enum(COMM_VOICE_FUNCTION_VALUES);
export const CommPaceSystemTypeSchema = z.enum(COMM_PACE_SYSTEM_TYPE_VALUES);
export const CommCarrierDependencySchema = z.enum(COMM_CARRIER_DEPENDENCY_VALUES);
export const CommCellularDiversitySchema = z.enum(COMM_CELLULAR_DIVERSITY_VALUES);
export const CommCellularPrioritySchema = z.enum(COMM_CELLULAR_PRIORITY_VALUES);
export const CommCellularCoverageSchema = z.enum(COMM_CELLULAR_COVERAGE_VALUES);
export const CommDevicePowerSchema = z.enum(COMM_DEVICE_POWER_VALUES);
export const CommRadioModeSchema = z.enum(COMM_RADIO_MODE_VALUES);
export const CommPaCoverageSchema = z.enum(COMM_PA_COVERAGE_VALUES);
export const CommRouteDiversitySchema = z.enum(COMM_ROUTE_DIVERSITY_VALUES);
export const CommPowerDependencySchema = z.enum(COMM_POWER_DEPENDENCY_VALUES);
export const CommRegionalSurvivabilitySchema = z.enum(COMM_REGIONAL_SURVIVABILITY_VALUES);
export const CommInteroperabilitySchema = z.enum(COMM_INTEROPERABILITY_VALUES);

export const YesNoUnknownSchema = z.enum(['yes', 'no', 'unknown']);
export type YesNoUnknown = z.infer<typeof YesNoUnknownSchema>;

// PACE layer object (same shape for P, A, C, E); only fields applicable to system_type are stored
const CommPaceLayerSchema = z.object({
  system_type: CommPaceSystemTypeSchema.optional(),
  // Landline
  carrier_dependency: CommCarrierDependencySchema.optional(),
  route_diversity: CommRouteDiversitySchema.optional(),
  power_dependency: CommPowerDependencySchema.optional(),
  provider_name: z.string().max(200).optional(),
  // Cellular
  cellular_diversity: CommCellularDiversitySchema.optional(),
  cellular_priority: CommCellularPrioritySchema.optional(),
  cellular_coverage: CommCellularCoverageSchema.optional(),
  device_power: CommDevicePowerSchema.optional(),
  // Radio
  radio_mode: CommRadioModeSchema.optional(),
  regional_survivability: CommRegionalSurvivabilitySchema.optional(),
  // Satellite uses provider_name, device_power, regional_survivability
  // Internal PA
  pa_coverage: CommPaCoverageSchema.optional(),
  // Manual runner only
  procedure_defined: YesNoUnknownSchema.optional(),
  // PACE curve: universal when system_type != NONE (sustain + effective capacity)
  sustain_hours: z.number().min(0).max(96).nullable().optional(),
  effective_capacity_pct: z.number().min(0).max(100).nullable().optional(),
  /** When does this layer become usable (hours from outage start)? Default 0. */
  activate_after_hours: z.number().min(0).max(72).optional(),
  // Carrier-dependent layers: device vs infrastructure power scope (backwards-compat: optional, default UNKNOWN)
  power_scope: z.enum(COMM_POWER_SCOPE_VALUES).optional(),
}).superRefine((data, ctx) => {
  const st = data.system_type;
  if (!st || st === 'NONE' || st === 'UNKNOWN') return;
  const needsSustain = data.sustain_hours == null || data.sustain_hours === undefined;
  const needsCapacity = data.effective_capacity_pct == null || data.effective_capacity_pct === undefined;
  if (needsSustain)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sustain_hours'], message: 'Sustainment hours (0–96) required when a PACE method is selected.' });
  if (needsCapacity)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['effective_capacity_pct'], message: 'Effective capacity % (0–100) required when a PACE method is selected.' });
});
export type CommPaceLayer = z.infer<typeof CommPaceLayerSchema>;

/** System types that show cellular-only fields (no tower/backhaul/route questions). */
export function isPaceLayerCellular(layer: CommPaceLayer | undefined): boolean {
  const st = layer?.system_type;
  return st === 'CELLULAR_VOICE' || st === 'PUSH_TO_TALK_CELLULAR';
}

export function isPaceLayerLandline(layer: CommPaceLayer | undefined): boolean {
  return layer?.system_type === 'LANDLINE_VOIP_TRUNK';
}

const RADIO_SYSTEM_TYPES = ['RADIO_ANALOG', 'RADIO_DIGITAL', 'PUBLIC_SAFETY_RADIO_NETWORK'] as const;
export function isPaceLayerRadio(layer: CommPaceLayer | undefined): boolean {
  return layer?.system_type != null && (RADIO_SYSTEM_TYPES as readonly string[]).includes(layer.system_type);
}

export function isPaceLayerSatellite(layer: CommPaceLayer | undefined): boolean {
  return layer?.system_type === 'SATELLITE_PHONE';
}

export function isPaceLayerInternalPA(layer: CommPaceLayer | undefined): boolean {
  return layer?.system_type === 'INTERNAL_PA';
}

export function isPaceLayerRunner(layer: CommPaceLayer | undefined): boolean {
  return layer?.system_type === 'MANUAL_RUNNER';
}

/** Landline/VoIP power options (onsite voice gear only; no tower). */
export const COMM_POWER_LANDLINE_VALUES = [
  'FACILITY_POWER_ONLY',
  'BATTERY_LT_4H',
  'BATTERY_4_TO_24H',
  'GENERATOR_BACKED',
  'UNKNOWN',
] as const;

const curveFields: (keyof CommPaceLayer)[] = ['sustain_hours', 'effective_capacity_pct', 'activate_after_hours'];
const powerScopeField = 'power_scope' as const;

/** Fields allowed per system type. Hidden fields must be absent or null when persisting. */
export function getApplicableFieldsForSystemType(
  systemType: CommPaceSystemType | undefined
): (keyof CommPaceLayer)[] {
  if (!systemType || systemType === 'NONE' || systemType === 'UNKNOWN')
    return ['system_type'];
  if (isPaceLayerCellular({ system_type: systemType }))
    return ['system_type', 'cellular_diversity', 'cellular_priority', 'cellular_coverage', 'device_power', 'provider_name', powerScopeField, ...curveFields];
  if (systemType === 'LANDLINE_VOIP_TRUNK')
    return ['system_type', 'provider_name', 'route_diversity', 'power_dependency', powerScopeField, ...curveFields];
  if (isPaceLayerRadio({ system_type: systemType }))
    return ['system_type', 'radio_mode', 'device_power', 'regional_survivability', ...curveFields];
  if (systemType === 'SATELLITE_PHONE')
    return ['system_type', 'provider_name', 'device_power', 'regional_survivability', ...curveFields];
  if (systemType === 'INTERNAL_PA')
    return ['system_type', 'power_dependency', 'pa_coverage', ...curveFields];
  if (systemType === 'MANUAL_RUNNER')
    return ['system_type', 'procedure_defined', ...curveFields];
  return ['system_type', ...curveFields];
}

/** Return a layer with only applicable fields for the given system type; clears hidden fields. */
export function clearLayerForSystemType(
  current: CommPaceLayer | undefined,
  nextType: CommPaceSystemType | undefined
): CommPaceLayer {
  if (!nextType) {
    return { provider_name: current?.provider_name };
  }

  const allowed = new Set(getApplicableFieldsForSystemType(nextType));
  const preserved: Partial<CommPaceLayer> = {
    system_type: nextType, // CRITICAL: MUST ALWAYS BE SET
  };
  // Preserve applicable fields from current (needed when normalizing on load; chart needs sustain_hours, effective_capacity_pct)
  for (const key of allowed) {
    if (key === 'system_type') continue;
    const v = (current as Record<string, unknown>)?.[key];
    if (v !== undefined && v !== null) (preserved as Record<string, unknown>)[key] = v;
  }

  switch (nextType) {
    case 'LANDLINE_VOIP_TRUNK':
      return {
        ...preserved,
        route_diversity: preserved.route_diversity ?? current?.route_diversity ?? 'UNKNOWN',
      } as CommPaceLayer;

    default:
      return preserved as CommPaceLayer;
  }
}

// ─── Curve (72-hour model; same IDs as other tabs) ─────────────────────────
export const CommsCurveSchema = z.object({
  curve_requires_service: z.boolean().optional(),
  curve_primary_provider: z.string().optional(),
  curve_time_to_impact_hours: z.number().min(0).max(72).nullable().optional(),
  curve_loss_fraction_no_backup: z.number().min(0).max(1).nullable().optional(),
  curve_backup_available: YesNoUnknownSchema.optional(),
  curve_backup_duration_hours: z.number().min(0).max(96).nullable().optional(),
  curve_loss_fraction_with_backup: z.number().min(0).max(1).nullable().optional(),
  curve_recovery_time_hours: z.number().min(0).max(168).nullable().optional(),
});
export type CommsCurveInput = z.infer<typeof CommsCurveSchema>;

// ─── Full answers schema ──────────────────────────────────────────────────
export const CommsAnswersSchema = z
  .object({
    // SECTION 1 — Voice functions
    comm_voice_functions: z.array(CommVoiceFunctionSchema).default([]),
    comm_voice_functions_other_detail: z.string().max(500).optional(),

    // SECTION 2 — Curve
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

    // SECTION 3 — PACE (P, A, C, E)
    comm_pace_P: CommPaceLayerSchema.optional(),
    comm_pace_A: CommPaceLayerSchema.optional(),
    comm_pace_C: CommPaceLayerSchema.optional(),
    comm_pace_E: CommPaceLayerSchema.optional(),

    // SECTION 4 — Structural risk
    comm_single_point_voice_failure: YesNoUnknownSchema.optional(),
    comm_interoperability: CommInteroperabilitySchema.optional(),
    comm_restoration_coordination: YesNoUnknownSchema.optional(),
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
    if (data.curve_backup_available !== 'yes') {
      if (data.curve_backup_duration_hours != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Backup duration should be blank when backup is not available.',
          path: ['curve_backup_duration_hours'],
        });
      }
      if (data.curve_loss_fraction_with_backup != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Loss with backup should be blank when backup is not available.',
          path: ['curve_loss_fraction_with_backup'],
        });
      }
    }
    for (const layerKey of ['comm_pace_P', 'comm_pace_A', 'comm_pace_C', 'comm_pace_E'] as const) {
      const layer = data[layerKey];
      if (!layer || typeof layer !== 'object') continue;
      const st = (layer as CommPaceLayer).system_type;
      if (st === 'MANUAL_RUNNER') {
        const forbidden = ['carrier_dependency', 'power_dependency', 'provider_name', 'route_diversity', 'regional_survivability', 'device_power', 'cellular_diversity', 'cellular_priority', 'cellular_coverage', 'radio_mode', 'pa_coverage'];
        for (const f of forbidden) {
          if ((layer as Record<string, unknown>)[f] != null) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Manual runner must not have power/carrier/provider/route fields.', path: [layerKey, f] });
          }
        }
      }
      if (isPaceLayerCellular(layer as CommPaceLayer)) {
        const rd = (layer as CommPaceLayer).route_diversity;
        if (rd != null && rd !== 'UNKNOWN') {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cellular layer must not have route_diversity other than UNKNOWN (tower/backhaul outside facility control).', path: [layerKey, 'route_diversity'] });
        }
      }
    }
  });

export type CommsAnswers = z.infer<typeof CommsAnswersSchema>;

// ─── Question definitions for UI ──────────────────────────────────────────
export type CommsQuestionDef = {
  id: string;
  section: 'voice' | 'curve' | 'pace' | 'coordination';
  prompt: string;
  helpText: string;
  answerType: 'boolean' | 'number' | 'percent' | 'enum' | 'multienum' | 'text';
  options?: readonly string[];
  showWhen?: (answers: CommsAnswers) => boolean;
  feedsChart?: boolean;
  /** Optional: required asset types when answer is yes (for parity config). */
  yesRequires?: string[];
};

const PACE_LAYERS = ['P', 'A', 'C', 'E'] as const;
const PACE_LAYER_LABELS: Record<string, string> = {
  P: 'Primary',
  A: 'Alternate',
  C: 'Contingency',
  E: 'Emergency',
};

export const COMMUNICATIONS_QUESTIONS: CommsQuestionDef[] = [
  // SECTION 1
  {
    id: 'COMM-0',
    section: 'voice',
    prompt: 'Which voice/command functions does the facility rely on? (Select all that apply)',
    helpText:
      'Voice and command & control only. Do not include internet/data-dependent systems—those belong in the IT tab.',
    answerType: 'multienum',
    options: COMM_VOICE_FUNCTION_VALUES,
  },
  // SECTION 2 — Curve
  {
    id: 'curve_requires_service',
    section: 'curve',
    prompt:
      'Does the facility rely on voice communications to coordinate operations, security, or emergency response?',
    helpText:
      'Voice/radio/cellular/satellite voice only—not internet or data circuits. Select YES if voice is required for coordination; if NO, the impact curve shows no operational impact.',
    answerType: 'boolean',
    feedsChart: true,
  },
  {
    id: 'curve_primary_provider',
    section: 'curve',
    prompt: 'Who provides primary voice/telephony service?',
    helpText: 'Required when the facility relies on voice communications. Enter the name of the primary voice/telephony provider.',
    answerType: 'text',
    showWhen: (a) => a.curve_requires_service === true,
  },
  {
    id: 'curve_time_to_impact_hours',
    section: 'curve',
    prompt: 'If voice communications are lost (without backup), how soon would the facility be severely impacted? (hours, 0–72)',
    helpText: 'Hours until operations are severely affected with no voice backup.',
    answerType: 'number',
    showWhen: (a) => a.curve_requires_service !== false,
    feedsChart: true,
  },
  {
    id: 'curve_loss_fraction_no_backup',
    section: 'curve',
    prompt: 'Once voice communications are lost (without backup), what percentage of normal business functions are lost or degraded? (0–100%)',
    helpText: 'Percent of operations lost without any voice backup.',
    answerType: 'percent',
    showWhen: (a) => a.curve_requires_service !== false,
    feedsChart: true,
  },
  {
    id: 'curve_backup_available',
    section: 'curve',
    prompt: 'Is any backup or alternate voice communications capability available?',
    helpText: 'Voice backup only (e.g., alternate carrier, radio, satellite voice). Not internet/data backup.',
    answerType: 'boolean',
    showWhen: (a) => a.curve_requires_service !== false,
    feedsChart: true,
  },
  {
    id: 'curve_backup_duration_hours',
    section: 'curve',
    prompt: 'How many hours can alternate voice capability sustain operations? (0–96)',
    helpText: 'Duration of backup voice capability.',
    answerType: 'number',
    showWhen: (a) => a.curve_backup_available === 'yes',
    feedsChart: true,
  },
  {
    id: 'curve_loss_fraction_with_backup',
    section: 'curve',
    prompt: 'Once voice is lost (considering backup), what percentage of functions are still lost or degraded? (0–100%)',
    helpText: 'Percent still lost even with backup voice in use.',
    answerType: 'percent',
    showWhen: (a) => a.curve_backup_available === 'yes',
    feedsChart: true,
  },
  {
    id: 'curve_recovery_time_hours',
    section: 'curve',
    prompt: 'Once external voice service is restored, how long until full resumption of operations? (hours, 0–168)',
    helpText: 'Time to restore normal voice-dependent operations after outage ends.',
    answerType: 'number',
    showWhen: (a) => a.curve_requires_service !== false,
    feedsChart: true,
  },
  // SECTION 4 — Coordination (COMM-SP*)
  {
    id: 'COMM-SP1',
    section: 'coordination',
    prompt: 'Is there a single point of voice failure? (All practical voice options depend on one carrier, one route, one repeater/tower, or one power source.)',
    helpText:
      'Answer Yes if all practical voice options depend on one carrier, one route, one repeater/tower, or one power source.',
    answerType: 'enum',
    options: ['yes', 'no', 'unknown'],
  },
  {
    id: 'COMM-SP2',
    section: 'coordination',
    prompt: 'Interoperability with other agencies/systems for voice?',
    helpText: 'Ability to communicate by voice with other agencies or systems during an incident.',
    answerType: 'enum',
    options: COMM_INTEROPERABILITY_VALUES,
  },
  {
    id: 'COMM-SP3',
    section: 'coordination',
    prompt: 'Is there documented coordination with voice providers/network operators for restoration and priority during outages?',
    helpText: 'SLA, priority restoration, or mutual aid for voice services.',
    answerType: 'enum',
    options: ['yes', 'no', 'unknown'],
  },
];

/** Curve questions only (for parity config). */
export const COMMS_CURVE_QUESTIONS: CommsQuestionDef[] = COMMUNICATIONS_QUESTIONS.filter((q) => q.section === 'curve');
/** Non-curve questions (voice + coordination; for parity config). */
export const COMMS_QUESTIONS: CommsQuestionDef[] = COMMUNICATIONS_QUESTIONS.filter((q) => q.section !== 'curve');

/** Question ID -> vulnerability trigger (for verify_dependency_scope / verify_question_integrity). */
export const COMMS_VULNERABILITY_TRIGGERS: Record<
  string,
  { no?: string; yes?: string; entry?: { field: string; value: unknown; vulnerability_id: string }[] }
> = {
  curve_backup_available: { no: 'COMMS_ALTERNATE_CAPABILITY' },
  'COMM-SP1': { yes: 'COMMS_DIVERSITY' },
  'COMM-SP3': { no: 'COMMS_RESTORATION_REALISM' },
};

// PACE field defs (same for each layer)
export function getPaceQuestionDefs(layer: 'P' | 'A' | 'C' | 'E'): CommsQuestionDef[] {
  const label = PACE_LAYER_LABELS[layer];
  const prefix = `comm_pace_${layer}_`;
  const showWhenSystemNotNone = (a: CommsAnswers) => {
    const pace = a[`comm_pace_${layer}` as keyof CommsAnswers] as CommPaceLayer | undefined;
    const sys = pace?.system_type;
    return sys !== 'NONE' && sys !== undefined;
  };
  const showCarrierWhen = (a: CommsAnswers): boolean => {
    const pace = a[`comm_pace_${layer}` as keyof CommsAnswers] as CommPaceLayer | undefined;
    const sys = pace?.system_type;
    return Boolean(showWhenSystemNotNone(a) && sys && !isPaceLayerCellular(pace) && !isPaceLayerLandline(pace) && !['INTERNAL_PA', 'MANUAL_RUNNER', 'NONE', 'UNKNOWN'].includes(sys));
  };
  const showCellularWhen = (a: CommsAnswers): boolean => Boolean(showWhenSystemNotNone(a) && isPaceLayerCellular(a[`comm_pace_${layer}` as keyof CommsAnswers] as CommPaceLayer | undefined));
  const showProviderWhen = (a: CommsAnswers) => {
    const pace = a[`comm_pace_${layer}` as keyof CommsAnswers] as CommPaceLayer | undefined;
    if (!pace || !showWhenSystemNotNone(a)) return false;
    if (isPaceLayerCellular(pace)) return true;
    if (isPaceLayerLandline(pace) || isPaceLayerSatellite(pace)) return true;
    return false;
  };
  const showRouteWhen = (a: CommsAnswers): boolean => {
    const pace = a[`comm_pace_${layer}` as keyof CommsAnswers] as CommPaceLayer | undefined;
    return Boolean(showWhenSystemNotNone(a) && pace != null && !isPaceLayerCellular(pace) && isPaceLayerLandline(pace));
  };
  const showPowerDependencyWhen = (a: CommsAnswers): boolean => {
    const pace = a[`comm_pace_${layer}` as keyof CommsAnswers] as CommPaceLayer | undefined;
    return Boolean(pace != null && (isPaceLayerLandline(pace) || isPaceLayerInternalPA(pace)));
  };
  const showDevicePowerWhen = (a: CommsAnswers): boolean => {
    const pace = a[`comm_pace_${layer}` as keyof CommsAnswers] as CommPaceLayer | undefined;
    return Boolean(pace != null && (isPaceLayerCellular(pace) || isPaceLayerRadio(pace) || isPaceLayerSatellite(pace)));
  };
  const showRegionalWhen = (a: CommsAnswers): boolean => {
    const pace = a[`comm_pace_${layer}` as keyof CommsAnswers] as CommPaceLayer | undefined;
    return Boolean(pace != null && showWhenSystemNotNone(a) && (isPaceLayerRadio(pace) || isPaceLayerSatellite(pace)));
  };
  const showRadioModeWhen = (a: CommsAnswers): boolean => {
    const pace = a[`comm_pace_${layer}` as keyof CommsAnswers] as CommPaceLayer | undefined;
    return Boolean(pace != null && isPaceLayerRadio(pace));
  };
  const showProcedureDefinedWhen = (a: CommsAnswers): boolean => {
    const pace = a[`comm_pace_${layer}` as keyof CommsAnswers] as CommPaceLayer | undefined;
    return Boolean(pace != null && isPaceLayerRunner(pace));
  };
  const showPaCoverageWhen = (a: CommsAnswers): boolean => {
    const pace = a[`comm_pace_${layer}` as keyof CommsAnswers] as CommPaceLayer | undefined;
    return Boolean(pace != null && isPaceLayerInternalPA(pace));
  };
  return [
    {
      id: `${prefix}system_type`,
      section: 'pace',
      prompt: `${label} — System type`,
      helpText: 'Voice carrier/system type only. Carrier/network operator only. Do not list SaaS/cloud/VPN/internet items here.',
      answerType: 'enum',
      options: COMM_PACE_SYSTEM_TYPE_VALUES,
    },
    {
      id: `${prefix}carrier_dependency`,
      section: 'pace',
      prompt: `${label} — Carrier dependency`,
      helpText: 'Who provides this voice capability? (Not shown for cellular—use cellular diversity below.)',
      answerType: 'enum',
      options: COMM_CARRIER_DEPENDENCY_VALUES,
      showWhen: showCarrierWhen,
    },
    {
      id: `${prefix}cellular_diversity`,
      section: 'pace',
      prompt: `${label} — Cellular diversity`,
      helpText: 'Single carrier vs multiple carriers for cellular voice.',
      answerType: 'enum',
      options: COMM_CELLULAR_DIVERSITY_VALUES,
      showWhen: showCellularWhen,
    },
    {
      id: `${prefix}cellular_priority`,
      section: 'pace',
      prompt: `${label} — Cellular priority`,
      helpText: 'Wireless Priority Service (WPS/GETS) or FirstNet if applicable.',
      answerType: 'enum',
      options: COMM_CELLULAR_PRIORITY_VALUES,
      showWhen: showCellularWhen,
    },
    {
      id: `${prefix}cellular_coverage`,
      section: 'pace',
      prompt: `${label} — Cellular coverage`,
      helpText: 'Indoor coverage and need for DAS/boosters.',
      answerType: 'enum',
      options: COMM_CELLULAR_COVERAGE_VALUES,
      showWhen: showCellularWhen,
    },
    {
      id: `${prefix}device_power`,
      section: 'pace',
      prompt: `${label} — Device power`,
      helpText: 'Battery/charging at the device. Not tower or backhaul power.',
      answerType: 'enum',
      options: COMM_DEVICE_POWER_VALUES,
      showWhen: showDevicePowerWhen,
    },
    {
      id: `${prefix}radio_mode`,
      section: 'pace',
      prompt: `${label} — Radio mode`,
      helpText: 'Simplex, repeater, or trunked network.',
      answerType: 'enum',
      options: COMM_RADIO_MODE_VALUES,
      showWhen: showRadioModeWhen,
    },
    {
      id: `${prefix}route_diversity`,
      section: 'pace',
      prompt: `${label} — Route diversity`,
      helpText: 'Physical path diversity (landline/VoIP only). Not shown for cellular—towers/backhaul are outside facility control.',
      answerType: 'enum',
      options: COMM_ROUTE_DIVERSITY_VALUES,
      showWhen: showRouteWhen,
    },
    {
      id: `${prefix}power_dependency`,
      section: 'pace',
      prompt: `${label} — Power dependency`,
      helpText: 'Onsite voice gear power (landline/PA). Not tower or repeater power.',
      answerType: 'enum',
      options: COMM_POWER_LANDLINE_VALUES,
      showWhen: showPowerDependencyWhen,
    },
    {
      id: `${prefix}regional_survivability`,
      section: 'pace',
      prompt: `${label} — Regional survivability`,
      helpText: COMM_REGIONAL_SURVIVABILITY_HELP,
      answerType: 'enum',
      options: COMM_REGIONAL_SURVIVABILITY_VALUES,
      showWhen: showRegionalWhen,
    },
    {
      id: `${prefix}pa_coverage`,
      section: 'pace',
      prompt: `${label} — PA coverage (optional)`,
      helpText: 'Building-wide or partial.',
      answerType: 'enum',
      options: COMM_PA_COVERAGE_VALUES,
      showWhen: showPaCoverageWhen,
    },
    {
      id: `${prefix}procedure_defined`,
      section: 'pace',
      prompt: `${label} — Procedure defined`,
      helpText: 'Whether runner/physical relay procedure is documented.',
      answerType: 'enum',
      options: ['yes', 'no', 'unknown'],
      showWhen: showProcedureDefinedWhen,
    },
    {
      id: `${prefix}provider_name`,
      section: 'pace',
      prompt: `${label} — Carrier (if known)`,
      helpText: 'Carrier/network operator only. Do not list SaaS/cloud/VPN/internet items here.',
      answerType: 'text',
      showWhen: showProviderWhen,
    },
  ];
}

export const COMMUNICATIONS_ENUMS = {
  comm_voice_function: COMM_VOICE_FUNCTION_VALUES,
  comm_pace_system_type: COMM_PACE_SYSTEM_TYPE_VALUES,
  comm_carrier_dependency: COMM_CARRIER_DEPENDENCY_VALUES,
  comm_cellular_diversity: COMM_CELLULAR_DIVERSITY_VALUES,
  comm_cellular_priority: COMM_CELLULAR_PRIORITY_VALUES,
  comm_cellular_coverage: COMM_CELLULAR_COVERAGE_VALUES,
  comm_device_power: COMM_DEVICE_POWER_VALUES,
  comm_radio_mode: COMM_RADIO_MODE_VALUES,
  comm_route_diversity: COMM_ROUTE_DIVERSITY_VALUES,
  comm_power_dependency: COMM_POWER_DEPENDENCY_VALUES,
  comm_power_landline: COMM_POWER_LANDLINE_VALUES,
  comm_regional_survivability: COMM_REGIONAL_SURVIVABILITY_VALUES,
  comm_pa_coverage: COMM_PA_COVERAGE_VALUES,
  comm_interoperability: COMM_INTEROPERABILITY_VALUES,
} as const;

/** Scope guard: in-scope / out-of-scope for sticky banner and modal. */
export const COMMS_SCOPE_GUARD = {
  title: 'COMMUNICATIONS = VOICE / COMMAND & CONTROL',
  in_scope: 'Calls, cellular voice, radios, dispatch voice, satellite phones, PTT',
  out_of_scope: 'Internet/data, SaaS/cloud apps, VPN, Wi-Fi, Teams/Zoom, email',
  rule: 'If it\'s data/internet transport, stop and go to IT.',
} as const;

/** Comms vs IT: 3 examples each for modal/callout. */
export const COMMS_VS_IT_EXAMPLES = {
  communications: [
    'Landline or cellular voice calls',
    'Two-way radio or dispatch voice',
    'Satellite phone or PTT (push-to-talk) voice',
  ],
  it: [
    'ISP circuit or broadband data',
    'SaaS app (e.g. Teams, Zoom) or cloud access',
    'VPN, Wi-Fi data, or MPLS/SD-WAN',
  ],
  boundary: 'If it\'s data/internet transport, stop and go to IT.',
} as const;

/** Forbidden terms in free-text: trigger non-blocking "sounds like IT" warning. */
export const COMMS_FORBIDDEN_TERMS = [
  'vpn', 'saas', 'cloud', 'internet', 'fiber', 'mpls', 'sd-wan', 'wifi', 'wi-fi', 'teams', 'zoom', 'email',
] as const;

// ─── Legacy compatibility (for mapping only; do not surface old questions) ───
/** @deprecated Use COMM_VOICE_FUNCTION_VALUES and new question set. */
export const COMMS_QUESTION_IDS = [] as const;
/** @deprecated Use CommsAnswers. */
export type CommsQuestionId = never;

/** Default comms answers. */
export function getDefaultCommsAnswers(): CommsAnswers {
  return {
    comm_voice_functions: [],
    comm_voice_functions_other_detail: undefined,
    curve_requires_service: undefined,
    curve_primary_provider: undefined,
    curve_time_to_impact_hours: undefined,
    curve_loss_fraction_no_backup: undefined,
    curve_backup_available: undefined,
    curve_backup_duration_hours: undefined,
    curve_loss_fraction_with_backup: undefined,
    curve_recovery_time_hours: undefined,
    redundancy_activation: undefined,
    comm_pace_P: undefined,
    comm_pace_A: undefined,
    comm_pace_C: undefined,
    comm_pace_E: undefined,
    comm_single_point_voice_failure: undefined,
    comm_interoperability: undefined,
    comm_restoration_coordination: undefined,
  };
}

/** Derive whether PACE answers suggest single point of failure (for warning banner). */
export function deriveCommsSinglePointFromPace(answers: CommsAnswers): boolean | null {
  const layers = [answers.comm_pace_P, answers.comm_pace_A, answers.comm_pace_C, answers.comm_pace_E].filter(
    (l): l is CommPaceLayer => l != null && typeof l === 'object'
  );
  if (layers.length === 0) return null;
  const singleFromCarrier = (l: CommPaceLayer) => {
    if (isPaceLayerCellular(l))
      return l.cellular_diversity === 'SINGLE_CARRIER' || l.cellular_diversity === 'UNKNOWN' || !l.cellular_diversity;
    return l.carrier_dependency === 'SINGLE_COMMERCIAL' || l.carrier_dependency === 'UNKNOWN' || !l.carrier_dependency;
  };
  const allSingleCarrier = layers.every(singleFromCarrier);
  const allSharedRoute = layers.every(
    (l) =>
      l.route_diversity === 'SHARED_CORRIDOR' ||
      l.route_diversity === 'SHARED_ENTRY_POINT' ||
      l.route_diversity === 'UNKNOWN'
  );
  if (layers.length === 1 && layers[0].system_type !== 'NONE') return true;
  if (allSingleCarrier && layers.length <= 2) return true;
  if (allSharedRoute && layers.every((l) => l.regional_survivability === 'DEPENDS_ON_SAME_UPSTREAM_AS_PRIMARY'))
    return true;
  return false;
}

/** Format PACE layer for report summary (type-aware). */
export function formatPaceLayerForSummary(layer: CommPaceLayer | undefined): string {
  if (!layer?.system_type) return '—';
  const st = layer.system_type.replace(/_/g, ' ').toLowerCase();
  const parts: string[] = [st];

  if (isPaceLayerRunner(layer)) {
    if (layer.procedure_defined) parts.push(`procedure defined: ${layer.procedure_defined}`);
    return parts.join(' ');
  }

  if (isPaceLayerCellular(layer)) {
    if (layer.cellular_diversity) parts.push(COMM_CELLULAR_DIVERSITY_LABELS[layer.cellular_diversity]);
    if (layer.cellular_priority && layer.cellular_priority !== 'NONE')
      parts.push(COMM_CELLULAR_PRIORITY_LABELS[layer.cellular_priority]);
    if (layer.cellular_coverage && layer.cellular_coverage !== 'UNKNOWN')
      parts.push(COMM_CELLULAR_COVERAGE_LABELS[layer.cellular_coverage]);
    if (layer.device_power && layer.device_power !== 'UNKNOWN')
      parts.push(COMM_DEVICE_POWER_LABELS[layer.device_power]);
    return parts.join(', ');
  }

  if (isPaceLayerLandline(layer)) {
    if (layer.provider_name) parts.push(layer.provider_name);
    if (layer.route_diversity && layer.route_diversity !== 'UNKNOWN')
      parts.push(layer.route_diversity.replace(/_/g, ' ').toLowerCase());
    if (layer.power_dependency && layer.power_dependency !== 'UNKNOWN')
      parts.push(layer.power_dependency.replace(/_/g, ' ').toLowerCase());
    return parts.join(', ');
  }

  if (isPaceLayerRadio(layer)) {
    if (layer.radio_mode && layer.radio_mode !== 'UNKNOWN')
      parts.push(COMM_RADIO_MODE_LABELS[layer.radio_mode]);
    if (layer.device_power && layer.device_power !== 'UNKNOWN')
      parts.push(COMM_DEVICE_POWER_LABELS[layer.device_power]);
    if (layer.regional_survivability && layer.regional_survivability !== 'UNKNOWN')
      parts.push(COMM_REGIONAL_SURVIVABILITY_LABELS[layer.regional_survivability]);
    return parts.join(', ');
  }

  if (isPaceLayerSatellite(layer)) {
    if (layer.provider_name) parts.push(layer.provider_name);
    if (layer.device_power && layer.device_power !== 'UNKNOWN')
      parts.push(COMM_DEVICE_POWER_LABELS[layer.device_power]);
    if (layer.regional_survivability && layer.regional_survivability !== 'UNKNOWN')
      parts.push(COMM_REGIONAL_SURVIVABILITY_LABELS[layer.regional_survivability]);
    return parts.join(', ');
  }

  if (isPaceLayerInternalPA(layer)) {
    if (layer.power_dependency && layer.power_dependency !== 'UNKNOWN')
      parts.push(layer.power_dependency.replace(/_/g, ' ').toLowerCase());
    if (layer.pa_coverage && layer.pa_coverage !== 'UNKNOWN')
      parts.push(layer.pa_coverage.replace(/_/g, ' ').toLowerCase());
    return parts.join(', ');
  }

  return st;
}
