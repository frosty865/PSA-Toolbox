/**
 * Executive Risk Posture Snapshot Builder
 * 
 * Deterministic, one-page executive summary synthesizing overall risk posture,
 * key drivers, infrastructure sensitivity, and cascading indicators.
 * 
 * DESIGN PRINCIPLES:
 * - Reuses existing driver + synthesis logic (no new scoring)
 * - Fully deterministic (identical inputs → identical outputs)
 * - Non-prescriptive (no "should", "must", "recommend")
 * - Descriptive only (states facts, consequences, context)
 */

import type { KeyRiskDriverVM, DriverCategory } from './vulnerability';
import type { CurveSummary, InfrastructureSection } from './view_model';
import type { TriggeredVulnerability, InfraId } from './vulnerability/vulnerability_types';
import type { SynthesisSection } from './synthesis_builder';

/**
 * Single driver entry in snapshot.
 */
export type SnapshotDriver = {
  title: string;
  severity: 'HIGH' | 'ELEVATED' | 'MODERATE';
  infrastructures: InfraId[];
  shortSummary: string; // First sentence of narrative only
};

/**
 * Infrastructure sensitivity row (deterministic, no raw hours displayed).
 */
export type InfraSensitivityRow = {
  infra: InfraId;
  impactSensitivity: 'Immediate' | 'Near-term' | 'Tolerant';
  mitigationDepth: 'None' | 'Limited' | 'Moderate' | 'Sustained';
  recoverySensitivity: 'Extended' | 'Managed' | 'Rapid';
  cascadeExposure: 'High' | 'Moderate' | 'Low';
};

/**
 * Cascading exposure indicator.
 */
export type CascadingIndicator = {
  summary: string; // "Common-mode dependency exposure identified across X infrastructure systems."
};

/**
 * Executive Risk Posture Snapshot view model.
 * 
 * A one-page executive summary integrating:
 * 1. Overall risk posture classification
 * 2. 3–6 key risk drivers (from engine)
 * 3. Infrastructure sensitivity matrix
 * 4. Cascading exposure indicator (if applicable)
 */
export type ExecutiveRiskPostureSnapshotVM = {
  overallPosture: string;
  drivers: SnapshotDriver[];
  infraMatrix: InfraSensitivityRow[];
  cascadingIndicator?: CascadingIndicator;
};

/**
 * Extract first sentence from narrative.
 * Splits on period followed by space or end of string.
 */
function extractFirstSentence(narrative: string): string {
  const match = narrative.match(/^[^.]*\.(?:\s|$)/);
  if (match) {
    return match[0].trim();
  }
  return narrative.slice(0, 100) + (narrative.length > 100 ? '…' : '');
}

/**
 * Classify overall risk posture from drivers.
 * 
 * Logic:
 * - If any driver.severity === 'HIGH' → "Elevated Structural Sensitivity"
 * - Else if majority are 'ELEVATED' → "Moderate Operational Sensitivity"
 * - Else → "Localized Sensitivity"
 */
function classifyPosture(drivers: KeyRiskDriverVM[]): string {
  if (drivers.length === 0) {
    return 'Localized Sensitivity';
  }

  // Check for any HIGH
  if (drivers.some((d) => d.severity === 'HIGH')) {
    return 'Elevated Structural Sensitivity';
  }

  // Check if majority are ELEVATED
  const elevatedCount = drivers.filter((d) => d.severity === 'ELEVATED').length;
  if (elevatedCount > drivers.length / 2) {
    return 'Moderate Operational Sensitivity';
  }

  return 'Localized Sensitivity';
}

/**
 * Build driver entries for snapshot (no re-sorting; preserve engine order).
 */
function buildSnapshotDrivers(drivers: KeyRiskDriverVM[]): SnapshotDriver[] {
  return drivers.map((driver) => ({
    title: driver.title,
    severity: driver.severity,
    infrastructures: driver.infrastructures,
    shortSummary: extractFirstSentence(driver.narrative),
  }));
}

/**
 * Determine impact sensitivity from curve time-to-impact.
 */
function mapTimeToImpactSensitivity(
  timeToImpactHr?: number
): 'Immediate' | 'Near-term' | 'Tolerant' {
  if (timeToImpactHr === undefined || timeToImpactHr === null) {
    return 'Tolerant';
  }
  if (timeToImpactHr <= 2) return 'Immediate';
  if (timeToImpactHr <= 8) return 'Near-term';
  return 'Tolerant';
}

/**
 * Determine mitigation depth from backup duration.
 */
function mapBackupDurationMitigation(
  backupDurationHr?: number
): 'None' | 'Limited' | 'Moderate' | 'Sustained' {
  // No backup available
  if (backupDurationHr === undefined || backupDurationHr === null) {
    return 'None';
  }
  // Backup < 8 hours
  if (backupDurationHr < 8) return 'Limited';
  // 8–24 hours
  if (backupDurationHr <= 24) return 'Moderate';
  // > 24 hours
  return 'Sustained';
}

/**
 * Determine recovery sensitivity from recovery time.
 */
function mapRecoveryTimeSensitivity(
  recoveryHr?: number
): 'Extended' | 'Managed' | 'Rapid' {
  if (recoveryHr === undefined || recoveryHr === null) {
    return 'Managed';
  }
  if (recoveryHr >= 24) return 'Extended';
  if (recoveryHr > 8) return 'Managed';
  return 'Rapid';
}

/**
 * Determine cascade exposure for infrastructure.
 */
function mapCascadeExposure(
  infraId: InfraId,
  drivers: KeyRiskDriverVM[]
): 'High' | 'Moderate' | 'Low' {
  // Check if any CASCADING driver includes this infra
  const cascadingDriver = drivers.find((d) => d._category === 'CASCADING');
  if (cascadingDriver && cascadingDriver.infrastructures.includes(infraId)) {
    return 'High';
  }

  // Check if any cross-cutting driver (present in multiple infras) includes this
  // A cross-cutting indicator is if driver.infrastructures.length > 1
  const crossCuttingDriver = drivers.find((d) => d.infrastructures.length > 1);
  if (crossCuttingDriver && crossCuttingDriver.infrastructures.includes(infraId)) {
    return 'Moderate';
  }

  return 'Low';
}

/**
 * Build infrastructure sensitivity matrix.
 */
function buildInfraSensitivityMatrix(
  curves: CurveSummary[],
  drivers: KeyRiskDriverVM[]
): InfraSensitivityRow[] {
  return curves.map((curve) => ({
    infra: (curve.infra as unknown as InfraId) ||
      // Parse infra from display name if needed
      (['ELECTRIC_POWER', 'COMMUNICATIONS', 'INFORMATION_TECHNOLOGY', 'WATER', 'WASTEWATER'] as InfraId[]).find(
        (id) => curve.infra.includes(id)
      ) ||
      'ELECTRIC_POWER',
    impactSensitivity: mapTimeToImpactSensitivity(curve.time_to_impact_hr),
    mitigationDepth: mapBackupDurationMitigation(curve.backup_duration_hr),
    recoverySensitivity: mapRecoveryTimeSensitivity(curve.recovery_hr),
    cascadeExposure: mapCascadeExposure(
      (curve.infra as unknown as InfraId) ||
        (['ELECTRIC_POWER', 'COMMUNICATIONS', 'INFORMATION_TECHNOLOGY', 'WATER', 'WASTEWATER'] as InfraId[]).find(
          (id) => curve.infra.includes(id)
        ) ||
        'ELECTRIC_POWER',
      drivers
    ),
  }));
}

/**
 * Build cascading indicator if CASCADING driver present.
 */
function buildCascadingIndicator(drivers: KeyRiskDriverVM[]): CascadingIndicator | undefined {
  const cascadingDriver = drivers.find((d) => d._category === 'CASCADING');
  if (!cascadingDriver) {
    return undefined;
  }

  const usageCount = cascadingDriver.infrastructures.length;
  return {
    summary: `Common-mode dependency exposure identified across ${usageCount} infrastructure systems.`,
  };
}

/**
 * Main builder function: construct Executive Risk Posture Snapshot.
 * 
 * @param args Input data structures
 * @returns Deterministic snapshot view model
 */
export function buildExecutiveRiskPostureSnapshot(args: {
  keyRiskDrivers: KeyRiskDriverVM[];
  infraCurves: CurveSummary[];
}): ExecutiveRiskPostureSnapshotVM {
  const drivers = args.keyRiskDrivers;
  const curves = args.infraCurves;

  return {
    overallPosture: classifyPosture(drivers),
    drivers: buildSnapshotDrivers(drivers),
    infraMatrix: buildInfraSensitivityMatrix(curves, drivers),
    cascadingIndicator: buildCascadingIndicator(drivers),
  };
}
