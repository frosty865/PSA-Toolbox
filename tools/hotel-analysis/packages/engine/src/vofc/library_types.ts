/**
 * VOFC library entry types. Types-only (no Node/fs) so client bundles can use them.
 * Used by library.ts (loader) and generate.ts (runGeneration).
 */
import type { CategoryCode } from "schema";

/** Trigger conditions for matching VOFCs to assessments. */
export interface TriggerConditions {
  requires_service?: boolean;
  has_backup?: boolean;
  backup_duration_lt_hours?: number;
  time_to_impact_lte_hours?: number;
  loss_fraction_gte?: number;
  recovery_time_gte_hours?: number;
  critical_product_single_source?: boolean;
  critical_product_no_alt_supplier?: boolean;
  /** Supply chain / equipment: any supplier with alternatives_available === No */
  single_source_equipment?: boolean;
  /** Alternative providers question === No */
  no_alt_equipment_supplier?: boolean;
  /** Max lead_time_days >= this (equipment or alternative_providers) */
  equipment_lead_time_gte_days?: number;
  /** Preventive maintenance === No */
  no_preventive_maintenance?: boolean;
  /** Load test within 12 months === No */
  backup_not_load_tested?: boolean;
  /** Spare parts maintained === No */
  no_spare_parts?: boolean;
  /** Real-time monitoring === No */
  no_service_monitoring?: boolean;
  /** Automated alerts for loss === No */
  no_loss_detection?: boolean;
  /** Circular dependency (A→B and B→A) */
  circular_dependency?: boolean;
  /** Cascading failure risk (time_to_cascade_hours <= threshold) */
  cascading_failure_risk?: boolean;
}

/** Provenance: SOURCE = from library/document; GENERATED = injected/synthesis. */
export type VofcOrigin = "SOURCE" | "GENERATED";

/** Normalized row from library (or pre-built JSON). Used by generation. */
export interface InternalVofcEntry {
  vofc_id: string;
  category: CategoryCode;
  trigger_conditions: TriggerConditions;
  title: string;
  vulnerability: string;
  impact: string | null;
  option_for_consideration: string;
  severity: "LOW" | "MODERATE" | "HIGH";
  applicability: "CONFIRMED" | "POTENTIAL";
  source_ref?: string;
  origin: VofcOrigin;
  source_registry_id?: string | null;
  source_tier?: 1 | 2 | 3 | null;
  source_publisher?: string | null;
  source_sheet?: string;
  source_row?: number;
}
