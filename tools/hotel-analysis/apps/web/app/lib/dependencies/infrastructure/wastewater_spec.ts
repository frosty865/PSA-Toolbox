/**
 * Canonical WASTEWATER dependency spec (doctrine-aligned).
 * Questions WW_Q1 through WW_Q14 with progressive disclosure:
 * - WW_Q9-WW_Q12 gated by WW_Q8=YES (onsite wastewater equipment)
 */
import { z } from 'zod';

export const WASTEWATER_QUESTION_IDS = [
  'WW_Q1',
  'WW_Q2',
  'WW_Q3',
  'WW_Q4',
  'WW_Q6',
  'WW_Q7',
  'WW_Q8',
  'WW_Q9',
  'WW_Q10',
  'WW_Q11',
  'WW_Q12',
  'WW_Q13',
  'WW_Q14',
] as const;
export type WastewaterQuestionId = (typeof WASTEWATER_QUESTION_IDS)[number];

export const YesNoUnknownSchema = z.enum(['yes', 'no', 'unknown']);
export type YesNoUnknown = z.infer<typeof YesNoUnknownSchema>;

// ─── Curve (chart) fields ──────────────────────────────────────────────────
export const WastewaterCurveSchema = z.object({
  curve_requires_service: z.boolean().optional(),
  curve_primary_provider: z.string().optional(),
  curve_time_to_impact_hours: z.number().min(0).max(72).nullable().optional(),
  curve_loss_fraction_no_backup: z.number().min(0).max(1).nullable().optional(),
  curve_backup_available: YesNoUnknownSchema.optional(),
  curve_backup_duration_hours: z.number().min(0).max(96).nullable().optional(),
  curve_loss_fraction_with_backup: z.number().min(0).max(1).nullable().optional(),
  curve_recovery_time_hours: z.number().min(0).max(168).nullable().optional(),
});
export type WastewaterCurveInput = z.infer<typeof WastewaterCurveSchema>;

// ─── Answers schema ────────────────────────────────────────────────────────
export const WastewaterAnswersSchema = z.object({
  // Curve
  curve_requires_service: z.boolean().optional(),
  curve_primary_provider: z.string().optional(),
  curve_time_to_impact_hours: z.number().min(0).max(72).nullable().optional(),
  curve_loss_fraction_no_backup: z.number().min(0).max(1).nullable().optional(),
  curve_backup_available: YesNoUnknownSchema.optional(),
  curve_backup_duration_hours: z.number().min(0).max(96).nullable().optional(),
  curve_loss_fraction_with_backup: z.number().min(0).max(1).nullable().optional(),
  curve_recovery_time_hours: z.number().min(0).max(168).nullable().optional(),
  /** Redundancy initiation (only when alternate capability exists). */
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
  WW_Q1_discharge_to_sewer: YesNoUnknownSchema.optional(),
  WW_Q2_connection_count: z.number().int().min(0).max(5).nullable().optional(),
  WW_Q3_same_geographic_location: YesNoUnknownSchema.optional(),
  WW_Q4_collocated_corridor: YesNoUnknownSchema.optional(),
  WW_Q6_priority_restoration: YesNoUnknownSchema.optional(),
  WW_Q7_contingency_plan: YesNoUnknownSchema.optional(),
  WW_Q8_onsite_pumping: YesNoUnknownSchema.optional(),
  WW_Q9_backup_power_pumps: YesNoUnknownSchema.optional(),
  WW_Q10_manual_override: YesNoUnknownSchema.optional(),
  WW_Q11_pump_alarming: YesNoUnknownSchema.optional(),
  WW_Q12_dual_source_parts: YesNoUnknownSchema.optional(),
  WW_Q13_holding_capacity: YesNoUnknownSchema.optional(),
  WW_Q14_constraints_evaluated: YesNoUnknownSchema.optional(),
}).superRefine((data, ctx) => {
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
});

export type WastewaterAnswers = z.infer<typeof WastewaterAnswersSchema>;

/** Question ID -> vulnerability trigger (for verify_question_integrity). */
export const WASTEWATER_VULNERABILITY_TRIGGERS: Record<
  string,
  { no?: string; yes?: string; entry?: Array<{ field: string; value: unknown; vulnerability_id: string }> }
> = {
  WW_Q6: { no: 'WW_NO_PRIORITY_RESTORATION' },
};

export type WastewaterQuestionDef = {
  id: string;
  prompt: string;
  helpText?: string;
  answerType: 'boolean' | 'enum' | 'integer' | 'number' | 'string';
  feedsChart?: boolean;
  yesRequires?: string[];
  scope?: 'BASELINE' | 'PRA_SLA';
  /** Optional: Contextual help text for detailed explanation (e.g., when to use N/A). */
  help_text?: string;
};

/** Curve (chart) questions — answers drive the impact curve. Shown first. */
export const WASTEWATER_CURVE_QUESTIONS: WastewaterQuestionDef[] = [
  {
    id: 'curve_requires_service',
    prompt: 'Does the facility rely on wastewater for core operations?',
    helpText: 'Select YES if this infrastructure is required for normal operations. If NO, the impact curve will show no operational impact for this infrastructure.',
    answerType: 'boolean',
    feedsChart: true,
    help_text: 'Select YES if normal facility operations depend on wastewater service. This initiates the impact assessment; if NO, no operational loss is assumed.',
  },
  {
    id: 'curve_primary_provider',
    prompt: 'Who provides wastewater/sewer service to the facility/site?',
    helpText: 'Required when the facility relies on wastewater. Enter the name of the provider or utility that supplies wastewater/sewer service.',
    answerType: 'string',
    feedsChart: false,
  },
  {
    id: 'curve_time_to_impact',
    prompt: 'If wastewater service is lost (without alternate capability), how soon would the facility be severely impacted? (hours)',
    helpText: 'Estimate how many hours until operations are severely affected if this service is lost and no mitigation is available.',
    answerType: 'number',
    feedsChart: true,
    help_text: 'Estimate in hours how quickly critical operations degrade if wastewater service is lost with no alternate capability available. Use realistic estimates based on on-site holding capacity or operational flexibility.',
  },
  {
    id: 'curve_loss_no_backup',
    prompt: 'Once wastewater service is lost (without alternate capability), what percentage of normal business functions are lost or degraded?',
    helpText: 'Estimate the percent of normal operations that would be lost or degraded without mitigation. Enter 0–100.',
    answerType: 'number',
    feedsChart: true,
    help_text: 'Enter the percentage (0–100) of facility functions that would be offline if wastewater service is lost without any backup. 100% means complete shutdown; 0% means no loss.',
  },
  {
    id: 'curve_backup_available',
    prompt: 'Is any backup or alternate wastewater capability available for this infrastructure?',
    helpText: 'Select YES if there is any alternate or holding capability that could sustain operations. This gates the backup-specific curve questions.',
    answerType: 'boolean',
    feedsChart: true,
    help_text: 'Select YES if backup or alternate wastewater capability exists (on-site holding, alternate discharge point, on-site treatment, or manual management). Select NO if no backup exists. This answer determines whether subsequent backup-related questions are asked.',
  },
  {
    id: 'curve_backup_duration',
    prompt: 'How many hours can alternate wastewater capability sustain operations without resupply?',
    helpText: 'Estimate how long mitigation can sustain operations before impacts increase (hours).',
    answerType: 'number',
    feedsChart: true,
    help_text: 'Estimate the duration (in hours, 0–96) that alternate wastewater capability can sustain critical operations. This includes on-site holding tank capacity or treatment system runtime.',
  },
  {
    id: 'curve_loss_with_backup',
    prompt: 'Once wastewater service is lost (considering alternate capability), what percentage of normal business functions are lost or degraded?',
    helpText: 'With mitigation in place, estimate the percent of normal operations still lost or degraded. Enter 0–100.',
    answerType: 'number',
    feedsChart: true,
    help_text: 'Enter the percentage (0–100) of facility functions that would still be offline or degraded even with backup wastewater capability active. This captures functions requiring the primary service explicitly.',
  },
  {
    id: 'curve_recovery_time',
    prompt: 'Once external wastewater service is restored, how long until full resumption of operations? (hours)',
    helpText: 'After service is restored, estimate how long it takes to return to normal operations.',
    answerType: 'number',
    feedsChart: true,
    help_text: 'Estimate time (in hours, 0–168) to restore normal facility operations after wastewater service is restored.',
  },
];

/** Question defs for parity config (doctrine-aligned; WW_Q1–WW_Q14). */
export const WASTEWATER_QUESTIONS: WastewaterQuestionDef[] = [
  {
    id: 'WW_Q1',
    prompt: 'Does the facility discharge wastewater to a municipal/public sewer system?',
    helpText: 'Answer YES when flow is sent to a municipal or regional utility. Answer NO when the site relies entirely on onsite treatment, septic, or holding.',
    answerType: 'enum',
  },
  {
    id: 'WW_Q2',
    prompt: 'How many wastewater discharge/service connections serve the facility?',
    helpText: 'Enter the number of active discharge points to the public system (0–5). Include each distinct connection or lift station tie-in.',
    answerType: 'integer',
  },
  {
    id: 'WW_Q3',
    prompt: 'Do all wastewater service connections enter/leave the site at the same geographic location?',
    helpText: 'Answer YES when all discharge lines share the same route or entry point. Answer NO when routes are geographically separated.',
    answerType: 'enum',
  },
  {
    id: 'WW_Q4',
    prompt: 'Are wastewater lines/manholes/cleanouts collocated in a shared utility corridor?',
    helpText: 'Shared corridors expose multiple utilities to the same damage. Select YES when wastewater infrastructure shares a trench, duct bank, or vault with other utilities.',
    answerType: 'enum',
  },
  {
    id: 'WW_Q6',
    prompt: 'Does the facility participate in a priority restoration plan with the wastewater provider?',
    helpText: 'YES when the provider has confirmed prioritization criteria or agreements for restoring wastewater service to the site.',
    answerType: 'enum',
    scope: 'PRA_SLA',
  },
  {
    id: 'WW_Q7',
    prompt: 'Does the facility have a documented contingency/coordination plan with the wastewater provider?',
    helpText: 'Answer YES when responsibilities, contacts, and communication steps with the provider are documented and current.',
    answerType: 'enum',
    scope: 'PRA_SLA',
  },
  {
    id: 'WW_Q8',
    prompt: 'Does the facility rely on onsite wastewater pumping?',
    helpText: 'Select YES when lift stations or ejector pumps are needed to move wastewater offsite; NO when flow is purely gravity fed.',
    answerType: 'enum',
  },
  {
    id: 'WW_Q9',
    prompt: 'Is backup power available to support onsite wastewater pumps?',
    helpText: 'Answer YES when pumps have generator, UPS, or portable power connections sized to run required loads.',
    answerType: 'enum',
  },
  {
    id: 'WW_Q10',
    prompt: 'Can onsite wastewater pumps be operated or overridden manually?',
    helpText: 'Manual override includes local controls, bypass, or procedures that allow operation during automation or power faults.',
    answerType: 'enum',
  },
  {
    id: 'WW_Q11',
    prompt: 'Is there a monitoring/alarm method for pump failure, high level, or backflow risk?',
    helpText: 'Include SCADA, remote alarming, or local annunciation that alerts operators to pump failure, tank high level, or backflow events.',
    answerType: 'enum',
  },
  {
    id: 'WW_Q12',
    prompt: 'Are critical pump components available through at least two sources?',
    helpText: 'Answer YES when spare parts or suppliers exist beyond a single vendor, allowing rapid repair or replacement.',
    answerType: 'enum',
  },
  {
    id: 'WW_Q13',
    prompt: 'During a wastewater service disruption, does the facility have holding/containment capability?',
    helpText: 'YES when tanks, totes, or contracted services can hold effluent until service is restored. NO when overflow would occur quickly.',
    answerType: 'enum',
    scope: 'PRA_SLA',
  },
  {
    id: 'WW_Q14',
    prompt: 'Has the facility evaluated regulatory/operational constraints for prolonged disruption?',
    helpText: 'Answer YES when environmental permits, regulatory reporting, and operating limitations for extended outages are understood and documented.',
    answerType: 'enum',
  },
];

/** Default wastewater answers. */
export function getDefaultWastewaterAnswers(): WastewaterAnswers {
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
    WW_Q1_discharge_to_sewer: undefined,
    WW_Q2_connection_count: undefined,
    WW_Q3_same_geographic_location: undefined,
    WW_Q4_collocated_corridor: undefined,
    WW_Q6_priority_restoration: undefined,
    WW_Q7_contingency_plan: undefined,
    WW_Q8_onsite_pumping: undefined,
    WW_Q9_backup_power_pumps: undefined,
    WW_Q10_manual_override: undefined,
    WW_Q11_pump_alarming: undefined,
    WW_Q12_dual_source_parts: undefined,
    WW_Q13_holding_capacity: undefined,
    WW_Q14_constraints_evaluated: undefined,
  };
}
