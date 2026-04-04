/**
 * Vulnerability Catalog Registry
 * 
 * Single source of truth for all vulnerability catalogs.
 */

import type { VulnerabilityConfig, InfraId } from '../report/vulnerability/vulnerability_types';

import { CATALOG_ELECTRIC_POWER } from './catalog_energy';
import { COMMUNICATIONS_VULNERABILITIES } from './catalog_communications';
import { CATALOG_INFORMATION_TECHNOLOGY } from './catalog_it';
import { WATER_VULNERABILITIES } from './catalog_water';
import { WASTEWATER_VULNERABILITIES } from './catalog_wastewater';
import { CROSS_DEPENDENCY_VULNERABILITIES } from './catalog_cross_dependency';

export const VULN_CATALOGS: Record<InfraId, VulnerabilityConfig[]> = {
  ELECTRIC_POWER: CATALOG_ELECTRIC_POWER,
  COMMUNICATIONS: COMMUNICATIONS_VULNERABILITIES,
  INFORMATION_TECHNOLOGY: CATALOG_INFORMATION_TECHNOLOGY,
  WATER: WATER_VULNERABILITIES,
  WASTEWATER: WASTEWATER_VULNERABILITIES,
  NATURAL_GAS: [],
  CROSS_DEPENDENCY: CROSS_DEPENDENCY_VULNERABILITIES,
};

export const ALL_VULNERABILITIES: VulnerabilityConfig[] = Object.values(VULN_CATALOGS).flat();
