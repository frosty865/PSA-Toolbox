/**
 * Vulnerability Catalog Exports
 */

export { VULN_CATALOGS, ALL_VULNERABILITIES } from './catalog_registry';
export { validateCatalog, validateQuestionVulnMap, FORBIDDEN_VERBS, findForbiddenVerb } from './validate_catalog';
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
} from './trigger_density_diagnostics';
export type { TriggerDensitySummary } from './trigger_density_diagnostics';

export { CATALOG_ELECTRIC_POWER } from './catalog_energy';
export { COMMUNICATIONS_VULNERABILITIES as CATALOG_COMMUNICATIONS } from './catalog_communications';
export { CATALOG_INFORMATION_TECHNOLOGY } from './catalog_it';
export { WATER_VULNERABILITIES as CATALOG_WATER } from './catalog_water';
export { WASTEWATER_VULNERABILITIES as CATALOG_WASTEWATER } from './catalog_wastewater';
export { CROSS_DEPENDENCY_VULNERABILITIES as CATALOG_CROSS_DEPENDENCY } from './catalog_cross_dependency';

export { CONSIDERATIONS_ELECTRIC_POWER } from './considerations_energy';
export { COMMUNICATIONS_CONSIDERATIONS as CONSIDERATIONS_COMMUNICATIONS } from './considerations_communications';
export { CONSIDERATIONS_IT } from './considerations_it';
export { WATER_CONSIDERATIONS as CONSIDERATIONS_WATER } from './considerations_water';
export { WASTEWATER_CONSIDERATIONS as CONSIDERATIONS_WASTEWATER } from './considerations_wastewater';
export { CROSS_DEPENDENCY_CONSIDERATIONS as CONSIDERATIONS_CROSS_DEPENDENCY } from './considerations_cross_dependency';

export type { AnalyticalConsideration } from './consideration_types';
