/**
 * Rules for when questions become non-applicable (N/A).
 * 
 * A question is N/A when:
 * 1. A prerequisite answer is set to NO/UNKNOWN (e.g., if no backup exists, backup duration is N/A)
 * 2. A parent context makes the question irrelevant (e.g., underground fiber can't be affected by vehicles)
 * 3. A different path/answer makes the question redundant (user selected alternate approach)
 */

export type AssessmentState = Record<string, unknown>;

export interface ApplicabilityContext {
  infraId: string;
  questionId: string;
  assessmentState: AssessmentState;
}

export type ApplicabilityResult = 'applicable' | 'not-applicable' | 'recommended-skip';

/**
 * Compute applicability for a question given current assessment state.
 * 
 * @returns 'applicable' - question should be shown and answered
 *          'not-applicable' - question should not be shown (N/A)
 *          'recommended-skip' - question can be shown but skip is recommended
 */
export function computeApplicability(
  infraId: string,
  questionId: string,
  assessmentState: AssessmentState | undefined
): ApplicabilityResult {
  if (!assessmentState) {
    return 'applicable';
  }

  // ============================================================
  // CURVE SECTION GATING
  // ============================================================

  // curve_backup_duration and curve_loss_with_backup require curve_backup_available=YES
  if (
    (questionId === 'curve_backup_duration' || questionId === 'curve_loss_with_backup') &&
    assessmentState.curve_backup_available !== 'YES'
  ) {
    return 'not-applicable';
  }

  // ============================================================
  // ENERGY INFRASTRUCTURE (E-*)
  // ============================================================

  if (infraId === 'energy') {
    // If no primary power dependency: most questions become N/A
    if (assessmentState['E-1_direct_tie'] === 'NO' && assessmentState['E-2_bulk_power'] === 'NO') {
      if (!questionId.startsWith('curve_')) {
        return 'not-applicable';
      }
    }

    // If distribution-level only (no transmission): skip transmission-specific gating (E-5)
    if (
      assessmentState['E-2_bulk_power'] === 'NO' &&
      assessmentState['E-1_direct_tie'] === 'YES' &&
      questionId === 'E-5_transmission_exposure'
    ) {
      return 'recommended-skip';
    }

    // If primary power is secured by contracts/SLA: E-3 (backup planning) becomes N/A
    if (assessmentState['E-3_primary_recovery_time'] !== undefined && questionId === 'E-4_backup_power') {
      const recovery = assessmentState['E-3_primary_recovery_time'];
      if (typeof recovery === 'string' && recovery.includes('hour') && recovery !== 'over_24') {
        return 'recommended-skip'; // Fast recovery = backup may not be critical
      }
    }
  }

  // ============================================================
  // COMMUNICATIONS INFRASTRUCTURE (CO-*)
  // ============================================================

  if (infraId === 'comms') {
    // If no primary communications dependency: most questions become N/A
    if (
      assessmentState['CO-1_primary_comms_type'] !== undefined &&
      assessmentState['CO-1_primary_comms_type'] === 'NONE'
    ) {
      return 'not-applicable';
    }

    // If fiber is underground: vehicle-impact questions (CO-2) become N/A
    if (assessmentState['CO-6_cable_type'] === 'underground' && questionId === 'CO-2_vehicle_impact') {
      return 'not-applicable';
    }

    // If satellite is primary: buried fiber questions (CO-4) become N/A
    if (assessmentState['CO-1_primary_comms_type'] === 'satellite' && questionId === 'CO-4_buried_infrastructure') {
      return 'not-applicable';
    }
  }

  // ============================================================
  // IT INFRASTRUCTURE (IT-*)
  // ============================================================

  if (infraId === 'it') {
    // If services are self-hosted/internal: cloud dependency (IT-2) becomes N/A
    if (assessmentState['IT-1_it_services_type'] === 'on-premises' && questionId === 'IT-2_cloud_providers') {
      return 'not-applicable';
    }

    // If all services are cloud: IT-1 follow-ups about on-prem backup (IT-3) become N/A
    if (assessmentState['IT-1_it_services_type'] === 'cloud-only' && questionId === 'IT-3_on_premises_backup') {
      return 'not-applicable';
    }

    // If API keys are not stored locally: IT-5 (credential exposure) becomes N/A
    if (
      assessmentState['IT-4_credential_storage'] === 'HSM' ||
      assessmentState['IT-4_credential_storage'] === 'managed-service'
    ) {
      if (questionId === 'IT-5_credential_exposure') {
        return 'recommended-skip';
      }
    }
  }

  // ============================================================
  // WATER INFRASTRUCTURE (W_Q*)
  // ============================================================

  if (infraId === 'water') {
    // If water is fully self-supplied: W_Q4 (interconnect risk) becomes N/A
    if (assessmentState['W_Q1_primary_source'] === 'groundwater' && questionId === 'W_Q4_interconnect_risk') {
      return 'not-applicable';
    }

    // If desalination is primary: pipeline (W_Q6) becomes N/A
    if (assessmentState['W_Q2_desalination_available'] === 'YES' && questionId === 'W_Q6_pipeline_criticality') {
      return 'recommended-skip';
    }

    // If no treatment capability: chemical safety questions (W_Q9) become N/A
    if (assessmentState['W_Q7_treatment_availability'] === 'NO' && questionId === 'W_Q9_chemical_safety') {
      return 'not-applicable';
    }
  }

  // ============================================================
  // WASTEWATER INFRASTRUCTURE (WW_Q*)
  // ============================================================

  if (infraId === 'wastewater') {
    // If no holding capacity: WW_Q13 becomes N/A (should not happen, but guard it)
    if (assessmentState['WW_Q1_primary_treatment'] === 'none' && questionId === 'WW_Q13_holding_capacity') {
      return 'not-applicable';
    }

    // If bypass is not available: WW_Q4 follow-ups become N/A
    if (assessmentState['WW_Q4_bypass_available'] === 'NO' && questionId === 'WW_Q5_bypass_location') {
      return 'not-applicable';
    }

    // If influent is directly to environment: WW_Q6 (treatment bypass) becomes N/A
    if (assessmentState['WW_Q1_primary_treatment'] === 'none' && questionId === 'WW_Q6_treatment_bypass') {
      return 'not-applicable';
    }
  }

  // Default: applicable
  return 'applicable';
}

/**
 * Determine if a question should be visually shown (even if N/A).
 * Some N/A questions should still render with a disabled state, while others should be hidden.
 */
export function shouldShow(applicability: ApplicabilityResult): boolean {
  // 'recommended-skip' means question should be shown but marked as skippable
  // 'not-applicable' typically means hide the question
  return applicability !== 'not-applicable';
}

/**
 * Helper: Check if a question is mandatory or optional based on infrastructure and context.
 */
export function isQuestionMandatory(
  infraId: string,
  questionId: string,
  assessmentState: AssessmentState | undefined
): boolean {
  const applicability = computeApplicability(infraId, questionId, assessmentState);

  // N/A questions are not mandatory
  if (applicability === 'not-applicable') {
    return false;
  }

  // 'recommended-skip' questions are optional
  if (applicability === 'recommended-skip') {
    return false;
  }

  // Curve questions (especially gates) are always mandatory
  if (questionId.startsWith('curve_')) {
    return true;
  }

  // Main questions are mandatory by default
  return true;
}
