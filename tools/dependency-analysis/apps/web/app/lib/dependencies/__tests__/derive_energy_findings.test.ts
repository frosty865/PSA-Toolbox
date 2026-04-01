/**
 * Tests for deterministic energy derivation (theme-based).
 */
import { describe, it, expect } from 'vitest';
import {
  EnergyAnswersSchema,
  getDefaultEnergyAnswers,
  type EnergyAnswers,
} from '../infrastructure/energy_spec';
import { deriveEnergyFindings } from '../derive_energy_findings';

/** Build answers from defaults + overrides; satisfies EnergyAnswers for type-safe fixtures. */
function buildEnergyAnswers(overrides: Partial<EnergyAnswers> = {}): EnergyAnswers {
  return { ...getDefaultEnergyAnswers(), ...overrides } as EnergyAnswers;
}

describe('derive_energy_findings', () => {
  it('E-3/E-4/E-5 No triggers ENERGY_FEED_DIVERSITY', () => {
    const answers = buildEnergyAnswers({ 'E-3_more_than_one_connection': 'no' });
    const { vulnerabilities, ofcs } = deriveEnergyFindings(answers);
    const v = vulnerabilities.find((x) => x.id === 'ENERGY_FEED_DIVERSITY');
    expect(v).toBeDefined();
    const ofc = ofcs.find((o) => o.vulnerability_id === v?.id);
    expect(ofc).toBeDefined();
    expect(ofc?.text).not.toMatch(/install/i);
  });

  it('E-8 YES with generator supporting only life_safety triggers ENERGY_BACKUP_ABSENT', () => {
    const answers = buildEnergyAnswers({
      'E-8_backup_power_available': 'yes',
      'E-8_backup_assets': [
        {
          asset_type: 'generator',
          supported_load_classification: ['life_safety'],
          capacity_kw_or_description: '100 kW',
          fuel_type: 'diesel',
          estimated_runtime: '24 hours',
        },
      ],
    });
    const { vulnerabilities } = deriveEnergyFindings(answers);
    const v = vulnerabilities.find((x) => x.id === 'ENERGY_BACKUP_ABSENT');
    expect(v).toBeDefined();
  });

  it('E-8 YES with critical_core_services does NOT trigger ENERGY_BACKUP_ABSENT', () => {
    const answers = buildEnergyAnswers({
      'E-8_backup_power_available': 'yes',
      'E-8_backup_assets': [
        {
          asset_type: 'generator',
          supported_load_classification: ['life_safety', 'critical_core_services'],
          capacity_kw_or_description: '200 kW',
          fuel_type: 'diesel',
          estimated_runtime: '48 hours',
        },
      ],
    });
    const { vulnerabilities } = deriveEnergyFindings(answers);
    const v = vulnerabilities.find((x) => x.id === 'ENERGY_BACKUP_ABSENT');
    expect(v).toBeUndefined();
  });

  it('E-9/E-10 No triggers ENERGY_BACKUP_SUSTAIN_TEST', () => {
    const answers = buildEnergyAnswers({
      'E-8_backup_power_available': 'yes',
      'E-8_backup_assets': [
        {
          asset_type: 'generator',
          supported_load_classification: ['critical_core_services'],
          capacity_kw_or_description: '200 kW',
          fuel_type: 'diesel',
          estimated_runtime: '48 hours',
        },
      ],
      'E-9_refuel_sustainment_established': 'no',
    });
    const { vulnerabilities } = deriveEnergyFindings(answers);
    const v = vulnerabilities.find((x) => x.id === 'ENERGY_BACKUP_SUSTAIN_TEST');
    expect(v).toBeDefined();
  });

  it('E-4 N/A does not contribute to ENERGY_FEED_DIVERSITY (E-3 yes, E-4 na)', () => {
    const answers = buildEnergyAnswers({
      'E-3_more_than_one_connection': 'yes',
      'E-3_service_connection_count': 2,
      'E-4_physically_separated': 'na',
      'E-5_single_supports_core_ops': 'yes',
    });
    const { vulnerabilities } = deriveEnergyFindings(answers);
    const v = vulnerabilities.find((x) => x.id === 'ENERGY_FEED_DIVERSITY');
    expect(v).toBeUndefined();
  });

  it('E-4 No triggers ENERGY_FEED_DIVERSITY', () => {
    const answers = buildEnergyAnswers({
      'E-3_more_than_one_connection': 'yes',
      'E-3_service_connection_count': 2,
      'E-4_physically_separated': 'no',
    });
    const { vulnerabilities } = deriveEnergyFindings(answers);
    const v = vulnerabilities.find((x) => x.id === 'ENERGY_FEED_DIVERSITY');
    expect(v).toBeDefined();
  });

  it('Service connection count mismatch fails validation', () => {
    const answers = buildEnergyAnswers({
      'E-3_more_than_one_connection': 'yes',
      'E-3_service_connection_count': 3,
      'E-4_physically_separated': 'yes',
      'E-4_service_connections': [
        { connection_label: 'A', facility_entry_location: 'North', shared_corridor_with_other_utilities: 'no' },
        { connection_label: 'B', facility_entry_location: 'South', shared_corridor_with_other_utilities: 'no' },
      ],
    });
    const result = EnergyAnswersSchema.safeParse(answers);
    expect(result.success).toBe(false);
  });

  it('YES with missing required entries fails validation (E-8)', () => {
    const answers = buildEnergyAnswers({
      'E-8_backup_power_available': 'yes',
      'E-8_backup_assets': [],
    });
    const result = EnergyAnswersSchema.safeParse(answers);
    expect(result.success).toBe(false);
  });

  it('Derivation produces themed findings; each has one OFC', () => {
    const answers = buildEnergyAnswers({ 'E-3_more_than_one_connection': 'no' });
    const { vulnerabilities, ofcs } = deriveEnergyFindings(answers);
    expect(vulnerabilities.length).toBeGreaterThan(0);
    expect(ofcs.length).toBe(vulnerabilities.length);
    for (const v of vulnerabilities) {
      const ofc = ofcs.find((o) => o.vulnerability_id === v.id);
      expect(ofc).toBeDefined();
      expect(ofc?.text.length).toBeGreaterThan(0);
      expect(ofc?.text).not.toMatch(/install/i);
    }
  });

  it('Report blocks include substation table when E-2 YES with entries', () => {
    const answers = buildEnergyAnswers({
      'E-2_can_identify_substations': 'yes',
      'E-2_substations': [
        {
          substation_name_or_id: 'Sub A',
          location: '38.9072, -77.0369',
          utility_provider: 'Utility Co',
          designation: 'primary',
        },
      ],
    });
    const { reportBlocks } = deriveEnergyFindings(answers);
    const table = reportBlocks.find((b) => b.type === 'table' && b.title === 'Substations');
    expect(table).toBeDefined();
    expect(table?.type === 'table' && table.rows.length).toBe(1);
  });
});
