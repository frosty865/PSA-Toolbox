/**
 * Generate a rich showcase progress file for demos and docs.
 * Run from apps/web: pnpm fixture:showcase
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Assessment } from 'schema';
import { DEFAULT_PRIORITY_RESTORATION } from '../../app/lib/asset-dependency/priorityRestorationSchema';
import { sanitizeAssessmentBeforeSave } from '../../app/lib/assessment/sanitize_assessment';
import { buildReportThemedFindingsForExport, buildSessionsDerivedFromAssessment } from '../../app/lib/export/build_report_themed_findings';
import { buildProgressFileV2 } from '../../app/lib/io/progressFile';
import { getDefaultAssessment } from '../../lib/default-assessment';

const NOW = '2026-04-22T12:00:00.000Z';

function source(
  sourceId: string,
  providerName: string,
  sourceLabel: string,
  independence: 'UNKNOWN' | 'SAME_DEMARCATION' | 'DIFFERENT_DEMARCATION_SAME_UPSTREAM' | 'DIFFERENT_LOOP_OR_PATH',
  demarcationDescription: string,
  notes: string,
  lat?: number,
  lon?: number
) {
  return {
    source_id: sourceId,
    provider_name: providerName,
    source_label: sourceLabel,
    demarcation_lat: lat ?? null,
    demarcation_lon: lon ?? null,
    demarcation_description: demarcationDescription,
    independence,
    notes,
  };
}

function slaTopic(topic: typeof DEFAULT_PRIORITY_RESTORATION.energy, overrides: Partial<typeof DEFAULT_PRIORITY_RESTORATION.energy>) {
  return {
    ...topic,
    ...overrides,
  };
}

function session(answers: Record<string, unknown>, derived: Record<string, unknown>) {
  return {
    answers,
    derived: {
      ...derived,
      reportBlocks: [],
    },
    saved_at_iso: NOW,
  };
}

function buildShowcaseAssessment(): Assessment {
  const assessment = getDefaultAssessment();
  assessment.meta = {
    tool_version: '0.1.0',
    template_version: '1',
    created_at_iso: NOW,
  };
  assessment.asset = {
    asset_name: 'Harbor View Community Center',
    visit_date_iso: '2026-04-22',
    sector: 'Commercial Facilities',
    subsector: 'Community Center',
    mailing_address_line1: '100 Sample Ave',
    mailing_address_line2: 'Suite 200',
    mailing_address_line3: '',
    mailing_city: 'Harbor City',
    mailing_state: 'FL',
    mailing_zip: '33301',
    mailing_country: 'United States',
    physical_address: '100 Sample Ave, Suite 200\nHarbor City, FL 33301\nUnited States',
    location: '26.1234, -80.1234',
    facility_latitude: '26.1234',
    facility_longitude: '-80.1234',
    assessor: 'Sample Analyst',
    psa_name: 'Sample PSA',
    psa_region: 'South Florida',
    psa_city: 'Fort Lauderdale',
    psa_phone: '(555) 010-2000',
    psa_cell: '(555) 010-2001',
    psa_email: 'sample@example.com',
    services_provided: ['community programs', 'meeting space', 'after-hours shelter'],
  };

  assessment.settings = {
    pra_sla_enabled: true,
    cross_dependency_enabled: true,
  };

  assessment.priority_restoration = {
    energy: slaTopic(DEFAULT_PRIORITY_RESTORATION.energy, {
      federal_standard: true,
      pra_category: 'TIER_2',
      paid_sla: true,
      sla_assessed: true,
      sla_mttr_max_hours: 4,
      sla_mttr_max_source: 'contract',
      sla_mttr_max_notes: 'Utility response commitment and contracted generator service.',
      notes: 'Priority restoration verified with the utility and facilities contractor.',
      sla_failure_flags: {
        regional_applicability: 'yes',
        clock_defined: 'yes',
        activation_required_documented: 'yes',
        escalation_defined: 'yes',
        full_component_coverage: 'yes',
        restoration_validation_defined: 'yes',
        tolerance_reviewed: 'yes',
        documentation_accessible: 'yes',
      },
    }),
    communications: slaTopic(DEFAULT_PRIORITY_RESTORATION.communications, {
      federal_standard: false,
      paid_sla: true,
      sla_assessed: true,
      sla_mttr_max_hours: 8,
      sla_mttr_max_source: 'service_order',
      notes: 'Carrier SLA documented in the service order.',
    }),
    information_technology: slaTopic(DEFAULT_PRIORITY_RESTORATION.information_technology, {
      federal_standard: false,
      paid_sla: true,
      sla_assessed: true,
      sla_mttr_max_hours: 6,
      sla_mttr_max_source: 'contract',
      notes: 'Primary hosted applications have a documented recovery commitment.',
    }),
    water: slaTopic(DEFAULT_PRIORITY_RESTORATION.water, {
      federal_standard: true,
      pra_category: 'TIER_3',
      paid_sla: false,
      sla_assessed: true,
      notes: 'Municipal restoration priority is understood but no separate SLA is documented.',
    }),
    wastewater: slaTopic(DEFAULT_PRIORITY_RESTORATION.wastewater, {
      federal_standard: false,
      paid_sla: false,
      sla_assessed: true,
      notes: 'No formal restoration agreement was identified for wastewater service.',
    }),
  };

  assessment.cross_dependencies = {
    edges: [
      {
        from_category: 'ELECTRIC_POWER',
        to_category: 'INFORMATION_TECHNOLOGY',
        purpose: 'primary_operations',
        criticality: 'critical',
        time_to_cascade_bucket: 'short',
        single_path: 'yes',
        confidence: 'documented',
        notes: 'Network and endpoint systems rely on facility power.',
        source: 'user',
      },
      {
        from_category: 'COMMUNICATIONS',
        to_category: 'WATER',
        purpose: 'monitoring_control',
        criticality: 'important',
        time_to_cascade_bucket: 'medium',
        single_path: 'unknown',
        confidence: 'assumed',
        notes: 'Remote monitoring and dispatch depend on carrier continuity.',
        source: 'auto_suggest',
      },
    ],
    derived: {
      common_mode_spof: [
        {
          upstream_category: 'COMMUNICATIONS',
          affected_categories: ['INFORMATION_TECHNOLOGY', 'WATER'],
          rationale: 'Shared upstream carrier and shared network equipment create a common-mode dependency.',
        },
      ],
      circular_dependencies: [
        {
          path: ['ELECTRIC_POWER', 'COMMUNICATIONS', 'INFORMATION_TECHNOLOGY', 'ELECTRIC_POWER'],
        },
      ],
    },
    last_auto_suggest_hash: 'showcase-demo',
    rejected_keys: ['CRITICAL_PRODUCTS'],
  };

  const categories = assessment.categories as Record<string, Record<string, unknown>>;

  categories.ELECTRIC_POWER = {
    ...categories.ELECTRIC_POWER,
    requires_service: true,
    time_to_impact_hours: 0,
    loss_fraction_no_backup: 0.92,
    has_backup_any: true,
    has_backup: true,
    has_backup_generator: true,
    backup_duration_hours: 48,
    loss_fraction_with_backup: 0.08,
    backup_capacity_pct: 92,
    backup_type: 'TEMPORARY',
    recovery_time_hours: 12,
    supply: {
      has_alternate_source: true,
      sources: [
        source('ep-utility-a', 'Harbor Electric Cooperative', 'Primary feeder', 'DIFFERENT_LOOP_OR_PATH', 'Primary service entrance on north wall.', 'Dedicated feeder serving the facility.', 26.1234, -80.1234),
        source('ep-utility-b', 'Harbor Electric Cooperative', 'Secondary feeder', 'DIFFERENT_DEMARCATION_SAME_UPSTREAM', 'Secondary service entrance in utility yard.', 'Separate feed with a distinct pathway.', 26.1236, -80.1231),
      ],
    },
    agreements: {
      has_sla: true,
      sla_hours: 4,
      has_pra: true,
      pra_category: 'TIER_2',
      pra_category_other: null,
    },
    maintenance_schedule: {
      preventive_maintenance_established: 'Yes',
      frequency: 'Monthly',
      last_service_date: '2026-03-15',
      next_scheduled_date: '2026-04-15',
      load_test_within_12_months: 'Yes',
      last_load_test_date: '2026-01-20',
      load_pct_tested: 80,
      spare_parts_maintained: 'Yes',
      parts_list: ['automatic transfer switch', 'filters', 'belts'],
      spare_parts_summary: 'Critical parts stocked on site.',
    },
    monitoring_capabilities: {
      real_time_monitoring_exists: 'Yes',
      automated_alerts_for_loss: 'Yes',
    },
    redundancy_activation: {
      mode: 'AUTOMATIC',
      activation_delay_min: 15,
      requires_trained_personnel: false,
      trained_personnel_24_7: true,
      remote_initiation_available: false,
      vendor_dispatch_required: false,
      documented_and_tested: true,
    },
    vehicle_impact_exposure: 'no',
    vehicle_impact_protection: 'unknown',
    answers: {
      curve_requires_service: true,
      curve_primary_provider: 'Harbor Electric Cooperative',
      curve_time_to_impact_hours: 0,
      curve_loss_fraction_no_backup: 0.92,
      curve_backup_available: 'yes',
      curve_backup_duration_hours: 48,
      curve_loss_fraction_with_backup: 0.08,
      curve_recovery_time_hours: 12,
      'E-2_can_identify_substations': 'yes',
      'E-3_more_than_one_connection': 'yes',
    },
  };

  categories.COMMUNICATIONS = {
    ...categories.COMMUNICATIONS,
    requires_service: true,
    time_to_impact_hours: 1,
    loss_fraction_no_backup: 0.7,
    has_backup_any: true,
    has_backup: true,
    has_backup_generator: false,
    backup_duration_hours: 72,
    loss_fraction_with_backup: 0.15,
    backup_capacity_pct: 85,
    backup_type: 'TEMPORARY',
    recovery_time_hours: 24,
    supply: {
      has_alternate_source: true,
      sources: [
        source('comms-fiber-a', 'Metro Fiber', 'Primary fiber path', 'DIFFERENT_LOOP_OR_PATH', 'Main telco handoff on west side.', 'Primary path used by business operations.', 26.1235, -80.1237),
        source('comms-fiber-b', 'Backup Carrier', 'Secondary fiber path', 'DIFFERENT_LOOP_OR_PATH', 'Alternate handoff in equipment room.', 'Separate carrier path for redundancy.', 26.1236, -80.1232),
      ],
    },
    agreements: {
      has_sla: true,
      sla_hours: 8,
      has_pra: true,
      pra_category: 'TIER_2',
      pra_category_other: null,
    },
    comms_single_provider_restoration: 'No',
    comms_alternate_providers_or_paths: 'Yes',
    comms_restoration_constraints: ['specialized_equipment', 'regional_outage_dependency'],
    maintenance_schedule: {
      preventive_maintenance_established: 'Yes',
      frequency: 'Quarterly',
      last_service_date: '2026-02-10',
      next_scheduled_date: '2026-05-10',
      load_test_within_12_months: 'Yes',
      last_load_test_date: '2026-02-10',
      spare_parts_maintained: 'Unknown',
    },
    monitoring_capabilities: {
      real_time_monitoring_exists: 'Yes',
      automated_alerts_for_loss: 'Yes',
    },
    redundancy_activation: {
      mode: 'MANUAL_REMOTE',
      activation_delay_min: 30,
      requires_trained_personnel: true,
      trained_personnel_24_7: true,
      remote_initiation_available: true,
      vendor_dispatch_required: false,
      documented_and_tested: true,
    },
    vehicle_impact_exposure: 'unknown',
    vehicle_impact_protection: 'unknown',
    answers: {
      curve_requires_service: true,
      curve_primary_provider: 'Metro Fiber',
      curve_time_to_impact_hours: 1,
      curve_loss_fraction_no_backup: 0.7,
      curve_backup_available: 'yes',
      curve_backup_duration_hours: 72,
      curve_loss_fraction_with_backup: 0.15,
      curve_recovery_time_hours: 24,
      comm_single_provider_restoration: 'No',
      comm_alternate_providers_or_paths: 'Yes',
    },
  };

  categories.INFORMATION_TECHNOLOGY = {
    ...categories.INFORMATION_TECHNOLOGY,
    requires_service: true,
    time_to_impact_hours: 0.5,
    loss_fraction_no_backup: 0.85,
    has_backup_any: true,
    has_backup: true,
    has_backup_generator: false,
    backup_duration_hours: null,
    loss_fraction_with_backup: 0.2,
    backup_capacity_pct: 80,
    backup_type: 'PERMANENT',
    recovery_time_hours: 6,
    supply: {
      has_alternate_source: true,
      sources: [
        source('it-isp-a', 'CoreNet ISP', 'Primary internet circuit', 'UNKNOWN', 'Main demarcation closet.', 'Primary ISP path for business systems.', 26.1234, -80.1234),
        source('it-isp-b', 'CloudLink', 'Secondary internet circuit', 'UNKNOWN', 'Backup demarcation closet.', 'Secondary ISP path for hosted workloads.', 26.1237, -80.1230),
      ],
    },
    alternative_providers: {
      available: 'Yes',
      lead_time_days: 5,
      reason_or_constraint: 'Hardware provisioning lead time and carrier install window.',
    },
    equipment_suppliers: [
      {
        component_or_service: 'Managed firewall appliance',
        provider_name: 'CoreNet ISP',
        alternatives_available: 'No',
        lead_time_days: 14,
        notes: 'Firewall replacement depends on managed service contract.',
      },
    ],
    maintenance_schedule: {
      preventive_maintenance_established: 'Yes',
      frequency: 'Monthly',
      last_service_date: '2026-03-05',
      next_scheduled_date: '2026-04-05',
      load_test_within_12_months: 'Yes',
      last_load_test_date: '2026-03-01',
      spare_parts_maintained: 'Yes',
      parts_list: ['spare switch', 'optics', 'power supplies'],
      spare_parts_summary: 'One spare of each critical network component is kept on site.',
    },
    monitoring_capabilities: {
      real_time_monitoring_exists: 'Yes',
      automated_alerts_for_loss: 'Yes',
    },
    redundancy_activation: {
      mode: 'MANUAL_REMOTE',
      activation_delay_min: 10,
      requires_trained_personnel: true,
      trained_personnel_24_7: true,
      remote_initiation_available: true,
      vendor_dispatch_required: false,
      documented_and_tested: true,
    },
    it_installation_location: 'interior_or_underground',
    it_continuity_plan_exists: 'yes',
    it_plan_exercised: 'yes_within_12_months',
    it_exercise_scope: 'functional_technical_test',
    it_transport_resilience: {
      circuit_count: 'TWO',
      carrier_diversity: 'DIFFERENT_CARRIERS',
      physical_path_diversity: {
        separate_conduits: true,
        same_conduit: false,
        separate_street_approach: true,
        unknown: false,
      },
      building_entry_diversity: 'SEPARATE_ENTRIES',
      upstream_pop_diversity: 'DIFFERENT_POPS',
      notes: 'Distinct carrier handoffs and distinct building entry routes are documented.',
      transport_connection_count: 2,
      transport_provider_count: 2,
      transport_building_entry_diversity: 'SEPARATE_ENTRY',
      transport_route_independence: 'CONFIRMED',
      transport_failover_mode: 'MANUAL_REMOTE',
    },
    it_hosted_resilience: {
      primary_erp: {
        survivability: 'ALTERNATE_PLATFORM_OR_PROVIDER',
        notes: 'ERP can fail over to a hosted secondary platform.',
      },
      backup_files: {
        survivability: 'LOCAL_MIRROR_OR_CACHE',
        notes: 'Encrypted backups are replicated offsite.',
      },
    },
    answers: {
      curve_requires_service: true,
      curve_primary_provider: 'CoreNet ISP',
      curve_time_to_impact_hours: 0.5,
      curve_loss_fraction_no_backup: 0.85,
      curve_backup_available: 'yes',
      curve_backup_duration_hours: null,
      curve_loss_fraction_with_backup: 0.2,
      curve_recovery_time_hours: 6,
      'IT-1_can_identify_providers': 'yes',
      'IT-8_backup_available': 'yes',
    },
  };

  categories.WATER = {
    ...categories.WATER,
    requires_service: true,
    time_to_impact_hours: 2,
    loss_fraction_no_backup: 0.8,
    has_backup_any: true,
    has_backup: true,
    has_backup_generator: false,
    backup_duration_hours: null,
    loss_fraction_with_backup: 0.25,
    backup_capacity_pct: 75,
    backup_type: 'PERMANENT',
    recovery_time_hours: 18,
    supply: {
      has_alternate_source: true,
      sources: [
        source('water-main-a', 'Harbor Water Utility', 'Primary water feed', 'DIFFERENT_LOOP_OR_PATH', 'Primary service on east utility corridor.', 'Primary utility service for potable water.', 26.1233, -80.1236),
        source('water-main-b', 'Harbor Water Utility', 'Secondary water feed', 'SAME_DEMARCATION', 'Secondary service near the fire riser room.', 'Distinct internal branch with a separate shutoff.', 26.1232, -80.1232),
      ],
    },
    agreements: {
      has_sla: true,
      sla_hours: 12,
      has_pra: true,
      pra_category: 'TIER_3',
      pra_category_other: null,
    },
    maintenance_schedule: {
      preventive_maintenance_established: 'Yes',
      frequency: 'Quarterly',
      last_service_date: '2026-02-20',
      next_scheduled_date: '2026-05-20',
      load_test_within_12_months: 'Yes',
      last_load_test_date: '2026-02-20',
      spare_parts_maintained: 'Yes',
      parts_list: ['pressure sensors', 'valves'],
      spare_parts_summary: 'Essential replacement parts are stored on site.',
    },
    monitoring_capabilities: {
      real_time_monitoring_exists: 'Yes',
      automated_alerts_for_loss: 'Yes',
    },
    redundancy_activation: {
      mode: 'MANUAL_ONSITE',
      activation_delay_min: 45,
      requires_trained_personnel: true,
      trained_personnel_24_7: false,
      remote_initiation_available: false,
      vendor_dispatch_required: true,
      documented_and_tested: true,
    },
    vehicle_impact_exposure: 'unknown',
    vehicle_impact_protection: 'unknown',
    answers: {
      curve_requires_service: true,
      curve_primary_provider: 'Harbor Water Utility',
      curve_time_to_impact_hours: 2,
      curve_loss_fraction_no_backup: 0.8,
      curve_backup_available: 'yes',
      curve_backup_duration_hours: null,
      curve_loss_fraction_with_backup: 0.25,
      curve_recovery_time_hours: 18,
    },
  };

  categories.WASTEWATER = {
    ...categories.WASTEWATER,
    requires_service: true,
    time_to_impact_hours: 4,
    loss_fraction_no_backup: 0.6,
    has_backup_any: true,
    has_backup: true,
    has_backup_generator: false,
    backup_duration_hours: 8,
    loss_fraction_with_backup: 0.2,
    backup_capacity_pct: 80,
    backup_type: 'TEMPORARY',
    recovery_time_hours: 12,
    supply: {
      has_alternate_source: true,
      sources: [
        source('ww-main-a', 'Harbor Wastewater Utility', 'Primary lift station feed', 'DIFFERENT_LOOP_OR_PATH', 'Primary electrical service near lift station.', 'Primary feed for wastewater controls.', 26.1231, -80.1235),
        source('ww-main-b', 'Harbor Wastewater Utility', 'Secondary lift station feed', 'DIFFERENT_LOOP_OR_PATH', 'Secondary electrical service at backup panel.', 'Secondary feed used when the primary line is disrupted.', 26.1230, -80.1231),
      ],
    },
    agreements: {
      has_sla: true,
      sla_hours: 12,
      has_pra: false,
      pra_category: null,
      pra_category_other: null,
    },
    maintenance_schedule: {
      preventive_maintenance_established: 'Yes',
      frequency: 'Monthly',
      last_service_date: '2026-03-08',
      next_scheduled_date: '2026-04-08',
      load_test_within_12_months: 'Yes',
      last_load_test_date: '2026-03-08',
      spare_parts_maintained: 'Yes',
      parts_list: ['pump seals', 'control relays'],
      spare_parts_summary: 'Pump and controls spare parts are tracked in inventory.',
    },
    monitoring_capabilities: {
      real_time_monitoring_exists: 'Yes',
      automated_alerts_for_loss: 'Yes',
    },
    redundancy_activation: {
      mode: 'AUTOMATIC',
      activation_delay_min: 5,
      requires_trained_personnel: false,
      trained_personnel_24_7: true,
      remote_initiation_available: true,
      vendor_dispatch_required: false,
      documented_and_tested: true,
    },
    vehicle_impact_exposure: 'yes',
    vehicle_impact_protection: 'yes',
    answers: {
      curve_requires_service: true,
      curve_primary_provider: 'Harbor Wastewater Utility',
      curve_time_to_impact_hours: 4,
      curve_loss_fraction_no_backup: 0.6,
      curve_backup_available: 'yes',
      curve_backup_duration_hours: 8,
      curve_loss_fraction_with_backup: 0.2,
      curve_recovery_time_hours: 12,
    },
  };

  categories.CRITICAL_PRODUCTS = {
    ...categories.CRITICAL_PRODUCTS,
    critical_product_single_source: false,
    critical_product_no_alt_supplier: false,
    critical_products: [
      {
        product_or_service: 'Disinfectant wipes',
        dependency_present: true,
        notes: 'Stock is maintained on site and replenished weekly.',
        single_source: false,
        alternate_supplier_identified: true,
        alternate_supplier_name: 'Regional Supply Co.',
        multi_source_currently_used: true,
      },
      {
        product_or_service: 'Replacement HVAC filters',
        dependency_present: true,
        notes: 'Alternate supplier exists but lead time is longer than the on-site reorder cycle.',
        single_source: true,
        alternate_supplier_identified: false,
        alternate_supplier_name: null,
        multi_source_currently_used: false,
      },
    ],
    answers: {
      critical_products: [
        {
          product_or_service: 'Disinfectant wipes',
          dependency_present: true,
          alternate_supplier_identified: true,
        },
        {
          product_or_service: 'Replacement HVAC filters',
          dependency_present: true,
          alternate_supplier_identified: false,
        },
      ],
    },
  };

  return assessment;
}

const assessment = buildShowcaseAssessment();
buildReportThemedFindingsForExport(assessment);
const derivedSessions = buildSessionsDerivedFromAssessment(assessment);
const sanitizedAssessment = sanitizeAssessmentBeforeSave(assessment);

const sessions = {
  ELECTRIC_POWER: session(
    {
      curve_requires_service: true,
      curve_primary_provider: 'Harbor Electric Cooperative',
      curve_backup_available: 'yes',
      curve_backup_duration_hours: 48,
      curve_loss_fraction_with_backup: 0.08,
      curve_recovery_time_hours: 12,
      'E-2_can_identify_substations': 'yes',
      'E-3_more_than_one_connection': 'yes',
    },
    derivedSessions.ELECTRIC_POWER?.derived ?? {}
  ),
  COMMUNICATIONS: session(
    {
      curve_requires_service: true,
      curve_primary_provider: 'Metro Fiber',
      curve_backup_available: 'yes',
      curve_backup_duration_hours: 72,
      curve_loss_fraction_with_backup: 0.15,
      curve_recovery_time_hours: 24,
      comm_single_provider_restoration: 'No',
      comm_alternate_providers_or_paths: 'Yes',
    },
    derivedSessions.COMMUNICATIONS?.derived ?? {}
  ),
  INFORMATION_TECHNOLOGY: session(
    {
      curve_requires_service: true,
      curve_primary_provider: 'CoreNet ISP',
      curve_backup_available: 'yes',
      curve_loss_fraction_with_backup: 0.2,
      curve_recovery_time_hours: 6,
      'IT-1_can_identify_providers': 'yes',
      'IT-8_backup_available': 'yes',
    },
    derivedSessions.INFORMATION_TECHNOLOGY?.derived ?? {}
  ),
  WATER: session(
    {
      curve_requires_service: true,
      curve_primary_provider: 'Harbor Water Utility',
      curve_backup_available: 'yes',
      curve_loss_fraction_with_backup: 0.25,
      curve_recovery_time_hours: 18,
    },
    derivedSessions.WATER?.derived ?? {}
  ),
  WASTEWATER: session(
    {
      curve_requires_service: true,
      curve_primary_provider: 'Harbor Wastewater Utility',
      curve_backup_available: 'yes',
      curve_backup_duration_hours: 8,
      curve_loss_fraction_with_backup: 0.2,
      curve_recovery_time_hours: 12,
    },
    derivedSessions.WASTEWATER?.derived ?? {}
  ),
};

const file = buildProgressFileV2(sanitizedAssessment, sessions);
const outPath = path.join(__dirname, 'showcase_progress.json');
fs.writeFileSync(outPath, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outPath}`);
