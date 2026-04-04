/**
 * Sync assessment.categories into per-tab session storage so dependency forms
 * show the same data as the assessment (e.g. after loading TEST or importing JSON).
 */
import type { Assessment } from 'schema';
import type { DependencySessionsMap } from './sessionTypes';
import { energyAnswersToElectricPowerCategoryInput } from '@/app/lib/dependencies/energy_to_category_input';
import { commsAnswersToCommsImpactCategoryInput } from '@/app/lib/dependencies/comms_to_category_input';
import { itAnswersToInformationTechnologyCategoryInput } from '@/app/lib/dependencies/it_to_category_input';
import { getDefaultEnergyAnswers } from '@/app/lib/dependencies/infrastructure/energy_spec';
import type { EnergyAnswers } from '@/app/lib/dependencies/infrastructure/energy_spec';
import { deriveEnergyFindings } from '@/app/lib/dependencies/derive_energy_findings';
import { getDefaultCommsAnswers } from '@/app/lib/dependencies/infrastructure/comms_spec';
import type { CommsAnswers } from '@/app/lib/dependencies/infrastructure/comms_spec';
import { getDefaultWaterAnswers } from '@/app/lib/dependencies/infrastructure/water_spec';
import type { WaterAnswers } from '@/app/lib/dependencies/infrastructure/water_spec';
import { getDefaultWastewaterAnswers } from '@/app/lib/dependencies/infrastructure/wastewater_spec';
import type { WastewaterAnswers } from '@/app/lib/dependencies/infrastructure/wastewater_spec';
import { getDefaultItAnswers } from '@/app/lib/dependencies/infrastructure/it_spec';
import type { ItAnswers } from '@/app/lib/dependencies/infrastructure/it_spec';
import {
  saveEnergyAnswers,
  saveCommsAnswers,
  saveWaterAnswers,
  saveWastewaterAnswers,
  saveItAnswers,
} from '@/app/lib/dependencies/persistence';

function pickKeys<T extends Record<string, unknown>>(source: Record<string, unknown>, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) {
    if (k in source && source[k as string] !== undefined) {
      out[k as keyof T] = source[k as string] as T[keyof T];
    }
  }
  return out;
}

/** Exported for export pipeline: get answers from category for derive* (themedFindings). */
export function electricPowerCategoryToEnergyAnswers(cat: Record<string, unknown> | undefined): EnergyAnswers {
  const defaults = getDefaultEnergyAnswers();
  if (!cat || typeof cat !== 'object') return defaults;
  const curveKeys: (keyof EnergyAnswers)[] = [
    'curve_requires_service',
    'curve_primary_provider',
    'curve_time_to_impact_hours',
    'curve_loss_fraction_no_backup',
    'curve_backup_available',
    'curve_backup_duration_hours',
    'curve_loss_fraction_with_backup',
    'curve_recovery_time_hours',
    'redundancy_activation',
  ];
  const out = { ...defaults, ...pickKeys(cat, curveKeys) } as EnergyAnswers;
  const hasBackup = cat.has_backup_any === true || cat.has_backup === true;
  out['E-8_backup_power_available'] = hasBackup ? 'yes' : (cat.curve_backup_available === true ? 'yes' : undefined);
  if (hasBackup && (!out['E-8_backup_assets'] || out['E-8_backup_assets'].length === 0)) {
    out['E-8_backup_assets'] = [
      {
        asset_type: 'generator',
        supported_load_classification: ['critical_core_services'],
        capacity_kw_or_description: 'Test backup',
        fuel_type: 'diesel',
        estimated_runtime: '24 hours',
      },
    ];
  }
  if (cat.curve_requires_service === false) out.curve_requires_service = false;
  else if (cat.requires_service === true) out.curve_requires_service = true;
  return out;
}

export function commsCategoryToCommsAnswers(cat: Record<string, unknown> | undefined): CommsAnswers {
  const defaults = getDefaultCommsAnswers();
  if (!cat || typeof cat !== 'object') return defaults;
  const keys = Object.keys(defaults) as (keyof CommsAnswers)[];
  return { ...defaults, ...pickKeys(cat, keys) } as CommsAnswers;
}

export function waterCategoryToWaterAnswers(cat: Record<string, unknown> | undefined): WaterAnswers {
  const defaults = getDefaultWaterAnswers();
  if (!cat || typeof cat !== 'object') return defaults;
  const keys = Object.keys(defaults) as (keyof WaterAnswers)[];
  return { ...defaults, ...pickKeys(cat, keys) } as WaterAnswers;
}

export function wastewaterCategoryToWastewaterAnswers(cat: Record<string, unknown> | undefined): WastewaterAnswers {
  const defaults = getDefaultWastewaterAnswers();
  if (!cat || typeof cat !== 'object') return defaults;
  const keys = Object.keys(defaults) as (keyof WastewaterAnswers)[];
  return { ...defaults, ...pickKeys(cat, keys) } as WastewaterAnswers;
}

export function itCategoryToItAnswers(cat: Record<string, unknown> | undefined): ItAnswers {
  const defaults = getDefaultItAnswers();
  if (!cat || typeof cat !== 'object') return defaults;
  const keys = Object.keys(defaults) as (keyof ItAnswers)[];
  return { ...defaults, ...pickKeys(cat, keys) } as ItAnswers;
}

/**
 * Write assessment.categories into per-tab localStorage so dependency forms
 * (Energy, Comms, Water, Wastewater, IT) load with the same data when the user opens each tab.
 * Call after setAssessment(testAssessment) or after loading from progress/import.
 */
export function syncAssessmentCategoriesToPerTabStorage(assessment: Assessment): void {
  if (typeof window === 'undefined') return;
  const categories = assessment.categories ?? {};

  const electric = categories.ELECTRIC_POWER as Record<string, unknown> | undefined;
  const energyAnswers = electricPowerCategoryToEnergyAnswers(electric);
  const energyDerived = deriveEnergyFindings(energyAnswers);
  saveEnergyAnswers({ answers: energyAnswers, derived: energyDerived });

  const comms = categories.COMMUNICATIONS as Record<string, unknown> | undefined;
  const commsAnswers = commsCategoryToCommsAnswers(comms);
  saveCommsAnswers({ answers: commsAnswers, derived: {} });

  const water = categories.WATER as Record<string, unknown> | undefined;
  const waterAnswers = waterCategoryToWaterAnswers(water);
  saveWaterAnswers(waterAnswers);

  const wastewater = categories.WASTEWATER as Record<string, unknown> | undefined;
  const wastewaterAnswers = wastewaterCategoryToWastewaterAnswers(wastewater);
  saveWastewaterAnswers(wastewaterAnswers);

  const it = categories.INFORMATION_TECHNOLOGY as Record<string, unknown> | undefined;
  const itAnswers = itCategoryToItAnswers(it);
  saveItAnswers(itAnswers);
}

/**
 * Merge session data into assessment.categories so export/report have the latest
 * dependency form data (e.g. when user edits on standalone IT/Energy pages).
 */
export function mergeSessionsIntoAssessment(
  assessment: Assessment,
  sessions: DependencySessionsMap
): Assessment {
  const categories = { ...(assessment.categories ?? {}) } as Record<string, unknown>;

  const ep = sessions.ELECTRIC_POWER;
  if (ep?.answers && typeof ep.answers === 'object') {
    const existing = categories.ELECTRIC_POWER as Record<string, unknown> | undefined;
    categories.ELECTRIC_POWER = energyAnswersToElectricPowerCategoryInput(
      ep.answers as import('@/app/lib/dependencies/infrastructure/energy_spec').EnergyAnswers,
      existing
    );
  }

  const comms = sessions.COMMUNICATIONS;
  if (comms?.answers && typeof comms.answers === 'object') {
    const existing = categories.COMMUNICATIONS as Record<string, unknown> | undefined;
    categories.COMMUNICATIONS = commsAnswersToCommsImpactCategoryInput(
      comms.answers as import('@/app/lib/dependencies/infrastructure/comms_spec').CommsAnswers,
      existing
    );
  }

  const water = sessions.WATER;
  if (water?.answers && typeof water.answers === 'object') {
    const existing = categories.WATER as Record<string, unknown> | undefined;
    categories.WATER = { ...existing, ...water.answers } as Record<string, unknown>;
  }

  const wastewater = sessions.WASTEWATER;
  if (wastewater?.answers && typeof wastewater.answers === 'object') {
    const existing = categories.WASTEWATER as Record<string, unknown> | undefined;
    categories.WASTEWATER = { ...existing, ...wastewater.answers } as Record<string, unknown>;
  }

  const it = sessions.INFORMATION_TECHNOLOGY;
  if (it?.answers && typeof it.answers === 'object') {
    const existing = categories.INFORMATION_TECHNOLOGY as Record<string, unknown> | undefined;
    categories.INFORMATION_TECHNOLOGY = itAnswersToInformationTechnologyCategoryInput(
      it.answers as import('@/app/lib/dependencies/infrastructure/it_spec').ItAnswers,
      existing
    );
  }

  return { ...assessment, categories: categories as Assessment['categories'] };
}
