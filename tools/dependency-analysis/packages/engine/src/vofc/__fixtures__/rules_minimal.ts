/**
 * Minimal VOFC rules for regression tests. Do NOT depend on XLSX.
 * These fixtures are the regression backbone; change only with documented rationale.
 */

import type { CategoryCode } from "schema";
import type { TriggerConditions } from "../library";

export type VOFCSeverity = "LOW" | "MODERATE" | "HIGH";

export interface MinimalVofcRule {
  vofc_id: string;
  category: CategoryCode;
  trigger_conditions: TriggerConditions;
  title: string;
  vulnerability: string;
  impact: string | null;
  option_for_consideration: string;
  base_severity: VOFCSeverity;
}

export const MINIMAL_VOFC_RULES: MinimalVofcRule[] = [
  // ELECTRIC_POWER
  {
    vofc_id: "EP-01",
    category: "ELECTRIC_POWER",
    trigger_conditions: { requires_service: true, has_backup: false },
    title: "No backup power",
    vulnerability: "Backup was not identified.",
    impact: null,
    option_for_consideration: "Options may be evaluated.",
    base_severity: "MODERATE",
  },
  {
    vofc_id: "EP-02",
    category: "ELECTRIC_POWER",
    trigger_conditions: { loss_fraction_gte: 0.5 },
    title: "High loss fraction",
    vulnerability: "Loss fraction meets threshold.",
    impact: null,
    option_for_consideration: "Mitigation may be considered.",
    base_severity: "HIGH",
  },
  {
    vofc_id: "EP-03",
    category: "ELECTRIC_POWER",
    trigger_conditions: { time_to_impact_lte_hours: 4 },
    title: "Short time to impact",
    vulnerability: "Time to impact is within band.",
    impact: null,
    option_for_consideration: "Plans may be reviewed.",
    base_severity: "MODERATE",
  },
  // WATER
  {
    vofc_id: "W-01",
    category: "WATER",
    trigger_conditions: { recovery_time_gte_hours: 72 },
    title: "Long recovery",
    vulnerability: "Recovery time is extended.",
    impact: null,
    option_for_consideration: "Recovery plans may be evaluated.",
    base_severity: "MODERATE",
  },
  // COMMUNICATIONS
  {
    vofc_id: "COM-01",
    category: "COMMUNICATIONS",
    trigger_conditions: { backup_duration_lt_hours: 8 },
    title: "Short backup duration",
    vulnerability: "Backup duration is limited.",
    impact: null,
    option_for_consideration: "Backup options may be considered.",
    base_severity: "LOW",
  },
  // CRITICAL_PRODUCTS
  {
    vofc_id: "CP-01",
    category: "CRITICAL_PRODUCTS",
    trigger_conditions: { critical_product_single_source: true },
    title: "Single source dependency",
    vulnerability: "Critical product has single source.",
    impact: null,
    option_for_consideration: "Diversification may be considered.",
    base_severity: "MODERATE",
  },
  {
    vofc_id: "CP-02",
    category: "CRITICAL_PRODUCTS",
    trigger_conditions: { critical_product_no_alt_supplier: true },
    title: "No alternative supplier",
    vulnerability: "No alternative supplier was identified.",
    impact: null,
    option_for_consideration: "Alternatives may be evaluated.",
    base_severity: "MODERATE",
  },
  // Prescriptive rule for normalization failure testing
  {
    vofc_id: "BAD-01",
    category: "ELECTRIC_POWER",
    trigger_conditions: { requires_service: true },
    title: "Bad option",
    vulnerability: "Vulnerability text.",
    impact: null,
    option_for_consideration: "You should install a backup.",
    base_severity: "LOW",
  },
];

// Extra EP rules for 4-per-category cap test (so >4 match for ELECTRIC_POWER).
// Use real trigger conditions—empty triggers no longer match (resilience tool scope).
export const EP_EXTRA_FOR_CAP: MinimalVofcRule[] = [
  {
    vofc_id: "EP-04",
    category: "ELECTRIC_POWER",
    trigger_conditions: { recovery_time_gte_hours: 24 },
    title: "EP extra one",
    vulnerability: "Extra rule one.",
    impact: null,
    option_for_consideration: "May be considered.",
    base_severity: "MODERATE",
  },
  {
    vofc_id: "EP-05",
    category: "ELECTRIC_POWER",
    trigger_conditions: { recovery_time_gte_hours: 12 },
    title: "EP extra two",
    vulnerability: "Extra rule two.",
    impact: null,
    option_for_consideration: "May be evaluated.",
    base_severity: "LOW",
  },
];

/** Rules for cap test: EP-01..EP-05 (no BAD-01) so >4 match for ELECTRIC_POWER. */
export const MINIMAL_VOFC_RULES_WITH_EP_EXTRA: MinimalVofcRule[] = [
  ...MINIMAL_VOFC_RULES.filter((r) => r.vofc_id !== "BAD-01"),
  ...EP_EXTRA_FOR_CAP,
];
