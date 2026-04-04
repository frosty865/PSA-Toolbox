/**
 * Structural rule (all primary infra): Q1 reliance → Q2 "Who provides…" (only when reliance YES) → Q3+ curve questions.
 * Display order enforced by this array; UI sections render provider immediately after reliance, then curve timing/loss.
 */
export const CURVE_ORDER = [
  'curve_requires_service',   // Q1
  'curve_primary_provider',   // Q2 (showWhen: reliance === YES)
  'curve_time_to_impact',      // Q3
  'curve_loss_no_backup',
  'curve_backup_available',
  'curve_backup_duration',
  'curve_loss_with_backup',
  'curve_recovery_time',
] as const;

/** Comms (and any other) curve question ids that map to CURVE_ORDER positions. Used for allowlist + sort. */
export const CURVE_ID_ALIASES: Record<string, (typeof CURVE_ORDER)[number]> = {
  curve_time_to_impact_hours: 'curve_time_to_impact',
  curve_loss_fraction_no_backup: 'curve_loss_no_backup',
  curve_backup_duration_hours: 'curve_backup_duration',
  curve_loss_fraction_with_backup: 'curve_loss_with_backup',
  curve_recovery_time_hours: 'curve_recovery_time',
};

export type CurveQuestionId = (typeof CURVE_ORDER)[number];

export type InfrastructureCategoryId =
  | 'ELECTRIC_POWER'
  | 'COMMUNICATIONS'
  | 'INFORMATION_TECHNOLOGY'
  | 'WATER'
  | 'WASTEWATER';

export const MAIN_ORDER: Record<InfrastructureCategoryId, readonly string[]> = {
  ELECTRIC_POWER: [
    'E-2',
    'E-3',
    'E-4',
    'E-5',
    'E-6',
    'E-7',
    'E-7a',
    'E-8',
    'E-9',
    'E-10',
    'E-11',
  ],
  COMMUNICATIONS: [
    'CO-1',
    'CO-2',
    'CO-3',
    'CO-4',
    'CO-5',
    'CO-6',
    'CO-7',
    'CO-7a',
    'CO-8',
    'CO-9',
    'CO-10',
    'CO-11',
  ],
  INFORMATION_TECHNOLOGY: [
    'IT-1',
    'IT-2',
    'IT-3',
    'IT-4',
    'IT-5',
    'IT-6',
    'IT-7',
    'IT-7a',
    'IT-11',
    'it_plan_exercised',
  ],
  WATER: [
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
  ],
  WASTEWATER: [
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
  ],
};
