/**
 * Module Workflow Feature Flags
 *
 * Centralized control for module creation pathways.
 * Creation is forced to: (1) New Module Wizard, or (2) Import from JSON.
 * No inline "create metadata only" modal.
 */

export const MODULE_WIZARD_ENABLED = true;
export const MODULE_DRAFTS_ENABLED = false; // Default off - drafts deprecated in favor of wizard
export const MODULE_LEGACY_BUILDER_ENABLED = false; // Default off - legacy builder deprecated
export const MODULE_JSON_IMPORT_ENABLED = true;

/** Force creation only via wizard or JSON import (no ad-hoc create modal). */
export const MODULE_CREATE_WIZARD_OR_JSON_ONLY = true;

/**
 * Check if wizard is the primary (and only UI) creation method alongside JSON import.
 */
export function isWizardPrimary(): boolean {
  return MODULE_WIZARD_ENABLED && !MODULE_LEGACY_BUILDER_ENABLED;
}

/**
 * If true, do not show the inline "Create Module" modal; only Wizard and Import.
 */
export function isCreateWizardOrJsonOnly(): boolean {
  return MODULE_CREATE_WIZARD_OR_JSON_ONLY;
}

/**
 * Check if drafts should be shown
 */
export function shouldShowDrafts(): boolean {
  return MODULE_DRAFTS_ENABLED;
}

/**
 * Check if legacy builder should be accessible
 */
export function shouldShowLegacyBuilder(): boolean {
  return MODULE_LEGACY_BUILDER_ENABLED;
}

/**
 * Check if JSON import should be shown
 */
export function shouldShowJsonImport(): boolean {
  return MODULE_JSON_IMPORT_ENABLED;
}
