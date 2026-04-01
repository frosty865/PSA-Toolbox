import type { PraCategory } from 'schema';

export type AgreementsState = {
  has_sla: boolean;
  sla_hours: number | null;
  has_pra: boolean;
  pra_category: PraCategory | null;
  pra_category_other: string | null;
};

/** Default state when agreements are missing (e.g. old saved assessment). */
export const DEFAULT_AGREEMENTS_STATE: AgreementsState = {
  has_sla: false,
  sla_hours: null,
  has_pra: false,
  pra_category: null,
  pra_category_other: null,
};

/**
 * Normalize agreements so child fields are cleared when parent is false and schema validation passes.
 * - has_sla=false => sla_hours=null
 * - has_sla=true => sla_hours required; use 0 if missing so schema accepts
 * - has_pra=false => pra_category and pra_category_other=null
 * - has_pra=true => pra_category required; use 'UNKNOWN' if missing so schema accepts
 * - pra_category !== 'OTHER' => pra_category_other=null
 */
export function normalizeAgreements(
  agreements: Partial<AgreementsState> | undefined
): AgreementsState {
  const has_sla = agreements?.has_sla === true;
  const has_pra = agreements?.has_pra === true;
  const rawPraCategory = has_pra ? (agreements?.pra_category ?? null) : null;
  const pra_category = has_pra && rawPraCategory == null ? ('UNKNOWN' as PraCategory) : rawPraCategory;
  return {
    has_sla,
    sla_hours: has_sla ? (agreements?.sla_hours ?? 0) : null,
    has_pra,
    pra_category,
    pra_category_other: pra_category === 'OTHER' ? (agreements?.pra_category_other ?? null) : null,
  };
}
