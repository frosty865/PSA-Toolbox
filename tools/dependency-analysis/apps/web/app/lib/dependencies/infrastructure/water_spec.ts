/**
 * Canonical WATER dependency spec (doctrine-aligned).
 * Questions W_Q1 through W_Q18 with progressive disclosure:
 * - W_Q12-W_Q13 gated by W_Q11=YES (fire suppression)
 * - W_Q15-W_Q18 gated by W_Q14=YES (onsite water equipment)
 */
import { z } from 'zod';

export const WATER_QUESTION_IDS = [
  'W_Q1',
  'W_Q2',
  'W_Q3',
  'W_Q4',
  'W_Q6',
  'W_Q7',
  'W_Q8',
  'W_Q9',
  'W_Q10',
  'W_Q11',
  'W_Q12',
  'W_Q13',
  'W_Q14',
  'W_Q15',
  'W_Q16',
  'W_Q17',
  'W_Q18',
] as const;
export type WaterQuestionId = (typeof WATER_QUESTION_IDS)[number];

export const YesNoUnknownSchema = z.enum(['yes', 'no', 'unknown']);
export type YesNoUnknown = z.infer<typeof YesNoUnknownSchema>;

// ─── Curve (chart) fields ──────────────────────────────────────────────────
export const WaterCurveSchema = z.object({
  curve_requires_service: z.boolean().optional(),
  curve_primary_provider: z.string().optional(),
  curve_time_to_impact_hours: z.number().min(0).max(72).nullable().optional(),
  curve_loss_fraction_no_backup: z.number().min(0).max(1).nullable().optional(),
  curve_backup_available: YesNoUnknownSchema.optional(),
  curve_backup_duration_hours: z.number().min(0).max(96).nullable().optional(),
  curve_loss_fraction_with_backup: z.number().min(0).max(1).nullable().optional(),
  curve_recovery_time_hours: z.number().min(0).max(168).nullable().optional(),
});
export type WaterCurveInput = z.infer<typeof WaterCurveSchema>;

// ─── Answers schema ────────────────────────────────────────────────────────
export const WaterAnswersSchema = z.object({
  // Curve
  curve_requires_service: z.boolean().optional(),
  curve_primary_provider: z.string().optional(),
  curve_time_to_impact_hours: z.number().min(0).max(72).nullable().optional(),
  curve_loss_fraction_no_backup: z.number().min(0).max(1).nullable().optional(),
  curve_backup_duration_hours: z.number().min(0).max(96).nullable().optional(),
  curve_loss_fraction_with_backup: z.number().min(0).max(1).nullable().optional(),
  curve_recovery_time_hours: z.number().min(0).max(168).nullable().optional(),
  /** Redundancy initiation (only when alternate source exists). */
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
  W_Q1_municipal_supply: YesNoUnknownSchema.optional(),
  W_Q2_connection_count: z.number().int().min(0).max(5).nullable().optional(),
  W_Q3_same_geographic_location: YesNoUnknownSchema.optional(),
  W_Q4_collocated_corridor: YesNoUnknownSchema.optional(),
  W_Q6_priority_restoration: YesNoUnknownSchema.optional(),
  W_Q7_contingency_plan: YesNoUnknownSchema.optional(),
  W_Q8_alternate_source: YesNoUnknownSchema.optional(),
  W_Q9_alternate_supports_core: YesNoUnknownSchema.optional(),
  W_Q10_alternate_depends_on_power: YesNoUnknownSchema.optional(),
  W_Q11_water_based_suppression: YesNoUnknownSchema.optional(),
  W_Q12_fire_secondary_supply: YesNoUnknownSchema.optional(),
  W_Q13_fire_impact_evaluated: YesNoUnknownSchema.optional(),
  // D) Onsite Critical Water Equipment (gated)
  W_Q14_onsite_pumping: YesNoUnknownSchema.optional(),
  W_Q15_backup_power_pumps: YesNoUnknownSchema.optional(),
  W_Q16_manual_override: YesNoUnknownSchema.optional(),
  W_Q17_pump_alarming: YesNoUnknownSchema.optional(),
  W_Q18_dual_source_parts: YesNoUnknownSchema.optional(),
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

export type WaterAnswers = z.infer<typeof WaterAnswersSchema>;

/** Question ID -> vulnerability trigger (for verify_question_integrity). */
export const WATER_VULNERABILITY_TRIGGERS: Record<
  string,
  { no?: string; yes?: string }
> = {
  W_Q6: { no: 'W_NO_PRIORITY_RESTORATION' },
  W_Q8: { no: 'W_NO_ALTERNATE_SOURCE' },
  W_Q9: { no: 'W_ALTERNATE_INSUFFICIENT' },
};

export type WaterQuestionDef = {
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
export const WATER_CURVE_QUESTIONS: WaterQuestionDef[] = [
  {
    id: 'curve_requires_service',
    prompt: 'Does the facility rely on water for core operations?',
    helpText: 'Select YES if this infrastructure is required for normal operations. If NO, the impact curve will show no operational impact for this infrastructure.',
    answerType: 'boolean',
    feedsChart: true,
    help_text: 'Select YES if normal facility operations depend on water service. This initiates the impact assessment; if NO, no operational loss is assumed.',
  },
  {
    id: 'curve_primary_provider',
    prompt: 'Who provides potable/process water to the facility/site?',
    helpText: 'Required when the facility relies on water. Enter the name of the water utility or provider.',
    answerType: 'string',
    feedsChart: false,
    help_text: 'Enter the name of the water utility or provider that supplies potable or process water to this facility/site. Required when reliance is YES.',
  },
  {
    id: 'curve_time_to_impact',
    prompt: 'If water service is lost (without alternate source), how soon would the facility be severely impacted? (hours)',
    helpText: 'Estimate how many hours until operations are severely affected if this service is lost and no mitigation is available.',
    answerType: 'number',
    feedsChart: true,
    help_text: 'Estimate in hours how quickly critical operations degrade if water service is lost with no alternate source available. Use realistic estimates based on on-site storage capacity or operational flexibility.',
  },
  {
    id: 'curve_loss_no_backup',
    prompt: 'Once water service is lost (without alternate source), what percentage of normal business functions are lost or degraded?',
    helpText: 'Estimate the percent of normal operations that would be lost or degraded without mitigation. Enter 0–100.',
    answerType: 'number',
    feedsChart: true,
    help_text: 'Enter the percentage (0–100) of facility functions that would be offline if water service is lost without any backup. 100% means complete shutdown; 0% means no loss.',
  },
  {
    id: 'curve_backup_available',
    prompt: 'Is any backup or alternate water source available for this infrastructure?',
    helpText: 'Select YES if there is any alternate or secondary water source that could sustain operations. This gates the backup-specific curve questions.',
    answerType: 'boolean',
    feedsChart: true,
    help_text: 'Select YES if backup or alternate water sources exist (on-site storage, secondary supply line, alternate provider, or manual supply methods). Select NO if no backup exists. This answer determines whether subsequent backup-related questions are asked.',
  },
  {
    id: 'curve_backup_duration',
    prompt: 'How many hours can alternate water source sustain operations without resupply?',
    helpText: 'Estimate how long mitigation can sustain operations before impacts increase (hours).',
    answerType: 'number',
    feedsChart: true,
    help_text: 'Estimate the duration (in hours, 0–96) that alternate water sources can sustain critical operations. This includes on-site storage capacity or manual delivery duration.',
  },
  {
    id: 'curve_loss_with_backup',
    prompt: 'Once water service is lost (considering alternate source), what percentage of normal business functions are lost or degraded?',
    helpText: 'With mitigation in place, estimate the percent of normal operations still lost or degraded. Enter 0–100.',
    answerType: 'number',
    feedsChart: true,
    help_text: 'Enter the percentage (0–100) of facility functions that would still be offline or degraded even with backup water sources active. This captures functions requiring the primary service explicitly.',
  },
  {
    id: 'curve_recovery_time',
    prompt: 'Once external water service is restored, how long until full resumption of operations? (hours)',
    helpText: 'After service is restored, estimate how long it takes to return to normal operations.',
    answerType: 'number',
    feedsChart: true,
    help_text: 'Estimate time (in hours, 0–168) to restore normal facility operations after water service is restored.',
  },
];

/** Question defs for parity config (doctrine-aligned; W_Q1–W_Q18). */
export const WATER_QUESTIONS: WaterQuestionDef[] = [
  { id: 'W_Q1', prompt: 'Does the facility rely on a municipal/public water utility for primary water supply?', helpText: 'Answer YES when your facility receives water from a municipal or public utility. Answer NO if you rely entirely on a private well, onsite source, or other non-municipal supply.', answerType: 'enum' },
  { id: 'W_Q2', prompt: 'How many water service connections supply the facility?', helpText: 'Count the number of distinct service lines entering your facility from the municipal water system (typically 1–5). Multiple connections provide some redundancy.', answerType: 'integer' },
  { id: 'W_Q3', prompt: 'Do all water service connections enter the site at the same geographic location?', helpText: 'Answer YES when all water lines converge at the same point or share the same entry trench. Answer NO if connections are geographically separated (different building sides or distant entry points).', answerType: 'enum' },
  { id: 'W_Q4', prompt: 'Are water service lines/valves/meters collocated in a shared utility corridor with other critical utilities?', helpText: 'Shared corridors expose multiple utilities to the same damage event (excavation, vehicle impact). Answer YES if water infrastructure shares trenches, vaults, or pathways with electric, gas, or communications utilities.', answerType: 'enum' },
  { id: 'W_Q6', prompt: 'Does the facility participate in a priority restoration or coordinated restoration plan with the water utility/provider?', helpText: 'Answer YES if your facility has formal priority restoration status, documented agreements, or confirmed coordination procedures with the water utility for faster service recovery during widespread outages.', answerType: 'enum', scope: 'PRA_SLA' },
  { id: 'W_Q7', prompt: 'Does the facility have a documented contingency/coordination plan with the water utility/provider for extended service disruption?', helpText: 'Answer YES when your facility has documented procedures, contact lists, and coordination steps with the water utility for managing extended service disruptions (days to weeks).', answerType: 'enum', scope: 'PRA_SLA' },
  { id: 'W_Q8', prompt: 'Does the facility have an alternate/backup water source that can be used if primary water service is disrupted?', helpText: 'Examples include onsite storage tanks, secondary well, portable water delivery, or alternate service connection. Answer YES if any alternate source exists; NO if you have no backup.', answerType: 'enum' },
  { id: 'W_Q9', prompt: 'Can the alternate/backup water source support core operational water needs for an extended disruption?', helpText: 'Answer YES when your alternate water source has sufficient capacity and duration to sustain critical facility operations (not just life-safety) during an extended outage (days to weeks).', answerType: 'enum' },
  { id: 'W_Q10', prompt: 'Is the alternate/backup water source dependent on commercial power or another external service to function?', helpText: 'Answer YES if your alternate water source requires grid power, communications, or other external services to operate (e.g., electric pumps, automated controls). Answer NO if it operates independently.', answerType: 'enum' },
  { id: 'W_Q11', prompt: 'Does the facility rely on water-based fire suppression systems that depend on water service pressure/supply?', helpText: 'Answer YES if your facility has sprinkler systems, standpipes, or fire hydrants that depend on municipal water pressure. Answer NO if you have no water-based fire suppression or it operates independently.', answerType: 'enum' },
  { id: 'W_Q12', prompt: 'Is there a secondary water supply approach for fire suppression if primary water pressure/supply is lost?', helpText: 'Examples include onsite fire water storage tanks, fire pumps with backup power, or alternate water sources. Answer YES if secondary fire suppression capability exists.', answerType: 'enum', scope: 'PRA_SLA' },
  { id: 'W_Q13', prompt: 'Has the facility evaluated the operational impact if fire suppression water is unavailable during a prolonged disruption?', helpText: 'Answer YES if you have assessed how loss of fire suppression capability affects facility operations, insurance, regulatory compliance, and risk tolerance during extended water outages.', answerType: 'enum' },
  { id: 'W_Q14', prompt: 'Does the facility rely on onsite water pumping/boosting equipment to maintain usable water supply/pressure?', helpText: 'Answer YES if your facility requires booster pumps, lift stations, or pressurization equipment to deliver adequate water pressure to your operations. Answer NO if municipal pressure is sufficient.', answerType: 'enum' },
  { id: 'W_Q15', prompt: 'Is backup power available to support onsite water pumps/boosters during a power outage?', helpText: 'Answer YES when your water pumps have generator, UPS, or portable power connections sized to run required loads during grid outages.', answerType: 'enum' },
  { id: 'W_Q16', prompt: 'Can onsite water pumps/boosters be operated or overridden manually if automated controls fail?', helpText: 'Manual override includes local controls, manual start buttons, or procedures that allow pump operation during automation or controls failures. Answer YES if manual operation is possible.', answerType: 'enum' },
  { id: 'W_Q17', prompt: 'Is there a monitoring/alarm method for low pressure, pump failure, or storage depletion (onsite)?', helpText: 'Include SCADA, remote alarming, local annunciation, or monitoring systems that alert operators to water system problems (low pressure, pump failure, tank depletion). Answer YES if monitoring exists.', answerType: 'enum' },
  { id: 'W_Q18', prompt: 'Are critical pump/control components identified and available through at least two sources?', helpText: 'Answer YES when spare parts and components for critical water pumps and controls can be sourced from multiple vendors, allowing rapid repair during supply chain disruptions.', answerType: 'enum' },
];

/** Default water answers. */
export function getDefaultWaterAnswers(): WaterAnswers {
  return {
    curve_requires_service: undefined,
    curve_primary_provider: undefined,
    curve_time_to_impact_hours: undefined,
    curve_loss_fraction_no_backup: undefined,
    curve_backup_duration_hours: undefined,
    curve_loss_fraction_with_backup: undefined,
    curve_recovery_time_hours: undefined,
    redundancy_activation: undefined,
    W_Q1_municipal_supply: undefined,
    W_Q2_connection_count: undefined,
    W_Q3_same_geographic_location: undefined,
    W_Q4_collocated_corridor: undefined,
    W_Q6_priority_restoration: undefined,
    W_Q7_contingency_plan: undefined,
    W_Q8_alternate_source: undefined,
    W_Q9_alternate_supports_core: undefined,
    W_Q10_alternate_depends_on_power: undefined,
    W_Q11_water_based_suppression: undefined,
    W_Q12_fire_secondary_supply: undefined,
    W_Q13_fire_impact_evaluated: undefined,
    W_Q14_onsite_pumping: undefined,
    W_Q15_backup_power_pumps: undefined,
    W_Q16_manual_override: undefined,
    W_Q17_pump_alarming: undefined,
    W_Q18_dual_source_parts: undefined,
  };
}
