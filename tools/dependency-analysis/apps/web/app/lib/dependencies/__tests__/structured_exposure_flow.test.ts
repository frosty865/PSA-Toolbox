import { describe, it, expect } from 'vitest';
import type { CategoryInput } from 'schema';
import { commsAnswersToCommsImpactCategoryInput } from '../comms_to_category_input';
import { itAnswersToInformationTechnologyCategoryInput } from '../it_to_category_input';
import { getDefaultCommsAnswers } from '../infrastructure/comms_spec';
import { getDefaultItAnswers } from '../infrastructure/it_spec';

describe('structured exposure flow mappers', () => {
  it('clears curve-dependent fields when communications requires_service becomes false', () => {
    const answers = getDefaultCommsAnswers();
    answers.curve_requires_service = false;
    answers.curve_time_to_impact_hours = 12;
    answers.curve_loss_fraction_no_backup = 0.6;
    answers.curve_backup_available = 'yes';
    answers.curve_backup_duration_hours = 24;
    answers.curve_loss_fraction_with_backup = 0.3;
    answers.curve_recovery_time_hours = 18;

    const existingCategory = {
      time_to_impact_hours: 10,
      loss_fraction_no_backup: 0.5,
      has_backup_any: true,
      backup_duration_hours: 8,
      loss_fraction_with_backup: 0.25,
      recovery_time_hours: 12,
    } as CategoryInput;

    const result = commsAnswersToCommsImpactCategoryInput(answers, existingCategory);

    expect(result.requires_service).toBe(false);
    expect(result.time_to_impact_hours).toBeNull();
    expect(result.loss_fraction_no_backup).toBeNull();
    expect(result.has_backup_any).toBeNull();
    expect(result.backup_duration_hours).toBeNull();
    expect(result.loss_fraction_with_backup).toBeNull();
    expect(result.recovery_time_hours).toBeNull();
  });

  it('passes through PACE and coordination for communications', () => {
    const answers = getDefaultCommsAnswers();
    answers.curve_requires_service = true;
    answers.comm_pace_P = { system_type: 'CELLULAR_VOICE', cellular_diversity: 'SINGLE_CARRIER' };
    answers.comm_interoperability = 'PARTIAL';
    answers.comm_restoration_coordination = 'yes';
    const result = commsAnswersToCommsImpactCategoryInput(answers, {});
    expect(result.comm_pace_P).toEqual(answers.comm_pace_P);
    expect(result.comm_interoperability).toBe('PARTIAL');
    expect(result.comm_restoration_coordination).toBe('yes');
  });

  it('clears IT backup-dependent fields when alternate method is unavailable', () => {
    const answers = getDefaultItAnswers() as Record<string, unknown>;
    answers.curve_requires_service = true;
    answers['IT-8_backup_available'] = 'no';
    answers.curve_backup_duration_hours = 16;
    answers.curve_loss_fraction_with_backup = 0.4;

    const existing = {
      backup_duration_hours: 12,
      loss_fraction_with_backup: 0.35,
    } as CategoryInput;

    const result = itAnswersToInformationTechnologyCategoryInput(answers as ReturnType<typeof getDefaultItAnswers>, existing);

    expect(result.has_backup_any).toBe(false);
    expect(result.backup_duration_hours).toBeNull();
    expect(result.loss_fraction_with_backup).toBeNull();
  });

  it('maps IT vehicle impact follow-up consistently', () => {
    const answers = getDefaultItAnswers();
    answers['IT-7_installation_location'] = 'exterior_at_grade';
    answers['IT-7_vehicle_impact_exposure'] = 'yes';
    answers['IT-7a_vehicle_impact_protection'] = 'unknown';
    const withExposure = itAnswersToInformationTechnologyCategoryInput(answers);
    expect(withExposure.vehicle_impact_exposure).toBe('yes');
    expect(withExposure.vehicle_impact_protection).toBe('unknown');

    const noExposureAnswers = getDefaultItAnswers();
    noExposureAnswers['IT-7_installation_location'] = 'exterior_at_grade';
    noExposureAnswers['IT-7_vehicle_impact_exposure'] = 'no';
    noExposureAnswers['IT-7a_vehicle_impact_protection'] = 'yes';
    const noExposure = itAnswersToInformationTechnologyCategoryInput(noExposureAnswers);
    expect(noExposure.vehicle_impact_exposure).toBe('no');
    expect(noExposure.vehicle_impact_protection).toBe('unknown');

    const naExposureAnswers = getDefaultItAnswers();
    naExposureAnswers['IT-7_installation_location'] = 'interior_or_underground';
    naExposureAnswers['IT-7_vehicle_impact_exposure'] = 'na';
    const naExposure = itAnswersToInformationTechnologyCategoryInput(naExposureAnswers);
    expect(naExposure.vehicle_impact_exposure).toBe('na');
    expect(naExposure.vehicle_impact_protection).toBe('unknown');
    expect(naExposure.it_installation_location).toBe('interior_or_underground');
  });
});
