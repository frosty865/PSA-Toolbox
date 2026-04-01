/**
 * Seed fixture: ENERGY demo facility dataset for manual testing.
 * Run with: npx tsx apps/web/scripts/seed_energy_demo.ts (or ts-node)
 * Expected: collocated utilities V (one connection shared corridor yes), no full facility load,
 * vehicle-impact depends on E-7.
 */
import type { EnergyAnswers } from '../app/lib/dependencies/infrastructure/energy_spec';
import { getDefaultEnergyAnswers, EnergyAnswersSchema } from '../app/lib/dependencies/infrastructure/energy_spec';
import { deriveEnergyFindings } from '../app/lib/dependencies/derive_energy_findings';

const seed: EnergyAnswers = {
  ...getDefaultEnergyAnswers(),
  'E-2_can_identify_substations': 'yes',
  'E-2_substations': [
    { substation_name_or_id: 'Sub 1', location: '38.9072, -77.0369', utility_provider: 'Primary Electric Co', designation: 'primary' },
    { substation_name_or_id: 'Sub 2', location: '38.9080, -77.0370', utility_provider: 'Primary Electric Co', designation: 'secondary' },
    { substation_name_or_id: 'Sub 3', location: '38.9100, -77.0400', utility_provider: 'Secondary Electric Co', designation: 'unknown' },
  ],
  'E-3_more_than_one_connection': 'yes',
  'E-3_service_connection_count': 2,
  'E-4_physically_separated': 'yes',
  'E-4_service_connections': [
    {
      connection_label: 'Connection A',
      facility_entry_location: '38.9072, -77.0369',
      associated_substation: 'Sub 1',
      shared_corridor_with_other_utilities: 'no',
    },
    {
      connection_label: 'Connection B',
      facility_entry_location: '38.9070, -77.0370',
      associated_substation: 'Sub 2',
      shared_corridor_with_other_utilities: 'yes',
    },
  ],
  'E-5_single_supports_core_ops': 'yes',
  'E-5_core_ops_capable': {
    capable_connection_labels: ['Connection A'],
  },
  'E-6_exterior_protected': 'yes',
  'E-6_exterior_protections': [
    { component_type: 'Meter Bank / Meter Stack', location: '38.9072, -77.0369', protection_type: 'Bollards' },
  ],
  'E-7_vehicle_impact_exposure': 'no',
  'E-7a_vehicle_impact_protection': 'unknown',
  'E-8_backup_power_available': 'yes',
  'E-8_backup_assets': [
    {
      asset_type: 'generator',
      supported_load_classification: ['critical_core_services'],
      capacity_kw_or_description: '500 kW',
      fuel_type: 'diesel',
      estimated_runtime: '24 hours',
    },
    {
      asset_type: 'ups',
      supported_load_classification: ['life_safety'],
      capacity_kw_or_description: '50 kVA',
      estimated_runtime: '2 hours',
    },
  ],
  'E-9_refuel_sustainment_established': 'yes',
  'E-9_sustainment': {
    fuel_source: 'external',
    suppliers: [
      { supplier_name: 'Fuel Co Inc', estimated_resupply_timeframe: '24–48 hours', contracted_sla: '4-hour delivery' },
    ],
  },
  'E-10_tested_under_load': 'yes',
  'E-10_testing': {
    test_frequency: 'quarterly',
    load_condition: 'partial',
    last_test_date: 'unknown',
  },
  'E-11_provider_restoration_coordination': 'yes',
};

function main() {
  const parsed = EnergyAnswersSchema.safeParse(seed);
  if (!parsed.success) {
    console.error('Seed validation failed:', parsed.error.issues);
    process.exit(1);
  }
  const derived = deriveEnergyFindings(parsed.data);
  console.log('Seed fixture valid. Derived findings:');
  console.log('Vulnerabilities:', derived.vulnerabilities.length);
  derived.vulnerabilities.forEach((v) => console.log(' -', v.text));
  console.log('Report blocks:', derived.reportBlocks.length);
  const collocated = derived.vulnerabilities.find((v) => v.text.includes('Collocated with other utilities'));
  console.log('Collocated utilities triggered:', !!collocated);
  const noAlternate = derived.vulnerabilities.find((v) => v.text.includes('No alternate power capability'));
  console.log('No alternate power triggered (should be false for this seed):', !!noAlternate);
  if (noAlternate) process.exit(1);
  console.log('Seed OK.');
}

main();
