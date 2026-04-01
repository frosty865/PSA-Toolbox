/**
 * Deterministic derivation: EnergyAnswers → vulnerabilities, OFCs, report blocks.
 * Each vulnerability maps to exactly one OFC (locked wording; no "install").
 */
import type { EnergyAnswers } from './infrastructure/energy_spec';

export type EnergyVulnerability = {
  id: string;
  text: string;
  infrastructure: 'Energy';
  /** Optional evidence for report rendering (theme-based). */
  evidence?: Array<{ question_id: string; answer?: string | boolean }>;
};

export type EnergyOfc = {
  id: string;
  text: string;
  vulnerability_id: string;
};

export type EnergyReportBlock =
  | { type: 'narrative'; title: string; text: string }
  | { type: 'list'; title: string; items: string[] }
  | { type: 'table'; title: string; headers: string[]; rows: string[][] };

export type EnergyDerivedFindings = {
  vulnerabilities: EnergyVulnerability[];
  ofcs: EnergyOfc[];
  reportBlocks: EnergyReportBlock[];
  themedFindings?: import('./vulnerabilities/themeTypes').ThemedFinding[];
  knowledgeGaps?: import('./knowledge_gaps/gapTypes').KnowledgeGap[];
};

/** Theme IDs for parity/display. */
export const ENERGY_VULNERABILITY_TEXTS: Record<string, string> = {
  ENERGY_FEED_DIVERSITY: 'Electric service feed diversity may be limited',
  ENERGY_BACKUP_ABSENT: 'Backup power capability may be absent or insufficient',
  ENERGY_BACKUP_SUSTAIN_TEST: 'Backup power sustainment or testing may be uncertain',
};

/** Static OFC list for parity validator (id, text, vulnerability_id). */
export function getEnergyOfcList(): { id: string; text: string; vulnerability_id: string }[] {
  return [
    { id: 'OFC-ENERGY_FEED_DIVERSITY', text: 'Evaluate the feasibility of establishing additional electric service connections with geographic separation, or ensuring one connection can support critical operations.', vulnerability_id: 'ENERGY_FEED_DIVERSITY' },
    { id: 'OFC-ENERGY_BACKUP_ABSENT', text: 'Evaluate the need for backup or alternate power capability to support critical operations during extended electric service outages.', vulnerability_id: 'ENERGY_BACKUP_ABSENT' },
    { id: 'OFC-ENERGY_BACKUP_SUSTAIN_TEST', text: 'Establish refueling/sustainment planning for backup power and maintain a routine testing schedule to verify backup systems function as intended under load.', vulnerability_id: 'ENERGY_BACKUP_SUSTAIN_TEST' },
  ];
}

import { resolveThemedFindings } from './vulnerabilities/resolveThemes';
import { themedFindingsToDerived } from './vulnerabilities/themedToDerived';
import { resolveKnowledgeGaps } from './knowledge_gaps/resolveGaps';

/** Derive vulnerabilities and OFCs from energy answers (theme-based). */
export function deriveEnergyFindings(answers: EnergyAnswers): EnergyDerivedFindings {
  const reportBlocks: EnergyReportBlock[] = [];

  // Theme-based findings (2–3 per dependency)
  const themedFindings = resolveThemedFindings({ category: 'ENERGY', answers });
  const { vulnerabilities, ofcs } = themedFindingsToDerived(themedFindings, 'Energy') as {
    vulnerabilities: EnergyVulnerability[];
    ofcs: EnergyOfc[];
  };

  // ─── Report blocks (YES data) ───────────────────────────────────────────

  if (answers['E-2_can_identify_substations'] === 'yes' && answers['E-2_substations'].length > 0) {
    reportBlocks.push({
      type: 'table',
      title: 'Substations',
      headers: ['Substation / ID', 'Location (if known)', 'Utility provider', 'Designation'],
      rows: answers['E-2_substations'].map((s) => [
        s.substation_name_or_id,
        s.location ?? '—',
        s.utility_provider,
        s.designation,
      ]),
    });
  }

  if (answers['E-3_more_than_one_connection'] === 'yes' && answers['E-3_service_connection_count'] != null) {
    reportBlocks.push({
      type: 'narrative',
      title: 'Service connections',
      text: `The facility has ${answers['E-3_service_connection_count']} electric service connection(s).`,
    });
  }

  if (answers['E-4_physically_separated'] === 'yes' && (answers['E-4_service_connections']?.length ?? 0) > 0) {
    reportBlocks.push({
      type: 'table',
      title: 'Service connections',
      headers: ['Connection', 'Facility entry (Lat/Long)', 'Associated substation', 'Shared corridor with other utilities'],
      rows: answers['E-4_service_connections'].map((c) => [
        c.connection_label,
        c.facility_entry_location,
        c.associated_substation ?? '—',
        c.shared_corridor_with_other_utilities,
      ]),
    });
  }

  if (answers['E-5_single_supports_core_ops'] === 'yes' && answers['E-5_core_ops_capable']) {
    const cap = answers['E-5_core_ops_capable'];
    reportBlocks.push({
      type: 'narrative',
      title: 'Core operations survivability',
      text: `At least one service connection supports core operations independently: ${cap.capable_connection_labels.join(', ')}.`,
    });
  }

  if (answers['E-6_exterior_protected'] === 'yes' && answers['E-6_exterior_protections'].length > 0) {
    reportBlocks.push({
      type: 'table',
      title: 'Exterior electrical component protection',
      headers: ['Component type', 'Lat/Long', 'Protection type'],
      rows: answers['E-6_exterior_protections'].map((p) => [p.component_type, p.location, p.protection_type]),
    });
  }

  if (answers['E-8_backup_power_available'] === 'yes' && answers['E-8_backup_assets'].length > 0) {
    const loadLabels: Record<string, string> = {
      life_safety: 'Life Safety Systems',
      critical_core_services: 'Critical/Core Services',
      full_facility_load: 'Full Facility Load',
    };
    const curveHours = answers.curve_backup_duration_hours;
    reportBlocks.push({
      type: 'table',
      title: 'Backup power assets',
      headers: ['Asset type', 'Supported load', 'Capacity', 'Fuel type', 'Est. runtime (from curve Q5)'],
      rows: answers['E-8_backup_assets'].map((a) => {
        const runtimeCell =
          curveHours !== null && curveHours !== undefined ? `${curveHours} hours` : '—';
        return [
          a.asset_type,
          a.supported_load_classification.map((l) => loadLabels[l] ?? l).join('; '),
          a.capacity_kw_or_description,
          a.fuel_type ?? '—',
          runtimeCell,
        ];
      }),
    });
  }

  if (answers['E-9_refuel_sustainment_established'] === 'yes' && answers['E-9_sustainment']) {
    const s = answers['E-9_sustainment'] as {
      fuel_source: string;
      suppliers?: Array<{ supplier_name: string; estimated_resupply_timeframe?: string; contracted_sla?: string }>;
      supplier_names?: string[];
      estimated_resupply_timeframe?: string;
    };
    let text = `Fuel source: ${s.fuel_source}.`;
    const suppliers = s.suppliers ?? [];
    if (suppliers.length) {
      const parts = suppliers.map((row) => {
        let p = row.supplier_name || '—';
        if (row.estimated_resupply_timeframe) p += ` (resupply: ${row.estimated_resupply_timeframe})`;
        if (row.contracted_sla) p += ` [SLA: ${row.contracted_sla}]`;
        return p;
      });
      text += ` Suppliers: ${parts.join('; ')}.`;
    } else if (s.supplier_names?.length) {
      text += ` Suppliers: ${s.supplier_names.join(', ')}.`;
      if (s.estimated_resupply_timeframe) text += ` Resupply timeframe: ${s.estimated_resupply_timeframe}.`;
    }
    reportBlocks.push({ type: 'narrative', title: 'Backup power sustainment', text });
  }

  if (answers['E-10_tested_under_load'] === 'yes') {
    const t = answers['E-10_testing'];
    let text: string;
    if (t?.test_frequency && t?.last_test_date) {
      const freqLabels: Record<string, string> = {
        monthly: 'monthly',
        quarterly: 'quarterly',
        semi_annual: 'every six months',
        annual: 'annually',
        other: 'on a set schedule',
        unknown: 'on a regular schedule',
      };
      const freq = freqLabels[t.test_frequency] ?? t.test_frequency.replace(/_/g, '-');
      const load = (t.load_condition ?? 'unknown') === 'full' ? 'full load' : (t.load_condition === 'partial' ? 'partial load' : 'operational load');
      const lastTest = t.last_test_date.toLowerCase() === 'unknown' ? 'Last test date not recorded.' : `Last test: ${t.last_test_date}.`;
      text = `Backup power is tested ${freq} under ${load}. ${lastTest}`;
    } else {
      text = 'Backup power is routinely tested under operational load.';
    }
    reportBlocks.push({ type: 'narrative', title: 'Backup power testing', text });
  }

  const knowledgeGaps = resolveKnowledgeGaps({ category: 'ENERGY', answers });

  return { vulnerabilities, ofcs, reportBlocks, themedFindings, knowledgeGaps };
}
