import type { CategoryCode, CategoryInput } from 'schema';
import type { UIFieldConfig } from 'schema';

const NON_CP_CATEGORIES: CategoryCode[] = [
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
];

const DEFAULT_AGREEMENTS = {
  has_sla: false,
  sla_hours: null as number | null,
  has_pra: false,
  pra_category: null as string | null,
  pra_category_other: null as string | null,
};

/**
 * Build default CategoryInput from a category's UI field config.
 * Initial state is blank: no default values (undefined) so no question appears pre-filled as "unknown" or NA.
 * For table-driven categories (e.g. Critical Products with fields.length === 0), returns { critical_products: [] }.
 * When category is a non-CP dependency category, adds default agreements block.
 */
export function getDefaultCategoryInput(
  fields: UIFieldConfig[],
  category?: CategoryCode
): CategoryInput {
  if (fields.length === 0) {
    return { critical_products: [] } as CategoryInput;
  }
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    out[f.key] = undefined; // blank initial state; do not use f.defaultValue
  }
  if (out.has_backup === false) {
    out.backup_duration_hours = null;
    out.loss_fraction_with_backup = null;
  }
  if (out.has_backup_any === false) {
    out.has_backup_generator = false;
    out.backup_duration_hours = null;
    out.loss_fraction_with_backup = null;
  }
  if (category != null && NON_CP_CATEGORIES.includes(category)) {
    out.agreements = { ...DEFAULT_AGREEMENTS };
  }
  return out as CategoryInput;
}
