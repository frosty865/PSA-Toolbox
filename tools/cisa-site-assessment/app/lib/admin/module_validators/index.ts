/**
 * Module Validators Index
 * 
 * Exports all mandatory validators for module imports.
 */

export { validateDisciplineOwnership, type DisciplineOwnershipValidationResult } from "./discipline_ownership_validator";
export { validateRiskDrivers, type RiskDriverValidationResult, type RiskDriver } from "./risk_driver_validator";
export { validateEventTriggers, type EventTriggerValidationResult } from "./event_trigger_validator";
