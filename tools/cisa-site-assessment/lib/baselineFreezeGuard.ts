/**
 * Baseline Freeze Guard
 * 
 * Prevents modification of frozen baseline questions.
 * Baseline Questions v1 is frozen and cannot be edited, deleted, overwritten, or regenerated.
 */

export interface BaselineMetadata {
  baseline_version?: string;
  status?: string;
  scope?: string;
  change_policy?: string;
  frozen_at?: string;
}

export interface BaselineData {
  metadata?: BaselineMetadata;
  required_elements?: any[];
  required_element_set?: {
    elements?: any[];
    metadata?: BaselineMetadata;
  };
}

/**
 * Check if baseline questions are frozen
 */
export function isBaselineFrozen(data: BaselineData): boolean {
  const metadata = data.metadata || data.required_element_set?.metadata;
  
  if (!metadata) {
    return false; // No metadata means not explicitly frozen
  }
  
  return (
    metadata.baseline_version === "Baseline_Questions_v1" &&
    metadata.status === "frozen"
  );
}

/**
 * Guard function that throws an error if attempting to modify frozen baseline questions
 * 
 * @param baselineVersion - The baseline version identifier
 * @param status - The status of the baseline (should be "frozen" for v1)
 * @throws Error if attempting to modify frozen baseline
 */
export function guardBaselineFreeze(
  baselineVersion: string | undefined,
  status: string | undefined
): void {
  if (baselineVersion === "Baseline_Questions_v1" && status === "frozen") {
    throw new Error(
      "Baseline Questions v1 is frozen. Create a new version to modify."
    );
  }
}

/**
 * Validate that baseline data is not frozen before allowing write operations
 * 
 * @param data - The baseline data structure
 * @throws Error if baseline is frozen
 */
export function validateBaselineNotFrozen(data: BaselineData): void {
  if (isBaselineFrozen(data)) {
    const metadata = data.metadata || data.required_element_set?.metadata;
    guardBaselineFreeze(metadata?.baseline_version, metadata?.status);
  }
}

/**
 * Check if an element is a baseline question
 */
export function isBaselineElement(element: any): boolean {
  return element?.layer === "baseline" || 
         element?.element_code?.startsWith("BASE-") ||
         (element?.sector_id === null && element?.subsector_id === null);
}

