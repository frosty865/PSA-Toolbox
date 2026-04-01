/**
 * Trigger Density Diagnostics (Re-export)
 * 
 * Routed through report/vulnerability module to keep a single implementation.
 */

export {
  computeTriggerDensitySummary,
  formatTriggerDensitySummary,
  WARN_TOTAL_TRIGGERED,
  FAIL_TOTAL_TRIGGERED,
  WARN_INFRA_TRIGGERED,
  FAIL_INFRA_TRIGGERED,
  WARN_CATEGORY_TRIGGERED,
  FAIL_CATEGORY_TRIGGERED,
  MIN_DRIVERS,
  MAX_DRIVERS,
  type TriggerDensitySummary,
} from '../report/vulnerability/trigger_density_diagnostics';
