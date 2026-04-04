/**
 * Derive ELECTRIC_POWER CategoryInput from Energy answers.
 * Curve fields (curve_*) and E-8 feed the impact chart.
 */
import type { CategoryInput } from 'schema';
import type { EnergyAnswers } from './infrastructure/energy_spec';
import {
  clearDependentFields,
  DEPENDENTS_WHEN_REQUIRES_SERVICE_FALSE,
  DEPENDENTS_WHEN_HAS_BACKUP_FALSE,
} from '@/lib/clear-dependent-fields';

export function energyAnswersToElectricPowerCategoryInput(
  answers: EnergyAnswers,
  existingCategory: Partial<CategoryInput> = {}
): CategoryInput {
  const requires_service = answers.curve_requires_service !== false;
  const has_backup_any =
    answers['E-8_backup_power_available'] === 'yes' || answers.curve_backup_available === 'yes';
  const has_backup_generator =
    has_backup_any &&
    answers['E-8_backup_assets']?.some((a) => a.asset_type === 'generator') === true;

  let out: Record<string, unknown> = {
    ...existingCategory,
    requires_service,
    curve_primary_provider: requires_service ? (answers.curve_primary_provider ?? (existingCategory as Record<string, unknown>).curve_primary_provider ?? null) : null,
    time_to_impact_hours: answers.curve_time_to_impact_hours ?? existingCategory.time_to_impact_hours ?? null,
    loss_fraction_no_backup:
      answers.curve_loss_fraction_no_backup ?? existingCategory.loss_fraction_no_backup ?? null,
    has_backup_any,
    has_backup: has_backup_any,
    has_backup_generator: has_backup_any ? has_backup_generator : false,
    backup_duration_hours: has_backup_any
      ? (answers.curve_backup_duration_hours ?? existingCategory.backup_duration_hours ?? 96)
      : null,
    loss_fraction_with_backup: has_backup_any
      ? (answers.curve_loss_fraction_with_backup ?? existingCategory.loss_fraction_with_backup ?? 0.34)
      : null,
    recovery_time_hours:
      answers.curve_recovery_time_hours ?? existingCategory.recovery_time_hours ?? null,
    backup_capacity_pct: undefined,
    backup_type: has_backup_any ? (existingCategory.backup_type ?? undefined) : undefined,
    redundancy_activation: (() => {
      if (!has_backup_any) return undefined;
      const raw = answers.redundancy_activation ?? existingCategory.redundancy_activation;
      if (raw == null || typeof raw !== 'object') return undefined;
      const o = raw as Record<string, unknown>;
      return (o.mode != null ? raw : { ...o, mode: 'UNKNOWN' }) as CategoryInput['redundancy_activation'];
    })(),
  };

  const vehicleImpactExposure = answers['E-7_vehicle_impact_exposure'];
  const vehicleImpactProtection =
    vehicleImpactExposure === 'yes' ? answers['E-7a_vehicle_impact_protection'] ?? 'unknown' : 'unknown';

  out.vehicle_impact_exposure = vehicleImpactExposure;
  out.vehicle_impact_protection = vehicleImpactProtection;

  if (requires_service === false) {
    out = clearDependentFields(out, [...DEPENDENTS_WHEN_REQUIRES_SERVICE_FALSE]);
  }
  if (has_backup_any === false) {
    out = clearDependentFields(out, [...DEPENDENTS_WHEN_HAS_BACKUP_FALSE]);
  }

  // Preserve raw answers for question-driven vulnerability evaluation (E-2, E-3, E-8, etc.)
  out.answers = answers;

  return out as CategoryInput;
}

