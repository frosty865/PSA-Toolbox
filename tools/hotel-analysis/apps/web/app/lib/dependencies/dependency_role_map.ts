/**
 * Explicit, testable role map: "Electricity-level detail" as doctrine.
 * Other dependencies must implement the same roles (not the same wording).
 * Values are question_ids that satisfy the role (some roles may be satisfied by multiple qids).
 */

export type DependencyKey =
  | 'energy'
  | 'communications'
  | 'information_technology'
  | 'water'
  | 'wastewater';

export type RoleKey =
  | 'dependency_gate'
  | 'time_to_impact_hours'
  | 'percent_functional_loss'
  | 'time_to_recovery_hours'
  | 'provider_identified'
  | 'upstream_assets_enumerated'
  | 'redundancy_present'
  | 'redundancy_geographically_separated'
  | 'single_point_of_failure_entry'
  | 'collocated_utility_corridor'
  | 'components_protected_from_tampering'
  | 'components_protected_from_vehicle_impact'
  | 'has_backup'
  | 'backup_scope'
  | 'backup_runtime_hours'
  | 'refueling_or_resupply_plan'
  | 'priority_restoration_plan'
  | 'contingency_plan_with_provider';

export type RoleMapping = Record<RoleKey, string[]>;

export const CANONICAL_DEPENDENCY: DependencyKey = 'energy';

/** All role keys that must be satisfied (used for coverage check). */
export const ALL_ROLE_KEYS: RoleKey[] = [
  'dependency_gate',
  'time_to_impact_hours',
  'percent_functional_loss',
  'time_to_recovery_hours',
  'provider_identified',
  'upstream_assets_enumerated',
  'redundancy_present',
  'redundancy_geographically_separated',
  'single_point_of_failure_entry',
  'collocated_utility_corridor',
  'components_protected_from_tampering',
  'components_protected_from_vehicle_impact',
  'has_backup',
  'backup_scope',
  'backup_runtime_hours',
  'refueling_or_resupply_plan',
  'priority_restoration_plan',
  'contingency_plan_with_provider',
];

/**
 * Role → question_ids per dependency.
 * Energy uses real IDs from infrastructure/energy_spec (curve_*, E-2..E-11).
 * Other dependencies use target question IDs to be implemented in their specs.
 */
export const DEPENDENCY_ROLE_MAP: Record<DependencyKey, RoleMapping> = {
  energy: {
    dependency_gate: ['curve_requires_service'],
    time_to_impact_hours: ['curve_time_to_impact'],
    percent_functional_loss: ['curve_loss_no_backup'],
    time_to_recovery_hours: ['curve_recovery_time'],

    provider_identified: ['curve_primary_provider'],
    upstream_assets_enumerated: ['E-2'],

    redundancy_present: ['E-3'],
    redundancy_geographically_separated: ['E-4'],

    single_point_of_failure_entry: ['E-3'],
    collocated_utility_corridor: ['E-4'],

    components_protected_from_tampering: ['E-6'],
    components_protected_from_vehicle_impact: ['E-7'],

    has_backup: ['E-8'],
    backup_scope: ['E-8'],
    backup_runtime_hours: ['curve_backup_duration', 'E-8'],

    refueling_or_resupply_plan: ['E-9'],

    priority_restoration_plan: ['E-11'],
    contingency_plan_with_provider: ['E-11'],
  },

  communications: {
    dependency_gate: ['curve_requires_service'],
    time_to_impact_hours: ['curve_time_to_impact_hours'],
    percent_functional_loss: ['curve_loss_fraction_no_backup'],
    time_to_recovery_hours: ['curve_recovery_time_hours'],

    provider_identified: ['COMM-0'],
    upstream_assets_enumerated: ['COMM-0'],

    redundancy_present: ['COMM-SP1'],
    redundancy_geographically_separated: ['COMM-SP2'],

    single_point_of_failure_entry: ['COMM-SP1'],
    collocated_utility_corridor: ['COMM-SP2'],

    components_protected_from_tampering: ['COMM-SP2'],
    components_protected_from_vehicle_impact: ['COMM-SP2'],

    has_backup: ['curve_backup_available'],
    backup_scope: ['curve_backup_available'],
    backup_runtime_hours: ['curve_backup_duration_hours'],

    refueling_or_resupply_plan: ['curve_backup_available'],

    priority_restoration_plan: ['COMM-SP3'],
    contingency_plan_with_provider: ['COMM-SP3'],
  },

  information_technology: {
    dependency_gate: ['curve_requires_service'],
    time_to_impact_hours: ['curve_time_to_impact'],
    percent_functional_loss: ['curve_loss_no_backup'],
    time_to_recovery_hours: ['curve_recovery_time'],

    provider_identified: ['IT-1'],
    upstream_assets_enumerated: ['IT-1', 'IT-2'],

    redundancy_present: ['IT-3'],
    redundancy_geographically_separated: ['IT-4'],

    single_point_of_failure_entry: ['IT-3'],
    collocated_utility_corridor: ['IT-4'],

    components_protected_from_tampering: ['IT-6'],
    components_protected_from_vehicle_impact: ['IT-7'],

    has_backup: ['curve_backup_available'],
    backup_scope: ['curve_backup_available'],
    backup_runtime_hours: ['curve_backup_available'],

    refueling_or_resupply_plan: ['curve_backup_available'], // Sustainment captured by backup/transport; IT-9 removed.

    priority_restoration_plan: ['IT-11'],
    contingency_plan_with_provider: ['IT-11'],
  },

  water: {
    dependency_gate: ['curve_requires_service'],
    time_to_impact_hours: ['curve_time_to_impact'],
    percent_functional_loss: ['curve_loss_no_backup'],
    time_to_recovery_hours: ['curve_recovery_time'],

    provider_identified: ['curve_primary_provider'],
    upstream_assets_enumerated: ['W_Q1'],

    redundancy_present: ['W_Q2'],
    redundancy_geographically_separated: ['W_Q3'],

    single_point_of_failure_entry: ['W_Q2', 'W_Q3'],
    collocated_utility_corridor: ['W_Q4'],

    components_protected_from_tampering: ['W_Q17'],
    components_protected_from_vehicle_impact: ['W_Q4'],

    has_backup: ['W_Q8'],
    backup_scope: ['W_Q8'],
    backup_runtime_hours: ['curve_backup_duration', 'W_Q8'],

    refueling_or_resupply_plan: ['W_Q9'],

    priority_restoration_plan: ['W_Q6'],
    contingency_plan_with_provider: ['W_Q7'],
  },

  wastewater: {
    dependency_gate: ['curve_requires_service'],
    time_to_impact_hours: ['curve_time_to_impact'],
    percent_functional_loss: ['curve_loss_no_backup'],
    time_to_recovery_hours: ['curve_recovery_time'],

    provider_identified: ['curve_primary_provider'],
    upstream_assets_enumerated: ['WW_Q1'],

    redundancy_present: ['WW_Q2'],
    redundancy_geographically_separated: ['WW_Q3'],

    single_point_of_failure_entry: ['WW_Q2', 'WW_Q3'],
    collocated_utility_corridor: ['WW_Q4'],

    components_protected_from_tampering: ['WW_Q11'],
    components_protected_from_vehicle_impact: ['WW_Q4'],

    has_backup: ['WW_Q8', 'WW_Q9'],
    backup_scope: ['WW_Q8'],
    backup_runtime_hours: ['curve_backup_duration', 'WW_Q8'],

    refueling_or_resupply_plan: ['WW_Q9'],

    priority_restoration_plan: ['WW_Q6'],
    contingency_plan_with_provider: ['WW_Q7'],
  },
};

export type RoleCoverage = {
  dependency: DependencyKey;
  rolesSatisfied: number;
  totalRoles: number;
  missingRoles: RoleKey[];
};

/**
 * Returns role coverage per dependency: count of roles satisfied (non-empty qid arrays)
 * and list of missing roles. Uses canonical (energy) as the reference for which roles
 * must be present; a role is "satisfied" when the mapping has at least one question_id.
 */
export function getRoleCoverage(dependency: DependencyKey): RoleCoverage {
  const mapping = DEPENDENCY_ROLE_MAP[dependency];
  const missingRoles: RoleKey[] = [];
  for (const role of ALL_ROLE_KEYS) {
    const qids = mapping[role];
    if (!qids || qids.length === 0) {
      missingRoles.push(role);
    }
  }
  return {
    dependency,
    rolesSatisfied: ALL_ROLE_KEYS.length - missingRoles.length,
    totalRoles: ALL_ROLE_KEYS.length,
    missingRoles,
  };
}

/**
 * Returns role coverage for all dependencies. Useful for validators.
 */
export function getAllRoleCoverage(): Record<DependencyKey, RoleCoverage> {
  const result = {} as Record<DependencyKey, RoleCoverage>;
  for (const key of Object.keys(DEPENDENCY_ROLE_MAP) as DependencyKey[]) {
    result[key] = getRoleCoverage(key);
  }
  return result;
}

/**
 * Asserts that every dependency has the same role coverage as the canonical (energy).
 * Fails if any dependency has a role with an empty qid array where energy has a non-empty one.
 */
export function assertParityWithCanonical(): void {
  const canonical = DEPENDENCY_ROLE_MAP[CANONICAL_DEPENDENCY];
  const errors: string[] = [];
  for (const dep of Object.keys(DEPENDENCY_ROLE_MAP) as DependencyKey[]) {
    if (dep === CANONICAL_DEPENDENCY) continue;
    const mapping = DEPENDENCY_ROLE_MAP[dep];
    for (const role of ALL_ROLE_KEYS) {
      const canonQids = canonical[role];
      const depQids = mapping[role];
      if (canonQids && canonQids.length > 0 && (!depQids || depQids.length === 0)) {
        errors.push(`${dep}: role "${role}" is empty but canonical (energy) has [${canonQids.join(', ')}]`);
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(`Dependency role parity failed:\n${errors.join('\n')}`);
  }
}
