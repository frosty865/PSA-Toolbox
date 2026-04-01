# Assessment JSON Fields and Associated Questions

Use this list to build a sample assessment: each JSON path is paired with the question or label used in the UI (or implied by the schema).

For acronym definitions and why they matter, see: [`docs/help/ASSESSMENT_ACRONYM_HELP.md`](./help/ASSESSMENT_ACRONYM_HELP.md).

---

## Top-level structure

- `meta` — System metadata (no user questions).
- `asset` — Asset and PSA contact (see Asset below).
- `categories` — One object per category code; each has curve + optional supply, agreements, and category-specific blocks.
- `priority_restoration` — Optional; per-topic PRA/SLA when `settings.pra_sla_enabled` is true.
- `cross_dependencies` — Optional; edges and derived (circular, common-mode) when `settings.cross_dependency_enabled` is true.
- `settings` — Module toggles (e.g. `pra_sla_enabled`, `cross_dependency_enabled`).
- `infrastructure` — Optional; namespaced curve storage per topic.
- `modules` — Optional; module state keyed by module id.

---

## meta (system)

| JSON path | Type | Question / note |
|-----------|------|------------------|
| `meta.tool_version` | string | Set by app. |
| `meta.template_version` | string | Set by app. |
| `meta.created_at_iso` | string | ISO date/time; set by app. |

---

## asset

| JSON path | Type | Question / label |
|-----------|------|------------------|
| `asset.asset_name` | string | Asset name |
| `asset.visit_date_iso` | string | Visit date (ISO date) |
| `asset.location` | string | Location (Lat/Long, optional). e.g. "38.9072, -77.0369" |
| `asset.assessor` | string | Assessor (optional) |
| `asset.psa_name` | string | PSA name |
| `asset.psa_region` | string | Region (e.g. 03) |
| `asset.psa_city` | string | City |
| `asset.psa_phone` | string | Phone (required for export; `psa_cell` is alias) |
| `asset.psa_cell` | string | Cell (alias for psa_phone) |
| `asset.psa_email` | string | Email |
| `asset.services_provided` | string[] | Services this facility provides (one per line; for report designation block) |

---

## categories — shared curve fields (per category)

Used by **ELECTRIC_POWER**, **COMMUNICATIONS**, **INFORMATION_TECHNOLOGY**, **WATER**, **WASTEWATER**.  
For Comms/IT the UI may use `curve_*` keys that are mapped to these names when persisting.

| JSON path | Type | Question (by category) |
|-----------|------|-------------------------|
| `categories.<CODE>.requires_service` | boolean | **Electric:** Does the asset require electrical power for its core operations? **Water:** Does the asset require water for its core operations? **Wastewater:** Does the asset require wastewater services for its core operations? **Comms/IT:** Does the asset require communications / information technology for its core operations? |
| `categories.<CODE>.time_to_impact_hours` | number 0–72 | If [service] is lost (without backup), how soon would the facility be severely impacted? (Hours) |
| `categories.<CODE>.loss_fraction_no_backup` | number 0–1 | Once [service] is lost (without backup), what percentage of normal business functions are lost or degraded? (stored as fraction) |
| `categories.<CODE>.has_backup_any` | boolean | Is there an alternative or backup that can be used in the case of loss of [service]? (Electric uses has_backup_any; Water/Wastewater may use has_backup) |
| `categories.<CODE>.has_backup` | boolean | Same as above; legacy/Water/Wastewater. |
| `categories.<CODE>.has_backup_generator` | boolean | Is there a backup generator? (Electric) |
| `categories.<CODE>.backup_duration_hours` | number 0–96 | Duration of backup or alternative [service] (hours). |
| `categories.<CODE>.loss_fraction_with_backup` | number 0–1 | Once [service] is lost (considering backup), what percentage of normal business functions are lost or degraded? |
| `categories.<CODE>.backup_capacity_pct` | number 0–100 | Percent of normal operations sustained while on backup (optional). |
| `categories.<CODE>.recovery_time_hours` | number 0–168 | Once external service is restored, how long until full resumption of operations? (Hours) |

---

## categories — supply (non-CP categories)

Path: `categories.<CODE>.supply`. Not used for CRITICAL_PRODUCTS.

| JSON path | Type | Question / label |
|-----------|------|------------------|
| `supply.has_alternate_source` | boolean | Is there an alternate source/feed for this service? (Yes/No) |
| `supply.sources` | array | One row per source/feed. When has_alternate_source is true, minimum 2; each must have provider_name and (for non-IT) independence set. |
| `supply.sources[].source_id` | string | Unique id (e.g. UUID). |
| `supply.sources[].provider_name` | string | Provider name (required when has_alternate_source is true). |
| `supply.sources[].source_label` | string | Source label (optional). |
| `supply.sources[].demarcation_lat` | number | Latitude (optional). |
| `supply.sources[].demarcation_lon` | number | Longitude (optional). |
| `supply.sources[].demarcation_description` | string | Demarcation description. |
| `supply.sources[].independence` | enum | Independence: UNKNOWN, SAME_DEMARCATION, DIFFERENT_DEMARCATION_SAME_UPSTREAM, DIFFERENT_LOOP_OR_PATH. (Non-IT: must be set when has_alternate_source is true.) |
| `supply.sources[].notes` | string | Notes. |

---

## categories — agreements (non-CP categories)

Path: `categories.<CODE>.agreements`.

| JSON path | Type | Question / label |
|-----------|------|------------------|
| `agreements.has_sla` | boolean | Service Level Agreement (SLA) in place? |
| `agreements.sla_hours` | number 0–168 | SLA restoration target (hours). Required when has_sla is true. |
| `agreements.has_pra` | boolean | Priority Restoration Agreement (PRA) — Federal or SLTT in place? |
| `agreements.pra_category` | enum | PRA priority category: UNKNOWN, TIER_1, TIER_2, TIER_3, OTHER. Required when has_pra is true. |
| `agreements.pra_category_other` | string | If Other, specify. Required when pra_category is OTHER. |

---

## categories — Critical Products (CRITICAL_PRODUCTS only)

Path: `categories.CRITICAL_PRODUCTS.critical_products` (array of rows).

| JSON path | Type | Question / label |
|-----------|------|------------------|
| `critical_products[].product_or_service` | string | Product or service |
| `critical_products[].dependency_present` | boolean | Dependency present |
| `critical_products[].notes` | string | Notes or comments |
| `critical_products[].single_source` | boolean | Single source |
| `critical_products[].alternate_supplier_identified` | boolean | Alternate supplier identified |
| `critical_products[].alternate_supplier_name` | string | Required when alternate_supplier_identified is true; must be null when false. |
| `critical_products[].multi_source_currently_used` | boolean | Multi-source currently used (optional) |

---

## categories — redundancy activation (when backup/alternate exists)

Path: `categories.<CODE>.redundancy_activation`.

| JSON path | Type | Question / label |
|-----------|------|------------------|
| `redundancy_activation.mode` | enum | How is alternate capability initiated? AUTOMATIC, MANUAL_ONSITE, MANUAL_REMOTE, VENDOR_REQUIRED, UNKNOWN. |
| `redundancy_activation.activation_delay_min` | number 0–10080 | Activation delay (minutes) until alternate is fully effective. |
| `redundancy_activation.requires_trained_personnel` | boolean | Requires trained personnel to initiate? |
| `redundancy_activation.trained_personnel_24_7` | boolean | Is trained personnel available 24/7 to initiate the alternate capability? |
| `redundancy_activation.remote_initiation_available` | boolean | Remote initiation available? |
| `redundancy_activation.vendor_dispatch_required` | boolean | Vendor dispatch required? |
| `redundancy_activation.documented_and_tested` | boolean | Documented and tested? |

---

## categories — maintenance schedule (optional, per category)

Path: `categories.<CODE>.maintenance_schedule`.

| JSON path | Type | Question / label |
|-----------|------|------------------|
| `maintenance_schedule.preventive_maintenance_established` | enum | Yes / No / Unknown |
| `maintenance_schedule.frequency` | string | Frequency |
| `maintenance_schedule.last_service_date` | string | Last service date |
| `maintenance_schedule.next_scheduled_date` | string | Next scheduled date |
| `maintenance_schedule.load_test_within_12_months` | enum | Yes / No / Unknown |
| `maintenance_schedule.last_load_test_date` | string | Last load test date |
| `maintenance_schedule.load_pct_tested` | number 0–100 | Load % tested |
| `maintenance_schedule.spare_parts_maintained` | enum | Yes / No / Unknown |
| `maintenance_schedule.parts_list` | string[] | Parts list |
| `maintenance_schedule.spare_parts_summary` | string | Spare parts summary |

---

## categories — monitoring capabilities (optional)

Path: `categories.<CODE>.monitoring_capabilities`.

| JSON path | Type | Question / label |
|-----------|------|------------------|
| `monitoring_capabilities.real_time_monitoring_exists` | enum | Yes / No / Unknown |
| `monitoring_capabilities.automated_alerts_for_loss` | enum | Yes / No / Unknown |

---

## categories — vehicle impact (dependency tabs)

| JSON path | Type | Question / label |
|-----------|------|------------------|
| `categories.<CODE>.vehicle_impact_exposure` | enum | Vehicle impact exposure: yes, no, unknown, na |
| `categories.<CODE>.vehicle_impact_protection` | enum | Vehicle impact protection (when exposure = yes): yes, no, unknown |
| `categories.<CODE>.it_installation_location` | enum | (IT) Installation location: exterior_at_grade, exterior_elevated_or_protected, interior_or_underground, unknown |
| `categories.<CODE>.it_continuity_plan_exists` | enum | (IT) Continuity/recovery plan exists: yes, no, unknown |
| `categories.<CODE>.it_plan_exercised` | enum | (IT) Plan exercised: yes_within_12_months, yes_over_12_months_ago, no, unknown |
| `categories.<CODE>.it_exercise_scope` | enum | (IT) Scope of most recent exercise: tabletop_discussion, functional_technical_test, full_operational_exercise, unknown |

---

## categories — Communications-specific

| JSON path | Type | Question / label |
|-----------|------|------------------|
| `categories.COMMUNICATIONS.comms_single_provider_restoration` | enum | Single provider for restoration: Yes, No, Unknown |
| `categories.COMMUNICATIONS.comms_alternate_providers_or_paths` | enum | Alternate providers or service paths available: Yes, No, Unknown |
| `categories.COMMUNICATIONS.comms_restoration_constraints` | string[] | Restoration constraints (e.g. provider_backlog, specialized_equipment, regional_outage_dependency, access_permitting_constraints, unknown) |

---

## categories — IT transport resilience (INFORMATION_TECHNOLOGY only)

Path: `categories.INFORMATION_TECHNOLOGY.it_transport_resilience`.

| JSON path | Type | Question / label |
|-----------|------|------------------|
| `it_transport_resilience.circuit_count` | enum | Circuit count: ONE, TWO, THREE_PLUS. Required when IT requires_service is true. |
| `it_transport_resilience.carrier_diversity` | enum | Carrier diversity: SAME_CARRIER, DIFFERENT_CARRIERS, UNKNOWN |
| `it_transport_resilience.physical_path_diversity` | object | At least one true: same_conduit, separate_conduits, separate_street_approach, unknown |
| `it_transport_resilience.building_entry_diversity` | enum | (Legacy) SAME_ENTRY, SEPARATE_ENTRIES, UNKNOWN |
| `it_transport_resilience.transport_building_entry_diversity` | enum | Building entry diversity: SAME_ENTRY, SEPARATE_ENTRY, UNKNOWN |
| `it_transport_resilience.transport_route_independence` | enum | Route independence: CONFIRMED, NOT_CONFIRMED, UNKNOWN |
| `it_transport_resilience.transport_failover_mode` | enum | Failover mode: AUTOMATIC, MANUAL_ONSITE, MANUAL_REMOTE, UNKNOWN |
| `it_transport_resilience.transport_connection_count` | number | Physical connection count (integer; null = not documented). |
| `it_transport_resilience.upstream_pop_diversity` | enum | Upstream POP diversity: SAME_POP, DIFFERENT_POPS, UNKNOWN |
| `it_transport_resilience.notes` | string | Notes |

---

## categories — IT hosted resilience (INFORMATION_TECHNOLOGY only)

Path: `categories.INFORMATION_TECHNOLOGY.it_hosted_resilience`.  
Keyed by dependency_id (e.g. hosted service id). Each value:

| JSON path | Type | Question / label |
|-----------|------|------------------|
| `it_hosted_resilience.<id>.survivability` | enum | Hosted continuity: NO_CONTINUITY, LOCAL_MIRROR_OR_CACHE, ALTERNATE_PLATFORM_OR_PROVIDER, UNKNOWN |
| `it_hosted_resilience.<id>.notes` | string | Notes |

---

## categories — equipment suppliers / supply chain (optional)

| JSON path | Type | Question / label |
|-----------|------|------------------|
| `categories.<CODE>.equipment_suppliers` | array | Single-source dependency entries. |
| `equipment_suppliers[].component_or_service` | string | Component or service |
| `equipment_suppliers[].provider_name` | string | Provider name |
| `equipment_suppliers[].alternatives_available` | enum | Yes, No, Unknown |
| `equipment_suppliers[].lead_time_days` | number ≥ 0 | Lead time (days) |
| `equipment_suppliers[].notes` | string | Notes |
| `categories.<CODE>.alternative_providers.available` | enum | Yes, No, Unknown |
| `categories.<CODE>.alternative_providers.lead_time_days` | number ≥ 0 | Lead time (days) |
| `categories.<CODE>.alternative_providers.reason_or_constraint` | string | Reason or constraint |
| `categories.<CODE>.lead_time_days` | number ≥ 0 | Typical lead time for replacement/alternate (days) |

---

## priority_restoration (when settings.pra_sla_enabled is true)

Path: `priority_restoration.<topic>` where topic is one of: energy, communications, information_technology, water, wastewater.

| JSON path | Type | Question / label |
|-----------|------|------------------|
| `priority_restoration.<topic>.federal_standard` | boolean | Federal standard |
| `priority_restoration.<topic>.pra_category` | enum | PRA category (TIER_1, TIER_2, TIER_3, OTHER, null) |
| `priority_restoration.<topic>.pra_category_other` | string | If OTHER, specify (max 80 chars) |
| `priority_restoration.<topic>.paid_sla` | boolean | Paid SLA |
| `priority_restoration.<topic>.sla_assessed` | boolean | SLA assessed (yes/no answered) |
| `priority_restoration.<topic>.sla_mttr_max_hours` | number | SLA MTTR max (hours) |
| `priority_restoration.<topic>.sla_mttr_max_source` | enum | contract, service_order, sow, other, unknown |
| `priority_restoration.<topic>.sla_mttr_max_notes` | string | Notes |
| `priority_restoration.<topic>.notes` | string | Notes |
| `priority_restoration.<topic>.sla_failure_flags` | object | Regional applicability, clock defined, activation required documented, etc. (yes/no/unknown each) |
| `priority_restoration.<topic>.sla_categorization` | object | assessed, sla_in_place, mttr_max_hours, applies_in_widespread_events, etc. (YES/NO/UNKNOWN) |

---

## cross_dependencies (when settings.cross_dependency_enabled is true)

Can be legacy array or node `{ edges, derived, last_auto_suggest_hash, rejected_keys }`.

| JSON path | Type | Question / label |
|-----------|------|------------------|
| `cross_dependencies.edges[]` | array | Self-driven cross-dependency edges. |
| `edges[].from_category` | enum | From: ELECTRIC_POWER, COMMUNICATIONS, INFORMATION_TECHNOLOGY, WATER, WASTEWATER, CRITICAL_PRODUCTS |
| `edges[].to_category` | enum | To (same set) |
| `edges[].purpose` | enum | primary_operations, monitoring_control, restoration_recovery, safety_life_safety |
| `edges[].criticality` | enum | critical, important, limited, unknown |
| `edges[].time_to_cascade_bucket` | enum | immediate, short, medium, long, unknown |
| `edges[].single_path` | enum | yes, no, unknown |
| `edges[].confidence` | enum | assumed, documented, confirmed, unknown |
| `edges[].notes` | string | Notes |
| `edges[].source` | enum | auto_suggest, user |
| `cross_dependencies.derived.circular_dependencies` | array | Circular paths (array of category arrays). |
| `cross_dependencies.derived.common_mode_spof` | array | Common-mode SPOF entries (upstream_category, affected_categories, rationale). |

---

## settings

| JSON path | Type | Question / label |
|-----------|------|------------------|
| `settings.pra_sla_enabled` | boolean | When true, PRA/SLA questions and report content are included. Default false. |
| `settings.cross_dependency_enabled` | boolean | When true, cross-dependency tab and cascading-risk content are included. Default false. |

---

## Minimal sample (structure only)

```json
{
  "meta": {
    "tool_version": "1.0.0",
    "template_version": "1.0",
    "created_at_iso": "2026-03-02T12:00:00.000Z"
  },
  "asset": {
    "asset_name": "Sample Asset",
    "visit_date_iso": "2026-03-02T00:00:00.000Z",
    "location": "38.9072, -77.0369",
    "psa_name": "PSA Name",
    "psa_phone": "555-0100",
    "psa_email": "psa@example.com"
  },
  "categories": {
    "ELECTRIC_POWER": {
      "requires_service": true,
      "time_to_impact_hours": 4,
      "loss_fraction_no_backup": 0.9,
      "has_backup_any": true,
      "has_backup_generator": true,
      "backup_duration_hours": 72,
      "loss_fraction_with_backup": 0.2,
      "recovery_time_hours": 2,
      "supply": {
        "has_alternate_source": true,
        "sources": [
          { "source_id": "src-1", "provider_name": "Utility A", "independence": "DIFFERENT_LOOP_OR_PATH" },
          { "source_id": "src-2", "provider_name": "Utility B", "independence": "DIFFERENT_LOOP_OR_PATH" }
        ]
      },
      "agreements": {
        "has_sla": false,
        "sla_hours": null,
        "has_pra": true,
        "pra_category": "TIER_2",
        "pra_category_other": null
      }
    },
    "COMMUNICATIONS": { "requires_service": true, "time_to_impact_hours": 2, "loss_fraction_no_backup": 0.8, "has_backup_any": false, "supply": { "has_alternate_source": false, "sources": [{ "source_id": "c1", "provider_name": null, "independence": "UNKNOWN" }] }, "agreements": { "has_sla": false, "sla_hours": null, "has_pra": false, "pra_category": null, "pra_category_other": null } },
    "INFORMATION_TECHNOLOGY": { "requires_service": true, "time_to_impact_hours": 1, "loss_fraction_no_backup": 0.95, "has_backup_any": true, "backup_duration_hours": 24, "loss_fraction_with_backup": 0.1, "recovery_time_hours": 4, "supply": { "has_alternate_source": false, "sources": [{ "source_id": "i1", "provider_name": null, "independence": "UNKNOWN" }] }, "agreements": { "has_sla": false, "sla_hours": null, "has_pra": false, "pra_category": null, "pra_category_other": null }, "it_transport_resilience": { "circuit_count": "TWO", "transport_building_entry_diversity": "SEPARATE_ENTRY", "transport_route_independence": "CONFIRMED", "transport_failover_mode": "AUTOMATIC" } },
    "WATER": { "requires_service": true, "time_to_impact_hours": 24, "loss_fraction_no_backup": 0.5, "has_backup": false, "supply": { "has_alternate_source": false, "sources": [{ "source_id": "w1", "provider_name": null, "independence": "UNKNOWN" }] }, "agreements": { "has_sla": false, "sla_hours": null, "has_pra": false, "pra_category": null, "pra_category_other": null } },
    "WASTEWATER": { "requires_service": true, "time_to_impact_hours": 48, "loss_fraction_no_backup": 0.3, "has_backup": false, "supply": { "has_alternate_source": false, "sources": [{ "source_id": "ww1", "provider_name": null, "independence": "UNKNOWN" }] }, "agreements": { "has_sla": false, "sla_hours": null, "has_pra": false, "pra_category": null, "pra_category_other": null } },
    "CRITICAL_PRODUCTS": {
      "critical_products": [
        { "product_or_service": "Chemical X", "dependency_present": true, "notes": null, "single_source": false, "alternate_supplier_identified": true, "alternate_supplier_name": "Supplier B" }
      ]
    }
  }
}
```

Validation rules (see `packages/schema/src/assessment.ts`): e.g. when `requires_service` is false, impact/backup/recovery must be null/zero; when `has_backup_any` is true, `backup_duration_hours` and `loss_fraction_with_backup` are required; when `has_alternate_source` is true, non-IT categories must set `independence` on each source; Critical Products row must have `alternate_supplier_name` when `alternate_supplier_identified` is true, and null when false.
