/**
 * Determines which condition codes are triggered by the assessment.
 * Output is used for dependency_vofc_local lookup (one row per condition_code).
 * No fuzzy matching; explicit, stable codes only.
 */
import type { Assessment } from 'schema';
import { CONDITION_CODES } from './condition_codes';

type CategoryCode = keyof Assessment['categories'];
type ConditionCode = (typeof CONDITION_CODES)[keyof typeof CONDITION_CODES];

function getCat(assessment: Assessment, code: CategoryCode): Assessment['categories'][CategoryCode] | undefined {
  return assessment.categories?.[code];
}

/**
 * derive condition codes from assessment. Deduped.
 */
export function evaluateConditions(assessment: Assessment): string[] {
  const codes = new Set<string>();

  // ─── ENERGY (ELECTRIC_POWER) ─────────────────────────────────────────────
  const ep = getCat(assessment, 'ELECTRIC_POWER') as {
    requires_service?: boolean;
    supply?: { has_alternate_source?: boolean; sources?: Array<{ independence?: string }> };
    has_backup_any?: boolean;
    has_backup?: boolean;
    backup_duration_hours?: number | null;
    recovery_time_hours?: number | null;
    vehicle_impact_exposure?: 'yes' | 'no' | 'unknown' | 'na';
    vehicle_impact_protection?: 'yes' | 'no' | 'unknown';
  } | undefined;

  if (ep?.requires_service === true) {
    if (ep.supply?.has_alternate_source === false && (ep.supply?.sources?.length ?? 0) <= 1) {
      codes.add(CONDITION_CODES.EP_SINGLE_FEED);
    }
    const sources = ep.supply?.sources ?? [];
    if (sources.some((s) => s.independence === 'SAME_DEMARCATION')) {
      codes.add(CONDITION_CODES.EP_SHARED_ENTRY);
    }
    if (sources.some((s) => (s as { shared_corridor?: string }).shared_corridor === 'yes')) {
      codes.add(CONDITION_CODES.EP_COLOCATED_CORRIDOR);
    }
    const hasBackup = ep.has_backup_any === true || ep.has_backup === true;
    if (!hasBackup) {
      codes.add(CONDITION_CODES.EP_NO_BACKUP_POWER);
    }
    if (hasBackup && (ep.backup_duration_hours == null || ep.backup_duration_hours < 24)) {
      codes.add(CONDITION_CODES.EP_NO_FUEL_CONTINUITY);
    }
    const exposure = ep.vehicle_impact_exposure;
    const protection = ep.vehicle_impact_protection;
    if (exposure === 'unknown') {
      codes.add(CONDITION_CODES.EP_VEHICLE_IMPACT_UNKNOWN);
    }
    if (exposure === 'yes') {
      if (protection === 'no') {
        codes.add(CONDITION_CODES.EP_VEHICLE_IMPACT_UNPROTECTED);
      }
      if (protection === 'unknown') {
        codes.add(CONDITION_CODES.EP_VEHICLE_IMPACT_UNKNOWN);
      }
    }
  }

  // ─── COMMUNICATIONS ─────────────────────────────────────────────────────
  const com = getCat(assessment, 'COMMUNICATIONS') as {
    requires_service?: boolean;
    supply?: { has_alternate_source?: boolean; sources?: Array<{ independence?: string }> };
    vehicle_impact_exposure?: 'yes' | 'no' | 'unknown' | 'na';
    vehicle_impact_protection?: 'yes' | 'no' | 'unknown';
  } | undefined;

  if (com?.requires_service === true) {
    const sources = com.supply?.sources ?? [];
    if (sources.some((s) => s.independence === 'SAME_DEMARCATION')) {
      codes.add(CONDITION_CODES.COM_SHARED_ENTRY);
    }
    if (sources.some((s) => (s as { shared_corridor?: string }).shared_corridor === 'yes')) {
      codes.add(CONDITION_CODES.COM_COLOCATED_CORRIDOR);
    }
    const comExposure = com.vehicle_impact_exposure;
    const comProtection = com.vehicle_impact_protection;
    if (comExposure === 'unknown') {
      codes.add(CONDITION_CODES.COM_VEHICLE_IMPACT_UNKNOWN);
    }
    if (comExposure === 'yes') {
      if (comProtection === 'no') {
        codes.add(CONDITION_CODES.COM_VEHICLE_IMPACT_UNPROTECTED);
      }
      if (comProtection === 'unknown') {
        codes.add(CONDITION_CODES.COM_VEHICLE_IMPACT_UNKNOWN);
      }
    }
    // COM_NO_CONTINGENCY_PLAN removed: PRA/SLA owns provider coordination/restoration questions. Dependency tabs must not duplicate.
  }

  // ─── IT (INFORMATION_TECHNOLOGY) ────────────────────────────────────────
  const it = getCat(assessment, 'INFORMATION_TECHNOLOGY') as {
    requires_service?: boolean;
    supply?: { has_alternate_source?: boolean };
    it_continuity_plan_exists?: string;
    vehicle_impact_exposure?: 'yes' | 'no' | 'unknown' | 'na';
    vehicle_impact_protection?: 'yes' | 'no' | 'unknown';
  } | undefined;

  if (it?.requires_service === true) {
    if (it.supply?.has_alternate_source === false) {
      codes.add(CONDITION_CODES.IT_NO_REDUNDANT_CARRIER);
    }
    if (it.it_continuity_plan_exists === 'no') {
      codes.add(CONDITION_CODES.IT_NO_PRIORITY_RESTORATION);
    }
    const itExposure = it.vehicle_impact_exposure;
    const itProtection = it.vehicle_impact_protection;
    if (itExposure === 'unknown') {
      codes.add(CONDITION_CODES.IT_VEHICLE_IMPACT_UNKNOWN);
    }
    if (itExposure === 'yes') {
      if (itProtection === 'no') {
        codes.add(CONDITION_CODES.IT_VEHICLE_IMPACT_UNPROTECTED);
      }
      if (itProtection === 'unknown') {
        codes.add(CONDITION_CODES.IT_VEHICLE_IMPACT_UNKNOWN);
      }
    }
  }

  // ─── WATER (doctrine-aligned; W_Q1–W_Q18) ───────────────────────────────
  const w = getCat(assessment, 'WATER') as {
    requires_service?: boolean;
    W_Q1_municipal_supply?: string;
    W_Q2_connection_count?: number | null;
    W_Q3_same_geographic_location?: string;
    W_Q4_collocated_corridor?: string;
    W_Q6_priority_restoration?: string;
    W_Q7_contingency_plan?: string;
    W_Q8_alternate_source?: string;
    W_Q9_alternate_supports_core?: string;
    W_Q10_alternate_depends_on_power?: string;
    W_Q11_water_based_suppression?: string;
    W_Q12_fire_secondary_supply?: string;
    W_Q13_fire_impact_evaluated?: string;
    W_Q14_onsite_pumping?: string;
    W_Q15_backup_power_pumps?: string;
    W_Q16_manual_override?: string;
    W_Q17_pump_alarming?: string;
    W_Q18_dual_source_parts?: string;
  } | undefined;

  if (w?.requires_service === true) {
    // A) External service (only when municipal supply)
    if (w.W_Q1_municipal_supply !== 'no') {
      if (w.W_Q2_connection_count === 1) codes.add(CONDITION_CODES.W_SINGLE_CONN);
      if (w.W_Q3_same_geographic_location === 'yes') codes.add(CONDITION_CODES.W_SHARED_ENTRY);
      if (w.W_Q4_collocated_corridor === 'yes') codes.add(CONDITION_CODES.W_COLOCATED_CORRIDOR);
      if (w.W_Q6_priority_restoration === 'no') codes.add(CONDITION_CODES.W_NO_PRIORITY_RESTORATION);
      if (w.W_Q7_contingency_plan === 'no') codes.add(CONDITION_CODES.W_NO_CONTINGENCY_PLAN);
    }
    // B) Alternate water (always)
    if (w.W_Q8_alternate_source === 'no') codes.add(CONDITION_CODES.W_NO_ALTERNATE_SOURCE);
    if (w.W_Q8_alternate_source === 'yes') {
      if (w.W_Q9_alternate_supports_core === 'no') codes.add(CONDITION_CODES.W_ALTERNATE_INSUFFICIENT);
      if (w.W_Q10_alternate_depends_on_power === 'yes') codes.add(CONDITION_CODES.W_ALTERNATE_DEPENDS_ON_POWER);
    }
    // C) Fire suppression (gated)
    if (w.W_Q11_water_based_suppression === 'yes') {
      if (w.W_Q12_fire_secondary_supply === 'no') codes.add(CONDITION_CODES.W_FIRE_NO_BACKUP_SUPPLY);
      if (w.W_Q13_fire_impact_evaluated === 'no') codes.add(CONDITION_CODES.W_FIRE_IMPACT_NOT_EVALUATED);
    }
    // D) Onsite pumps (gated)
    if (w.W_Q14_onsite_pumping === 'yes') {
      if (w.W_Q15_backup_power_pumps === 'no') codes.add(CONDITION_CODES.W_PUMP_NO_BACKUP_POWER);
      if (w.W_Q16_manual_override === 'no') codes.add(CONDITION_CODES.W_PUMP_NO_MANUAL_OVERRIDE);
      if (w.W_Q17_pump_alarming === 'no') codes.add(CONDITION_CODES.W_PUMP_NO_ALARMING);
      if (w.W_Q18_dual_source_parts === 'no') codes.add(CONDITION_CODES.W_PUMP_SINGLE_SOURCE_PARTS);
    }
  }

  // ─── WASTEWATER (doctrine-aligned; WW_Q1–WW_Q14) ─────────────────────────
  const ww = getCat(assessment, 'WASTEWATER') as {
    requires_service?: boolean;
    WW_Q1_discharge_to_sewer?: string;
    WW_Q2_connection_count?: number | null;
    WW_Q3_same_geographic_location?: string;
    WW_Q4_collocated_corridor?: string;
    WW_Q6_priority_restoration?: string;
    WW_Q7_contingency_plan?: string;
    WW_Q8_onsite_pumping?: string;
    WW_Q9_backup_power_pumps?: string;
    WW_Q10_manual_override?: string;
    WW_Q11_pump_alarming?: string;
    WW_Q12_dual_source_parts?: string;
    WW_Q13_holding_capacity?: string;
    WW_Q14_constraints_evaluated?: string;
  } | undefined;

  if (ww?.requires_service === true && ww.WW_Q1_discharge_to_sewer !== 'no') {
    if (ww.WW_Q2_connection_count === 1) codes.add(CONDITION_CODES.WW_SINGLE_CONN);
    if (ww.WW_Q3_same_geographic_location === 'yes') codes.add(CONDITION_CODES.WW_SHARED_ENTRY);
    if (ww.WW_Q4_collocated_corridor === 'yes') codes.add(CONDITION_CODES.WW_COLOCATED_CORRIDOR);
    if (ww.WW_Q6_priority_restoration === 'no') codes.add(CONDITION_CODES.WW_NO_PRIORITY_RESTORATION);
    if (ww.WW_Q7_contingency_plan === 'no') codes.add(CONDITION_CODES.WW_NO_CONTINGENCY_PLAN);
    if (ww.WW_Q8_onsite_pumping === 'yes') {
      if (ww.WW_Q9_backup_power_pumps === 'no') codes.add(CONDITION_CODES.WW_PUMP_NO_BACKUP_POWER);
      if (ww.WW_Q10_manual_override === 'no') codes.add(CONDITION_CODES.WW_PUMP_NO_MANUAL_OVERRIDE);
      if (ww.WW_Q11_pump_alarming === 'no') codes.add(CONDITION_CODES.WW_PUMP_NO_ALARMING);
      if (ww.WW_Q12_dual_source_parts === 'no') codes.add(CONDITION_CODES.WW_PUMP_SINGLE_SOURCE_PARTS);
    }
    if (ww.WW_Q13_holding_capacity === 'no') codes.add(CONDITION_CODES.WW_NO_HOLDING_CAPACITY);
    if (ww.WW_Q14_constraints_evaluated === 'no') codes.add(CONDITION_CODES.WW_CONSTRAINTS_NOT_EVALUATED);
  }

  return Array.from(codes);
}
