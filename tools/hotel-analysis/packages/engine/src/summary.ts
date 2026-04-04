import type { Assessment, CategoryCode, CategoryInput, Supply } from 'schema';

export type SummaryRow = {
  category: CategoryCode;
  requires_service: boolean;
  /** Hours to severe impact; null when not provided (report shows N/A). */
  time_to_impact_hours: number | null;
  capacity_after_impact_no_backup: number;
  has_backup: boolean;
  backup_duration_hours: number | null;
  capacity_after_backup_exhausted: number | null;
  /** Recovery time hours; null when not provided (report shows N/A). */
  recovery_time_hours: number | null;
  /** Sources summary: "Reported sources: 1" | "2+ (verify independence)" | "2+ (independent)" | null for CRITICAL_PRODUCTS. Purely factual; no inference. */
  sources: string | null;
  /** "Yes (<hours>h)" | "No" | null for CRITICAL_PRODUCTS */
  sla: string | null;
  /** "Yes (<category>)" | "Yes (Other: <text>)" | "No" | null for CRITICAL_PRODUCTS */
  pra: string | null;
};

function sourcesSummary(supply: Supply | undefined): string | null {
  if (!supply) return 'Reported sources: 1';
  if (!supply.has_alternate_source) return 'Reported sources: 1';
  const hasIndependent = supply.sources?.some((s) => s.independence === 'DIFFERENT_LOOP_OR_PATH') ?? false;
  return hasIndependent ? '2+ (independent)' : '2+ (verify independence)';
}

function slaSummary(agreements: { has_sla: boolean; sla_hours: number | null } | undefined): string {
  if (!agreements?.has_sla) return 'No';
  const h = agreements.sla_hours;
  return h != null ? `Yes (${h}h)` : 'Yes (—)';
}

function praSummary(agreements: { has_pra: boolean; pra_category: string | null; pra_category_other: string | null } | undefined): string {
  if (!agreements?.has_pra) return 'No';
  const cat = agreements.pra_category;
  if (cat == null) return 'Yes (—)';
  if (cat === 'OTHER') {
    const other = (agreements.pra_category_other ?? '').trim();
    return other ? `Yes (Other: ${other})` : 'Yes (Other: —)';
  }
  return `Yes (${cat})`;
}

function pct(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
}

/** Category may store curve as curve_* (e.g. Communications/IT). Use as fallback so summary and VOFC stay in sync. */
type CategoryInputWithCurve = CategoryInput & {
  curve_requires_service?: boolean;
  curve_time_to_impact_hours?: number | null;
  curve_loss_fraction_no_backup?: number | null;
  curve_recovery_time_hours?: number | null;
  curve_backup_available?: boolean;
  curve_backup_duration_hours?: number | null;
  curve_loss_fraction_with_backup?: number | null;
};

function withCurveFallback(input: CategoryInput): CategoryInput {
  const c = input as CategoryInputWithCurve;
  return {
    ...input,
    requires_service: input.requires_service ?? c.curve_requires_service ?? false,
    time_to_impact_hours: input.time_to_impact_hours ?? c.curve_time_to_impact_hours ?? null,
    loss_fraction_no_backup: input.loss_fraction_no_backup ?? c.curve_loss_fraction_no_backup ?? 0,
    recovery_time_hours: input.recovery_time_hours ?? c.curve_recovery_time_hours ?? null,
    backup_duration_hours: input.backup_duration_hours ?? c.curve_backup_duration_hours ?? null,
    has_backup: input.has_backup ?? (c.curve_backup_available === true ? true : input.has_backup),
    has_backup_any: (input as { has_backup_any?: boolean }).has_backup_any ?? (c.curve_backup_available === true ? true : (input as { has_backup_any?: boolean }).has_backup_any),
    loss_fraction_with_backup: input.loss_fraction_with_backup ?? c.curve_loss_fraction_with_backup ?? null,
  } as CategoryInput;
}

/**
 * Build summary rows from an assessment (one per category).
 * CRITICAL_PRODUCTS with only critical_products (no curve fields) gets a placeholder summary row.
 * Uses curve_* keys as fallback when category stores curve data under curve_* (e.g. Communications/IT).
 */
export function buildSummary(assessment: Assessment): SummaryRow[] {
  const categories = assessment.categories ?? {};
  const effectiveHasBackup = (i: CategoryInput) =>
    i.has_backup_any !== undefined ? i.has_backup_any === true : i.has_backup === true;
  const isTableOnly = (i: CategoryInput) =>
    i.critical_products != null && i.requires_service === undefined;
  return (Object.entries(categories) as [CategoryCode, CategoryInput][]).map(([category, rawInput]) => {
    const input = withCurveFallback(rawInput);
    if (category === 'CRITICAL_PRODUCTS' && isTableOnly(rawInput)) {
      return {
        category: category as CategoryCode,
        requires_service: false,
        time_to_impact_hours: null,
        capacity_after_impact_no_backup: 100,
        has_backup: false,
        backup_duration_hours: null,
        capacity_after_backup_exhausted: null,
        recovery_time_hours: null,
        sources: null,
        sla: null,
        pra: null,
      };
    }
    const supply = input.supply as Supply | undefined;
    const agreements = input.agreements;
    return {
      category: category as CategoryCode,
      requires_service: input.requires_service ?? false,
      time_to_impact_hours: input.time_to_impact_hours ?? null,
      capacity_after_impact_no_backup: pct((1 - (input.loss_fraction_no_backup ?? 0)) * 100),
      has_backup: effectiveHasBackup(input),
      backup_duration_hours: input.backup_duration_hours ?? null,
      capacity_after_backup_exhausted: effectiveHasBackup(input) && input.loss_fraction_with_backup != null
        ? pct((1 - input.loss_fraction_with_backup) * 100)
        : null,
      recovery_time_hours: input.recovery_time_hours ?? null,
      sources: category === 'CRITICAL_PRODUCTS' ? null : sourcesSummary(supply),
      sla: category === 'CRITICAL_PRODUCTS' ? null : slaSummary(agreements),
      pra: category === 'CRITICAL_PRODUCTS' ? null : praSummary(agreements),
    };
  });
}
