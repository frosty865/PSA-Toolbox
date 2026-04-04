/**
 * AUTO-GENERATED FILE. DO NOT EDIT. Run scripts/extract_xlsm_ui_config.ts
 * Source: Asset Dependency Visualization.xlsm
 */
import type { UICategoryConfig } from './ui_config';

export const UI_CONFIG: UICategoryConfig[] = [
  {
    category: "ELECTRIC_POWER",
    title: "Electric Power",
    description: null,
    fields: [
      { key: "requires_service", label: "Does the asset require electrical power for its core operations?", label_source: { sheet: "Electric Power", cell: "D25" }, help: null, type: 'boolean', defaultValue: true },
      { key: "time_to_impact_hours", label: "If electric supply is lost (without considering any backup or alternative mode), how soon would the facility be severely impacted?", label_source: { sheet: "Electric Power", cell: "D28" }, help: null, type: 'number', min: 0, max: 72, step: 1, unit: 'Hours', defaultValue: 1 },
      { key: "loss_fraction_no_backup", label: "Once electric supply is lost (without considering any backup or alternative mode), what percentage of normal business functions are lost or degraded? (percentage)", label_source: { sheet: "Electric Power", cell: "D32" }, help: null, type: 'number', min: 0, max: 1, step: 0.01, displayAs: 'percent', defaultValue: 0.9 },
      { key: "has_backup_any", label: "Is there analternative or backup that can be used in the case of loss of electric source?", label_source: { sheet: "Electric Power", cell: "D39" }, help: null, type: 'boolean', defaultValue: true },
      { key: "has_backup_generator", label: "Is there a backup generator?", label_source: { sheet: "Electric Power", cell: "H43" }, help: null, type: 'boolean', defaultValue: true },
      { key: "backup_duration_hours", label: "Duration of backup generation without refueling (numerical value)", label_source: { sheet: "Electric Power", cell: "H46" }, help: null, type: 'number', min: 0, max: 96, step: 1, unit: 'Hours', defaultValue: 96 },
      { key: "loss_fraction_with_backup", label: "Once electric supply is lost (and considering your backup or alternative mode), what percentage of normal business functions are lost or degraded?", label_source: { sheet: "Electric Power", cell: "D52" }, help: null, type: 'number', min: 0, max: 1, step: 0.01, displayAs: 'percent', defaultValue: 0.34 },
      { key: "recovery_time_hours", label: "Once external service is restored, how long would it take before full resumption of operations?", label_source: { sheet: "Electric Power", cell: "D58" }, help: null, type: 'number', min: 0, max: 168, step: 1, unit: 'Hours', defaultValue: 1 },
    ],
  },
  {
    category: "COMMUNICATIONS",
    title: "Communications",
    description: null,
    fields: [
      { key: "curve_requires_service", label: "Does the asset require communications for its core operations?", label_source: { sheet: "Communication", cell: "B1" }, help: null, type: 'boolean', defaultValue: null },
      { key: "curve_time_to_impact_hours", label: "If communications are lost (without backup), how soon would the facility be severely impacted?", label_source: { sheet: "Communication", cell: "B2" }, help: null, type: 'number', min: 0, max: 72, step: 1, unit: 'Hours', defaultValue: null },
      { key: "curve_loss_fraction_no_backup", label: "Once communications are lost (without backup), what percentage of normal business functions are lost or degraded?", label_source: { sheet: "Communication", cell: "B3" }, help: null, type: 'number', min: 0, max: 1, step: 0.01, displayAs: 'percent', defaultValue: null },
      { key: "curve_backup_available", label: "Is there an alternative or backup that can be used in the case of loss of communications?", label_source: { sheet: "Communication", cell: "B4" }, help: null, type: 'text', defaultValue: null },
      { key: "curve_backup_duration_hours", label: "Duration of backup or alternative communications (hours)", label_source: { sheet: "Communication", cell: "B5" }, help: null, type: 'number', min: 0, max: 96, step: 1, unit: 'Hours', defaultValue: null },
      { key: "curve_loss_fraction_with_backup", label: "Once communications are lost (considering backup), what percentage of normal business functions are lost or degraded?", label_source: { sheet: "Communication", cell: "B6" }, help: null, type: 'number', min: 0, max: 1, step: 0.01, displayAs: 'percent', defaultValue: null },
      { key: "curve_recovery_time_hours", label: "Once external service is restored, how long until full resumption of operations?", label_source: { sheet: "Communication", cell: "B7" }, help: null, type: 'number', min: 0, max: 168, step: 1, unit: 'Hours', defaultValue: null },
    ],
  },
  {
    category: "INFORMATION_TECHNOLOGY",
    title: "Information Technology",
    description: null,
    fields: [
      { key: "curve_requires_service", label: "Does the asset require information technology for its core operations?", label_source: { sheet: "Information Technology", cell: "B1" }, help: null, type: 'boolean', defaultValue: null },
      { key: "curve_time_to_impact_hours", label: "If IT services are lost (without backup), how soon would the facility be severely impacted?", label_source: { sheet: "Information Technology", cell: "B2" }, help: null, type: 'number', min: 0, max: 72, step: 1, unit: 'Hours', defaultValue: null },
      { key: "curve_loss_fraction_no_backup", label: "Once IT services are lost (without backup), what percentage of normal business functions are lost or degraded?", label_source: { sheet: "Information Technology", cell: "B3" }, help: null, type: 'number', min: 0, max: 1, step: 0.01, displayAs: 'percent', defaultValue: null },
      { key: "curve_backup_available", label: "Is there an alternative or backup that can be used in the case of loss of IT services?", label_source: { sheet: "Information Technology", cell: "B4" }, help: null, type: 'text', defaultValue: null },
      { key: "curve_backup_duration_hours", label: "Duration of backup or alternative IT (hours)", label_source: { sheet: "Information Technology", cell: "B5" }, help: null, type: 'number', min: 0, max: 96, step: 1, unit: 'Hours', defaultValue: null },
      { key: "curve_loss_fraction_with_backup", label: "Once IT services are lost (considering backup), what percentage of normal business functions are lost or degraded?", label_source: { sheet: "Information Technology", cell: "B6" }, help: null, type: 'number', min: 0, max: 1, step: 0.01, displayAs: 'percent', defaultValue: null },
      { key: "curve_recovery_time_hours", label: "Once external service is restored, how long until full resumption of operations?", label_source: { sheet: "Information Technology", cell: "B7" }, help: null, type: 'number', min: 0, max: 168, step: 1, unit: 'Hours', defaultValue: null },
    ],
  },
  {
    category: "WATER",
    title: "Water",
    description: null,
    fields: [
      { key: "requires_service", label: "Does the asset require water for its core operations?", label_source: { sheet: "Water", cell: "B1" }, help: null, type: 'boolean', defaultValue: false },
      { key: "time_to_impact_hours", label: "If water supply is lost (without backup), how soon would the facility be severely impacted?", label_source: { sheet: "Water", cell: "B2" }, help: null, type: 'number', min: 0, max: 72, step: 1, unit: 'Hours', defaultValue: 0 },
      { key: "loss_fraction_no_backup", label: "Once water supply is lost (without backup), what percentage of normal business functions are lost or degraded?", label_source: { sheet: "Water", cell: "B3" }, help: null, type: 'number', min: 0, max: 1, step: 0.01, displayAs: 'percent', defaultValue: 0 },
      { key: "has_backup", label: "Is there an alternative or backup that can be used in the case of loss of water supply?", label_source: { sheet: "Water", cell: "B4" }, help: null, type: 'boolean', defaultValue: false },
      { key: "backup_duration_hours", label: "Duration of backup or alternative water supply (hours)", label_source: { sheet: "Water", cell: "B5" }, help: null, type: 'number', min: 0, max: 96, step: 1, unit: 'Hours', defaultValue: null },
      { key: "loss_fraction_with_backup", label: "Once water supply is lost (considering backup), what percentage of normal business functions are lost or degraded?", label_source: { sheet: "Water", cell: "B6" }, help: null, type: 'number', min: 0, max: 1, step: 0.01, displayAs: 'percent', defaultValue: null },
      { key: "recovery_time_hours", label: "Once external supply is restored, how long until full resumption of operations?", label_source: { sheet: "Water", cell: "B7" }, help: null, type: 'number', min: 0, max: 168, step: 1, unit: 'Hours', defaultValue: 0 },
    ],
  },
  {
    category: "WASTEWATER",
    title: "Wastewater",
    description: null,
    fields: [
      { key: "requires_service", label: "Does the asset require wastewater services for its core operations?", label_source: { sheet: "Wastewater", cell: "B1" }, help: null, type: 'boolean', defaultValue: false },
      { key: "time_to_impact_hours", label: "If wastewater services are lost (without backup), how soon would the facility be severely impacted?", label_source: { sheet: "Wastewater", cell: "B2" }, help: null, type: 'number', min: 0, max: 72, step: 1, unit: 'Hours', defaultValue: 0 },
      { key: "loss_fraction_no_backup", label: "Once wastewater services are lost (without backup), what percentage of normal business functions are lost or degraded?", label_source: { sheet: "Wastewater", cell: "B3" }, help: null, type: 'number', min: 0, max: 1, step: 0.01, displayAs: 'percent', defaultValue: 0 },
      { key: "has_backup", label: "Is there an alternative or backup that can be used in the case of loss of wastewater services?", label_source: { sheet: "Wastewater", cell: "B4" }, help: null, type: 'boolean', defaultValue: false },
      { key: "backup_duration_hours", label: "Duration of backup or alternative wastewater capacity (hours)", label_source: { sheet: "Wastewater", cell: "B5" }, help: null, type: 'number', min: 0, max: 96, step: 1, unit: 'Hours', defaultValue: null },
      { key: "loss_fraction_with_backup", label: "Once wastewater services are lost (considering backup), what percentage of normal business functions are lost or degraded?", label_source: { sheet: "Wastewater", cell: "B6" }, help: null, type: 'number', min: 0, max: 1, step: 0.01, displayAs: 'percent', defaultValue: null },
      { key: "recovery_time_hours", label: "Once external service is restored, how long until full resumption of operations?", label_source: { sheet: "Wastewater", cell: "B7" }, help: null, type: 'number', min: 0, max: 168, step: 1, unit: 'Hours', defaultValue: 0 },
    ],
  },
  {
    category: "CRITICAL_PRODUCTS",
    title: "Critical Products",
    description: null,
    fields: [
    ],
    table: {
      columns: [
        { key: "product_or_service", label: "Product or service", label_source: { sheet: "Critical Products", cell: "B5" }, type: 'text' },
        { key: "dependency_present", label: "Dependency present", label_source: { sheet: "Critical Products", cell: "C5" }, type: 'boolean' },
        { key: "notes", label: "Notes or comments", label_source: { sheet: "Critical Products", cell: "D5" }, type: 'text' },
        { key: "single_source", label: "Single source", label_source: { sheet: "Critical Products", cell: "E5" }, type: 'boolean' },
        { key: "alternate_supplier_identified", label: "Alternate supplier identified", label_source: { sheet: "Critical Products", cell: "F5" }, type: 'boolean' },
      ],
      maxRows: 20,
    },
  },];
