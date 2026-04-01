/**
 * Representation Contract — single source of truth for report coverage audit.
 * Defines required normalized fields, report payload fields, DOCX anchors,
 * and suppression rules (deterministic reason codes).
 */
import type { SectorKey } from '../conditions/question_condition_map';

export type ConditionKey =
  | 'requires_service'
  | 'provider_confirmed'
  | 'single_provider_or_path'
  | 'entry_diversity'
  | 'corridor_colocated'
  | 'alternate_present'
  | 'alternate_duration_hours'
  | 'restoration_priority_established'
  | 'recovery_hours'
  | 'pace_depth'
  | 'pace_layers_present';

/** Required normalized condition keys per sector (when requires_service=true). */
export const REQUIRED_NORMALIZED_FIELDS_BY_SECTOR: Record<SectorKey, ConditionKey[]> = {
  ELECTRIC_POWER: [
    'requires_service',
    'provider_confirmed',
    'single_provider_or_path',
    'entry_diversity',
    'corridor_colocated',
    'alternate_present',
    'alternate_duration_hours',
    'restoration_priority_established',
    'recovery_hours',
  ],
  COMMUNICATIONS: [
    'requires_service',
    'provider_confirmed',
    'single_provider_or_path',
    'entry_diversity',
    'corridor_colocated',
    'alternate_present',
    'alternate_duration_hours',
    'restoration_priority_established',
    'recovery_hours',
    'pace_depth',
    'pace_layers_present',
  ],
  INFORMATION_TECHNOLOGY: [
    'requires_service',
    'provider_confirmed',
    'single_provider_or_path',
    'entry_diversity',
    'corridor_colocated',
    'alternate_present',
    'alternate_duration_hours',
    'restoration_priority_established',
    'recovery_hours',
  ],
  WATER: [
    'requires_service',
    'provider_confirmed',
    'single_provider_or_path',
    'entry_diversity',
    'corridor_colocated',
    'alternate_present',
    'alternate_duration_hours',
    'restoration_priority_established',
    'recovery_hours',
  ],
  WASTEWATER: [
    'requires_service',
    'provider_confirmed',
    'single_provider_or_path',
    'entry_diversity',
    'corridor_colocated',
    'alternate_present',
    'alternate_duration_hours',
    'restoration_priority_established',
    'recovery_hours',
  ],
};

/** Report payload fields that must be present per sector (pre-DOCX). */
export const REQUIRED_REPORT_PAYLOAD_FIELDS_BY_SECTOR: Record<SectorKey, string[]> = {
  ELECTRIC_POWER: ['curve', 'vulnerabilities', 'intro'],
  COMMUNICATIONS: ['curve', 'vulnerabilities', 'intro', 'pace_summary'],
  INFORMATION_TECHNOLOGY: ['curve', 'vulnerabilities', 'intro'],
  WATER: ['curve', 'vulnerabilities', 'intro'],
  WASTEWATER: ['curve', 'vulnerabilities', 'intro'],
};

/** DOCX anchors that must be populated for a professional report. */
export const REQUIRED_DOCX_ANCHORS: string[] = [
  '[[SNAPSHOT_POSTURE]]',
  '[[SNAPSHOT_SUMMARY]]',
  '[[SNAPSHOT_DRIVERS]]',
  '[[SNAPSHOT_MATRIX]]',
  '[[SNAPSHOT_CASCADE]]',
  '[[CHART_ELECTRIC_POWER]]',
  '[[CHART_COMMUNICATIONS]]',
  '[[CHART_INFORMATION_TECHNOLOGY]]',
  '[[CHART_WATER]]',
  '[[CHART_WASTEWATER]]',
  '[[SYNTHESIS]]',
  '[[PRIORITY_ACTIONS]]',
  '[[DEP_SUMMARY_TABLE]]',
  '[[VULN_NARRATIVE]]',
];

/** Suppression reason codes (deterministic). */
export type SuppressionReasonCode =
  | 'REQUIRES_SERVICE_FALSE'
  | 'ANSWERED_UNKNOWN'
  | 'NOT_COLLECTED_IN_TOOL_VERSION'
  | 'EXCLUDED_BY_CAP'
  | 'GATED_BY_ALTERNATE_ABSENT';

export type SuppressionResult = { key: string; reasonCode: SuppressionReasonCode };

/**
 * Deterministic suppression rules.
 * Returns reason code when a required field is legitimately absent.
 */
export const SUPPRESSION_RULES = {
  /** When requires_service=false, all dependent fields are suppressed. */
  requiresServiceFalse: (): SuppressionReasonCode => 'REQUIRES_SERVICE_FALSE',

  /** When the question was answered but value is UNKNOWN. */
  answeredUnknown: (): SuppressionReasonCode => 'ANSWERED_UNKNOWN',

  /** Field not collected in current tool version. */
  notCollected: (): SuppressionReasonCode => 'NOT_COLLECTED_IN_TOOL_VERSION',

  /** Vulnerability excluded by exec/main/annex cap. */
  excludedByCap: (): SuppressionReasonCode => 'EXCLUDED_BY_CAP',

  /** Field gated by alternate_present=false (e.g. alternate_duration_hours). */
  gatedByAlternateAbsent: (): SuppressionReasonCode => 'GATED_BY_ALTERNATE_ABSENT',
};
