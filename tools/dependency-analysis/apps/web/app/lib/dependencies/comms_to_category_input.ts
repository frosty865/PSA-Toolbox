/**
 * Derive COMMUNICATIONS CategoryInput from Comms answers.
 * Curve fields (curve_*) feed the impact chart. Full comm_* and PACE are passed through for report VM.
 * Backward compatibility: map legacy CO-* fields to new shape when present.
 */
import type { CategoryInput } from 'schema';
import type { CommsAnswers } from './infrastructure/comms_spec';
import {
  clearDependentFields,
  DEPENDENTS_WHEN_REQUIRES_SERVICE_FALSE,
  DEPENDENTS_WHEN_HAS_BACKUP_FALSE,
} from '@/lib/clear-dependent-fields';

/** Map new CommsAnswers (+ optional legacy) to CategoryInput and full category payload for assessment. */
export function commsAnswersToCommsImpactCategoryInput(
  answers: CommsAnswers,
  existingCategory: Partial<CategoryInput> = {}
): CategoryInput & Record<string, unknown> {
  const has_backup = answers.curve_backup_available === 'yes';
  const requires_service = answers.curve_requires_service !== false;

  let out: Record<string, unknown> = {
    ...existingCategory,
    requires_service,
    curve_primary_provider: requires_service ? (answers.curve_primary_provider ?? (existingCategory as Record<string, unknown>).curve_primary_provider ?? null) : null,
    time_to_impact_hours: answers.curve_time_to_impact_hours ?? existingCategory.time_to_impact_hours ?? null,
    loss_fraction_no_backup:
      answers.curve_loss_fraction_no_backup ?? existingCategory.loss_fraction_no_backup ?? null,
    has_backup,
    has_backup_any: has_backup,
    backup_duration_hours: has_backup
      ? (answers.curve_backup_duration_hours ?? existingCategory.backup_duration_hours ?? 96)
      : null,
    loss_fraction_with_backup: has_backup
      ? (answers.curve_loss_fraction_with_backup ?? existingCategory.loss_fraction_with_backup ?? 0.34)
      : null,
    redundancy_activation: (() => {
      if (!has_backup) return undefined;
      const raw = answers.redundancy_activation ?? existingCategory.redundancy_activation;
      if (raw == null || typeof raw !== 'object') return undefined;
      const o = raw as Record<string, unknown>;
      return (o.mode != null ? raw : { ...o, mode: 'UNKNOWN' }) as CategoryInput['redundancy_activation'];
    })(),
    recovery_time_hours:
      answers.curve_recovery_time_hours ?? existingCategory.recovery_time_hours ?? null,
    backup_capacity_pct: undefined,
    backup_type: undefined,
    // Curve keys for chart/report
    curve_requires_service: answers.curve_requires_service,
    curve_time_to_impact_hours: answers.curve_time_to_impact_hours ?? null,
    curve_loss_fraction_no_backup: answers.curve_loss_fraction_no_backup ?? null,
    curve_backup_available: answers.curve_backup_available ?? null,
    curve_backup_duration_hours: answers.curve_backup_duration_hours ?? null,
    curve_loss_fraction_with_backup: answers.curve_loss_fraction_with_backup ?? null,
    curve_recovery_time_hours: answers.curve_recovery_time_hours ?? null,
    // New comms payload for report VM (PACE, coordination) — persist so assessment.categories stays current
    comm_voice_functions: answers.comm_voice_functions,
    comm_voice_functions_other_detail: answers.comm_voice_functions_other_detail,
    comm_pace_P: answers.comm_pace_P,
    comm_pace_A: answers.comm_pace_A,
    comm_pace_C: answers.comm_pace_C,
    comm_pace_E: answers.comm_pace_E,
    comm_single_point_voice_failure: answers.comm_single_point_voice_failure,
    comm_interoperability: answers.comm_interoperability,
    comm_restoration_coordination: answers.comm_restoration_coordination,
  };

  if (requires_service === false) {
    out = clearDependentFields(out, [...DEPENDENTS_WHEN_REQUIRES_SERVICE_FALSE]);
  }
  if (has_backup === false) {
    out = clearDependentFields(out, [...DEPENDENTS_WHEN_HAS_BACKUP_FALSE]);
  }

  // Persist PACE layer configuration (prevents embedded remount reversion)
  out.comm_pace_P = answers.comm_pace_P ?? {};
  out.comm_pace_A = answers.comm_pace_A ?? {};
  out.comm_pace_C = answers.comm_pace_C ?? {};
  out.comm_pace_E = answers.comm_pace_E ?? {};

  // Preserve raw answers for question-driven vulnerability evaluation
  out.answers = answers;

  return out as CategoryInput & Record<string, unknown>;
}

/**
 * Map legacy Communications answers (CO-*, old curve keys) into new CommsAnswers shape.
 * Best-effort: provider list → comm_pace_P.provider_name; CO-8 → curve_backup_available.
 */
export function mapLegacyCommsToNew(legacy: Record<string, unknown>): Partial<CommsAnswers> {
  const out: Partial<CommsAnswers> = {};
  if (legacy.curve_requires_service !== undefined) out.curve_requires_service = legacy.curve_requires_service as boolean;
  if (legacy.curve_time_to_impact_hours !== undefined) out.curve_time_to_impact_hours = legacy.curve_time_to_impact_hours as number | null;
  if (legacy.curve_loss_fraction_no_backup !== undefined) out.curve_loss_fraction_no_backup = legacy.curve_loss_fraction_no_backup as number | null;
  if (legacy.curve_backup_available !== undefined) out.curve_backup_available = legacy.curve_backup_available as 'yes' | 'no' | 'unknown';
  if (legacy.curve_backup_duration_hours !== undefined) out.curve_backup_duration_hours = legacy.curve_backup_duration_hours as number | null;
  if (legacy.curve_loss_fraction_with_backup !== undefined) out.curve_loss_fraction_with_backup = legacy.curve_loss_fraction_with_backup as number | null;
  if (legacy.curve_recovery_time_hours !== undefined) out.curve_recovery_time_hours = legacy.curve_recovery_time_hours as number | null;
  // Legacy CO-8 backup
  const co8 = legacy['CO-8_backup_available'];
  if (co8 !== undefined && out.curve_backup_available === undefined)
    out.curve_backup_available = co8 === true ? 'yes' : co8 === false ? 'no' : (co8 as 'yes' | 'no' | 'unknown');
  // Legacy CO-1 providers → first provider name into PACE P
  const providers = legacy['CO-1_service_providers'] as Array<{ provider_name?: string }> | undefined;
  if (Array.isArray(providers) && providers.length > 0 && providers[0].provider_name) {
    out.comm_pace_P = { ...out.comm_pace_P, provider_name: providers[0].provider_name };
  }
  // Legacy CO-11 restoration coordination
  const co11 = legacy['CO-11_restoration_coordination'];
  if (co11 !== undefined && (out.comm_restoration_coordination === undefined))
    out.comm_restoration_coordination = co11 === true ? 'yes' : co11 === false ? 'no' : (co11 as 'yes' | 'no' | 'unknown');
  return out;
}
