import type { Assessment } from 'schema';
import { UI_CONFIG } from 'schema';
import { getDefaultCategoryInput } from './get-default-category-input';
import { DEFAULT_PRIORITY_RESTORATION } from '@/app/lib/asset-dependency/priorityRestorationSchema';
import { normalizeCurveStorage } from '@/app/lib/assessment/normalize_curve_storage';
import { buildDefaultModulesState } from '@/app/lib/modules/registry';

export function getDefaultAssessment(): Assessment {
  const categories = Object.fromEntries(
    UI_CONFIG.map((c) => [c.category, getDefaultCategoryInput(c.fields)])
  ) as Assessment['categories'];
  const assessment: Assessment = {
    meta: {
      tool_version: '0.1.0',
      template_version: '1',
      created_at_iso: new Date().toISOString(),
    },
    asset: {
      asset_name: '',
      visit_date_iso: new Date().toISOString().slice(0, 10),
      sector: '',
      subsector: '',
      mailing_address_line1: '',
      mailing_address_line2: '',
      mailing_city: '',
      mailing_state: '',
      mailing_zip: '',
      mailing_country: '',
      physical_address: '',
      location: '',
      facility_latitude: '',
      facility_longitude: '',
      assessor: '',
      psa_name: undefined,
      psa_region: undefined,
      psa_city: undefined,
      psa_cell: undefined,
      psa_email: undefined,
    },
    categories,
    priority_restoration: DEFAULT_PRIORITY_RESTORATION,
    settings: { pra_sla_enabled: false, cross_dependency_enabled: false },
    modules: buildDefaultModulesState(),
  };
  return normalizeCurveStorage(assessment);
}
