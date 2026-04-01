/**
 * Strict trigger evaluation for VOFC matching.
 * All defined conditions must evaluate true; undefined fields are ignored.
 * Direct-input triggers are only evaluated when the assessment actually collected
 * that value (not undefined)—we do not infer vulnerabilities from uncollected data.
 * Applicability: direct input → CONFIRMED; threshold or compound → POTENTIAL.
 */

import type { Assessment, CategoryCode, VOFCApplicability } from "schema";
import type { TriggerConditions } from "./library";

type CategoryInput = Assessment["categories"][keyof Assessment["categories"]];

/** Category may store curve as curve_* (e.g. Communications/IT). Normalize so VOFC triggers see values. */
type CategoryInputWithCurve = CategoryInput & {
  curve_requires_service?: boolean;
  curve_time_to_impact_hours?: number | null;
  curve_loss_fraction_no_backup?: number | null;
  curve_recovery_time_hours?: number | null;
  curve_backup_available?: boolean;
  curve_backup_duration_hours?: number | null;
};

function getNormalizedInput(input: CategoryInput | undefined): CategoryInput | undefined {
  if (input == null) return undefined;
  const c = input as CategoryInputWithCurve;
  return {
    ...input,
    requires_service: input.requires_service ?? c.curve_requires_service,
    time_to_impact_hours: input.time_to_impact_hours ?? c.curve_time_to_impact_hours ?? 0,
    loss_fraction_no_backup: input.loss_fraction_no_backup ?? c.curve_loss_fraction_no_backup ?? 0,
    recovery_time_hours: input.recovery_time_hours ?? c.curve_recovery_time_hours ?? 0,
    backup_duration_hours: input.backup_duration_hours ?? c.curve_backup_duration_hours ?? null,
    has_backup: input.has_backup ?? (c.curve_backup_available === true ? true : input.has_backup),
    has_backup_any: (input as { has_backup_any?: boolean }).has_backup_any ?? (c.curve_backup_available === true ? true : (input as { has_backup_any?: boolean }).has_backup_any),
  } as CategoryInput;
}

/** Direct input triggers → CONFIRMED when all used triggers are in this set. */
const DIRECT_TRIGGERS = new Set<keyof TriggerConditions>([
  "requires_service",
  "has_backup",
  "critical_product_single_source",
  "critical_product_no_alt_supplier",
  "single_source_equipment",
  "no_alt_equipment_supplier",
  "no_preventive_maintenance",
  "backup_not_load_tested",
  "no_spare_parts",
  "no_service_monitoring",
  "no_loss_detection",
  "circular_dependency",
  "cascading_failure_risk",
]);

/** Threshold/curve triggers → contribute to POTENTIAL when present. */
const THRESHOLD_TRIGGERS = new Set<keyof TriggerConditions>([
  "backup_duration_lt_hours",
  "time_to_impact_lte_hours",
  "loss_fraction_gte",
  "recovery_time_gte_hours",
  "equipment_lead_time_gte_days",
]);

/** Default cascade threshold (hours) for cascading_failure_risk. */
const CASCADE_THRESHOLD_HOURS = 24;

/** For CRITICAL_PRODUCTS we do not rely on time-based curve inputs. */
const CRITICAL_PRODUCTS_IGNORED_TRIGGERS = new Set<keyof TriggerConditions>([
  "time_to_impact_lte_hours",
  "loss_fraction_gte",
  "recovery_time_gte_hours",
  "backup_duration_lt_hours",
]);

/** Supply chain / maintenance / monitoring triggers apply only to the 5 dependency categories. */
const NON_CP_TRIGGERS = new Set<keyof TriggerConditions>([
  "single_source_equipment",
  "no_alt_equipment_supplier",
  "equipment_lead_time_gte_days",
  "no_preventive_maintenance",
  "backup_not_load_tested",
  "no_spare_parts",
  "no_service_monitoring",
  "no_loss_detection",
]);

/** Supply chain / maintenance section removed from all tabs. PRA/SLA owns restoration/coordination. Never match these triggers. */
const REMOVED_SUPPLY_CHAIN_TRIGGERS = new Set<keyof TriggerConditions>([
  "single_source_equipment",
  "no_alt_equipment_supplier",
  "equipment_lead_time_gte_days",
  "no_preventive_maintenance",
  "backup_not_load_tested",
  "no_spare_parts",
  "no_service_monitoring",
  "no_loss_detection",
]);

/** Dependency categories for which supply chain section was removed. */
const DEPENDENCY_CATEGORIES = new Set<CategoryCode>([
  "ELECTRIC_POWER",
  "COMMUNICATIONS",
  "INFORMATION_TECHNOLOGY",
  "WATER",
  "WASTEWATER",
]);

/** Communications optional block does not collect these; skip so no VOFC from uncollected data. */
const COMMS_SKIP_TRIGGERS = new Set<keyof TriggerConditions>([
  "no_preventive_maintenance",
  "backup_not_load_tested",
  "no_spare_parts",
  "equipment_lead_time_gte_days",
]);

function getCategoryInput(assessment: Assessment, category: CategoryCode): CategoryInput | undefined {
  return assessment.categories?.[category];
}

/**
 * Evaluates trigger conditions against assessment for a category.
 * - requires_service=false: returns matched=false unless category === CRITICAL_PRODUCTS.
 * - CRITICAL_PRODUCTS: time-based/curve triggers are not evaluated.
 * - First failed condition returns matched=false immediately.
 */
export function evaluateTriggers(
  triggers: TriggerConditions,
  assessment: Assessment,
  category: CategoryCode
): { matched: boolean; applicability: VOFCApplicability } {
  const raw = getCategoryInput(assessment, category);
  const input = getNormalizedInput(raw);
  if (input == null) return { matched: false, applicability: "POTENTIAL" };

  // Supply chain / maintenance section removed from all dependency tabs. Never match VOFCs driven by these triggers.
  if (DEPENDENCY_CATEGORIES.has(category)) {
    const hasRemovedTrigger = (Object.keys(triggers) as (keyof TriggerConditions)[]).some(
      (k) => REMOVED_SUPPLY_CHAIN_TRIGGERS.has(k) && triggers[k] !== undefined
    );
    if (hasRemovedTrigger) return { matched: false, applicability: "POTENTIAL" };
  }

  if (category !== "CRITICAL_PRODUCTS" && input.requires_service === false) {
    return { matched: false, applicability: "POTENTIAL" };
  }

  // Empty trigger_conditions: do NOT match. This is a resilience tool; only show VOFCs
  // that correspond to questions asked in the assessment. Legacy library entries with
  // empty triggers (e.g. physical security, badging, CCTV, IDS) are out of scope.
  const hasAnyTrigger = (Object.keys(triggers) as (keyof TriggerConditions)[]).some(
    (k) => triggers[k] !== undefined
  );
  if (!hasAnyTrigger) {
    return { matched: false, applicability: "POTENTIAL" };
  }

  const usedDirect = new Set<keyof TriggerConditions>();
  const usedThreshold = new Set<keyof TriggerConditions>();
  const cp = input as CategoryInput & {
    critical_product_single_source?: boolean;
    critical_product_no_alt_supplier?: boolean;
  };

  const skipForCategory = (key: keyof TriggerConditions): boolean =>
    (category === "CRITICAL_PRODUCTS" && CRITICAL_PRODUCTS_IGNORED_TRIGGERS.has(key)) ||
    (category === "CRITICAL_PRODUCTS" && NON_CP_TRIGGERS.has(key)) ||
    (category === "COMMUNICATIONS" && COMMS_SKIP_TRIGGERS.has(key));

  if (triggers.requires_service !== undefined && !skipForCategory("requires_service")) {
    if (input.requires_service === undefined) return { matched: false, applicability: "POTENTIAL" };
    if (input.requires_service !== triggers.requires_service) return { matched: false, applicability: "CONFIRMED" };
    usedDirect.add("requires_service");
  }
  const hasBackupCollected =
    (input as { has_backup?: boolean; has_backup_any?: boolean }).has_backup_any !== undefined ||
    (input as { has_backup?: boolean }).has_backup !== undefined;
  const effectiveHasBackup =
    (input as { has_backup_any?: boolean }).has_backup_any === true || (input as { has_backup?: boolean }).has_backup === true;
  if (triggers.has_backup !== undefined && !skipForCategory("has_backup")) {
    if (!hasBackupCollected) return { matched: false, applicability: "POTENTIAL" };
    if (effectiveHasBackup !== triggers.has_backup) return { matched: false, applicability: "CONFIRMED" };
    usedDirect.add("has_backup");
  }
  if (triggers.backup_duration_lt_hours !== undefined && !skipForCategory("backup_duration_lt_hours")) {
    if (!effectiveHasBackup || input.backup_duration_hours == null) return { matched: false, applicability: "POTENTIAL" };
    if (input.backup_duration_hours >= triggers.backup_duration_lt_hours) return { matched: false, applicability: "POTENTIAL" };
    usedThreshold.add("backup_duration_lt_hours");
  }
  if (triggers.time_to_impact_lte_hours !== undefined && !skipForCategory("time_to_impact_lte_hours")) {
    if ((input.time_to_impact_hours ?? 0) > triggers.time_to_impact_lte_hours) return { matched: false, applicability: "POTENTIAL" };
    usedThreshold.add("time_to_impact_lte_hours");
  }
  if (triggers.loss_fraction_gte !== undefined && !skipForCategory("loss_fraction_gte")) {
    if ((input.loss_fraction_no_backup ?? 0) < triggers.loss_fraction_gte) return { matched: false, applicability: "POTENTIAL" };
    usedThreshold.add("loss_fraction_gte");
  }
  if (triggers.recovery_time_gte_hours !== undefined && !skipForCategory("recovery_time_gte_hours")) {
    if ((input.recovery_time_hours ?? 0) < triggers.recovery_time_gte_hours) return { matched: false, applicability: "POTENTIAL" };
    usedThreshold.add("recovery_time_gte_hours");
  }
  if (triggers.critical_product_single_source !== undefined) {
    if (cp.critical_product_single_source === undefined) return { matched: false, applicability: "POTENTIAL" };
    if (cp.critical_product_single_source !== triggers.critical_product_single_source) return { matched: false, applicability: "CONFIRMED" };
    usedDirect.add("critical_product_single_source");
  }
  if (triggers.critical_product_no_alt_supplier !== undefined) {
    if (cp.critical_product_no_alt_supplier === undefined) return { matched: false, applicability: "POTENTIAL" };
    if (cp.critical_product_no_alt_supplier !== triggers.critical_product_no_alt_supplier) return { matched: false, applicability: "CONFIRMED" };
    usedDirect.add("critical_product_no_alt_supplier");
  }

  const ext = input as CategoryInput & {
    equipment_suppliers?: Array<{ alternatives_available?: string }>;
    alternative_providers?: { available?: string };
    lead_time_days?: number | null;
    maintenance_schedule?: {
      preventive_maintenance_established?: string;
      load_test_within_12_months?: string;
      spare_parts_maintained?: string;
    };
    monitoring_capabilities?: { real_time_monitoring_exists?: string; automated_alerts_for_loss?: string };
    comms_single_provider_restoration?: "Yes" | "No" | "Unknown";
    comms_alternate_providers_or_paths?: "Yes" | "No" | "Unknown";
  };

  if (triggers.single_source_equipment !== undefined && !skipForCategory("single_source_equipment")) {
    if (category === "COMMUNICATIONS" && ext.comms_single_provider_restoration !== undefined) {
      const singleProvider = ext.comms_single_provider_restoration === "Yes";
      if (singleProvider !== triggers.single_source_equipment) return { matched: false, applicability: "CONFIRMED" };
      usedDirect.add("single_source_equipment");
    } else {
      const suppliers = ext.equipment_suppliers ?? [];
      const anyNoAlt = suppliers.some((s) => s.alternatives_available === "No");
      if (suppliers.length === 0) return { matched: false, applicability: "POTENTIAL" };
      if (anyNoAlt !== triggers.single_source_equipment) return { matched: false, applicability: "CONFIRMED" };
      usedDirect.add("single_source_equipment");
    }
  }
  if (triggers.no_alt_equipment_supplier !== undefined && !skipForCategory("no_alt_equipment_supplier")) {
    if (category === "COMMUNICATIONS" && ext.comms_alternate_providers_or_paths !== undefined) {
      const noAlt = ext.comms_alternate_providers_or_paths === "No";
      if (noAlt !== triggers.no_alt_equipment_supplier) return { matched: false, applicability: "CONFIRMED" };
      usedDirect.add("no_alt_equipment_supplier");
    } else {
      const avail = ext.alternative_providers?.available;
      if (avail === undefined) return { matched: false, applicability: "POTENTIAL" };
      if ((avail === "No") !== triggers.no_alt_equipment_supplier) return { matched: false, applicability: "CONFIRMED" };
      usedDirect.add("no_alt_equipment_supplier");
    }
  }
  if (triggers.equipment_lead_time_gte_days !== undefined && !skipForCategory("equipment_lead_time_gte_days")) {
    const lead = ext.lead_time_days ?? (ext.alternative_providers as { lead_time_days?: number })?.lead_time_days;
    if (lead == null) return { matched: false, applicability: "POTENTIAL" };
    if (lead < triggers.equipment_lead_time_gte_days) return { matched: false, applicability: "POTENTIAL" };
    usedThreshold.add("equipment_lead_time_gte_days");
  }
  if (triggers.no_preventive_maintenance !== undefined && !skipForCategory("no_preventive_maintenance")) {
    const pm = ext.maintenance_schedule?.preventive_maintenance_established;
    if (pm === undefined) return { matched: false, applicability: "POTENTIAL" };
    if ((pm === "No") !== triggers.no_preventive_maintenance) return { matched: false, applicability: "CONFIRMED" };
    usedDirect.add("no_preventive_maintenance");
  }
  if (triggers.backup_not_load_tested !== undefined && !skipForCategory("backup_not_load_tested")) {
    const lt = ext.maintenance_schedule?.load_test_within_12_months;
    if (lt === undefined) return { matched: false, applicability: "POTENTIAL" };
    if ((lt === "No") !== triggers.backup_not_load_tested) return { matched: false, applicability: "CONFIRMED" };
    usedDirect.add("backup_not_load_tested");
  }
  if (triggers.no_spare_parts !== undefined && !skipForCategory("no_spare_parts")) {
    const sp = ext.maintenance_schedule?.spare_parts_maintained;
    if (sp === undefined) return { matched: false, applicability: "POTENTIAL" };
    if ((sp === "No") !== triggers.no_spare_parts) return { matched: false, applicability: "CONFIRMED" };
    usedDirect.add("no_spare_parts");
  }
  if (triggers.no_service_monitoring !== undefined && !skipForCategory("no_service_monitoring")) {
    const mon = ext.monitoring_capabilities?.real_time_monitoring_exists;
    if (mon === undefined) return { matched: false, applicability: "POTENTIAL" };
    if ((mon === "No") !== triggers.no_service_monitoring) return { matched: false, applicability: "CONFIRMED" };
    usedDirect.add("no_service_monitoring");
  }
  if (triggers.no_loss_detection !== undefined && !skipForCategory("no_loss_detection")) {
    const alerts = ext.monitoring_capabilities?.automated_alerts_for_loss;
    if (alerts === undefined) return { matched: false, applicability: "POTENTIAL" };
    if ((alerts === "No") !== triggers.no_loss_detection) return { matched: false, applicability: "CONFIRMED" };
    usedDirect.add("no_loss_detection");
  }

  const rawCrossDeps = assessment.cross_dependencies;
  const crossDeps: Array<{ from_category?: string; to_category: string; time_to_cascade_hours?: number | null }> = Array.isArray(rawCrossDeps)
    ? rawCrossDeps
    : rawCrossDeps && typeof rawCrossDeps === 'object' && 'edges' in rawCrossDeps
      ? (rawCrossDeps as { edges: Array<{ from_category: string; to_category: string; time_to_cascade_bucket?: string }> }).edges.map(
          (e) => ({
            from_category: e.from_category,
            to_category: e.to_category,
            time_to_cascade_hours: e.time_to_cascade_bucket === 'immediate' ? 0.5
              : e.time_to_cascade_bucket === 'short' ? 3
              : e.time_to_cascade_bucket === 'medium' ? 12
              : e.time_to_cascade_bucket === 'long' ? 48
              : null,
          })
        )
      : [];
  if (triggers.circular_dependency !== undefined) {
    const fromTo = new Set<string>();
    for (const d of crossDeps) {
      const from = (d as { from_category?: string }).from_category ?? "";
      const to = (d as { to_category: string }).to_category ?? "";
      if (from && to) fromTo.add(`${from}:${to}`);
    }
    let hasCircular = false;
    for (const d of crossDeps) {
      const from = (d as { from_category?: string }).from_category ?? "";
      const to = (d as { to_category: string }).to_category ?? "";
      if (from && to && fromTo.has(`${to}:${from}`)) {
        hasCircular = true;
        break;
      }
    }
    if (hasCircular !== triggers.circular_dependency) return { matched: false, applicability: "CONFIRMED" };
    usedDirect.add("circular_dependency");
  }
  if (triggers.cascading_failure_risk !== undefined) {
    const threshold = CASCADE_THRESHOLD_HOURS;
    const hasRisk = crossDeps.some((d) => {
      const h = (d as { time_to_cascade_hours?: number | null }).time_to_cascade_hours;
      return h != null && h <= threshold;
    });
    if (hasRisk !== triggers.cascading_failure_risk) return { matched: false, applicability: "POTENTIAL" };
    usedDirect.add("cascading_failure_risk");
  }

  const totalUsed = usedDirect.size + usedThreshold.size;
  // Do not match when no trigger was defined and satisfied—otherwise we would show
  // VOFCs (e.g. "access control") that have no link to collected assessment data (false assumption).
  if (totalUsed === 0) return { matched: false, applicability: "POTENTIAL" };

  const applicability: VOFCApplicability =
    totalUsed <= 1 || usedThreshold.size === 0 ? "CONFIRMED" : "POTENTIAL";
  return { matched: true, applicability };
}
