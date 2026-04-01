/**
 * Canonical dependency contract — Electricity is the reference model.
 * All dependencies (Communications, IT, Water, Wastewater) MUST conform to this shape.
 * Build fails if any dependency lacks contract fields or allows free-text where Electricity enforces structure.
 */
import { z } from 'zod';

/** Dependency type identifier (aligned to CategoryCode minus CRITICAL_PRODUCTS). */
export const DependencyTypeSchema = z.enum([
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
]);
export type DependencyType = z.infer<typeof DependencyTypeSchema>;

// ─── 1. Dependency Gate ───────────────────────────────────────────────────
export const DependencyGateSchema = z.object({
  requires_service: z.boolean(),
  gate_question_id: z.string().min(1),
});
export type DependencyGate = z.infer<typeof DependencyGateSchema>;

// ─── 2. Impact Curve Inputs (0–72h outage modeling; identical curve math for all) ─
export const ImpactCurveInputsSchema = z.object({
  time_to_impact_hours: z.number().min(0).max(72),
  percent_functional_loss: z.number().min(0).max(100),
  time_to_recovery_hours: z.number().min(0).max(168),
});
export type ImpactCurveInputs = z.infer<typeof ImpactCurveInputsSchema>;

// ─── 3. Asset Enumeration (cardinality: min 1 when requires_service === true) ─
export const AssetDesignationSchema = z.enum(['primary', 'secondary', 'backup']);
export type AssetDesignation = z.infer<typeof AssetDesignationSchema>;

/** Location: either city/state OR lat/long. */
export const AssetLocationSchema = z.union([
  z.object({ city_state: z.string().min(1), lat_long: z.undefined().optional() }),
  z.object({ lat_long: z.string().min(1), city_state: z.undefined().optional() }),
]);
export type AssetLocation = z.infer<typeof AssetLocationSchema>;

export const ContractAssetSchema = z.object({
  asset_name: z.string().min(1),
  asset_type: z.string().min(1), // enum per dependency (e.g. utility_provider, substation, service_connection)
  location: z.string().min(1), // required: city/state OR lat/long as single string for storage
  designation: AssetDesignationSchema,
});
export type ContractAsset = z.infer<typeof ContractAssetSchema>;

// ─── 4. Redundancy Attributes ────────────────────────────────────────────
export const RedundancyAttributesSchema = z.object({
  multiple_feeds: z.boolean(),
  feeds_geographically_separated: z.boolean(),
  feeds_independent_capacity: z.boolean(),
});
export type RedundancyAttributes = z.infer<typeof RedundancyAttributesSchema>;

// ─── 5. Backup / Alternate Capability ─────────────────────────────────────
export const BackupScopeSchema = z.enum([
  'life_safety',
  'graceful_shutdown',
  'core_operations',
  'full_load',
]);
export type BackupScope = z.infer<typeof BackupScopeSchema>;

export const BackupCapabilitySchema = z.object({
  has_backup: z.boolean(),
  backup_scope: BackupScopeSchema.optional(), // required when has_backup === true
  backup_runtime_hours: z.number().min(0).max(168).optional(),
  refueling_or_resupply_plan: z.boolean(),
});
export type BackupCapability = z.infer<typeof BackupCapabilitySchema>;

// ─── 6. Restoration Coordination ──────────────────────────────────────────
export const RestorationCoordinationSchema = z.object({
  provider_identified: z.boolean(),
  participates_in_priority_restoration: z.boolean(),
  contingency_plan_exists: z.boolean(),
});
export type RestorationCoordination = z.infer<typeof RestorationCoordinationSchema>;

// ─── Full canonical contract (one per dependency) ───────────────────────────
export const DependencyContractSchema = z
  .object({
    dependency_type: DependencyTypeSchema,
    gate: DependencyGateSchema,
    impact_curve: ImpactCurveInputsSchema.optional(), // required when gate.requires_service === true
    assets: z.array(ContractAssetSchema).min(0),
    redundancy: RedundancyAttributesSchema,
    backup: BackupCapabilitySchema,
    restoration: RestorationCoordinationSchema,
  })
  .superRefine((data, ctx) => {
    if (data.gate.requires_service && (!data.assets || data.assets.length < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'assets must have at least one entry when requires_service is true',
        path: ['assets'],
      });
    }
    if (data.gate.requires_service && !data.impact_curve) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'impact_curve is required when requires_service is true',
        path: ['impact_curve'],
      });
    }
    if (data.backup.has_backup && data.backup.backup_scope == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'backup_scope is required when has_backup is true',
        path: ['backup', 'backup_scope'],
      });
    }
  });

export type DependencyContract = z.infer<typeof DependencyContractSchema>;

// ─── Question Help (audit target; required for question integrity) ───────────
/** Structured help required for every question. Replaces helpText. */
export const QuestionHelpSchema = z.object({
  summary: z.string().min(1),
  yes_definition: z.string().min(1),
  no_definition: z.string().min(1),
  impact: z.string().min(1),
});
export type QuestionHelp = z.infer<typeof QuestionHelpSchema>;

// ─── Question → Vulnerability trigger (for Phase 2) ─────────────────────────
export const QuestionVulnerabilityTriggerSchema = z.object({
  question_id: z.string().min(1),
  triggers_vulnerability: z.boolean(),
  vulnerability_id: z.string().min(1).optional(), // required when triggers_vulnerability === true
});
export type QuestionVulnerabilityTrigger = z.infer<typeof QuestionVulnerabilityTriggerSchema>;

/** Narrative tokens that MUST be resolved in report output (Phase 4). */
export const REQUIRED_NARRATIVE_TOKENS = [
  '{{impact_onset_hours}}',
  '{{functional_loss_percent}}',
  '{{recovery_time_hours}}',
] as const;
export type RequiredNarrativeToken = (typeof REQUIRED_NARRATIVE_TOKENS)[number];
