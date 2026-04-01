import { z } from 'zod';
import { CategoryCodeSchema } from './assessment';

/** Severity of a vulnerability / option for consideration (neutral, PSA-style). */
export const VOFCSeveritySchema = z.enum(['LOW', 'MODERATE', 'HIGH']);
export type VOFCSeverity = z.infer<typeof VOFCSeveritySchema>;

/** Whether the VOFC is confirmed or potential. */
export const VOFCApplicabilitySchema = z.enum(['CONFIRMED', 'POTENTIAL']);
export type VOFCApplicability = z.infer<typeof VOFCApplicabilitySchema>;

/** Provenance: SOURCE = from authoritative document; GENERATED = auto-map/LLM/synthesis. */
export const VOFCOriginSchema = z.enum(['SOURCE', 'GENERATED']);
export type VOFCOrigin = z.infer<typeof VOFCOriginSchema>;

/** Calibration reason length cap for storage/display. */
export const CALIBRATION_REASON_MAX_LENGTH = 200;

/**
 * Single VOFC: vulnerability and option for consideration.
 * Neutral wording only for GENERATED; SOURCE-origin content is exempt from forbidden-language rules.
 * base_severity: from library; calibrated_severity: may be escalated (or downgraded if enabled) from bands.
 */
export const VOFCSchema = z.object({
  vofc_id: z.string(),
  category: CategoryCodeSchema,
  title: z.string(),
  vulnerability: z.string(),
  impact: z.string().nullable(),
  option_for_consideration: z.string(),
  base_severity: VOFCSeveritySchema,
  calibrated_severity: VOFCSeveritySchema,
  calibration_reason: z.string().max(CALIBRATION_REASON_MAX_LENGTH).nullable(),
  applicability: VOFCApplicabilitySchema,
  source_ref: z.string().optional(),
  /** SOURCE = from document extraction; GENERATED = auto-map/LLM. Forbidden-language rules apply only to GENERATED. */
  origin: VOFCOriginSchema,
  source_registry_id: z.string().nullable().optional(),
  source_tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable().optional(),
  source_publisher: z.string().nullable().optional(),
});
export type VOFC = z.infer<typeof VOFCSchema>;

/** Collection of VOFCs with metadata. */
export const VOFCCollectionSchema = z.object({
  generated_at_iso: z.string(),
  tool_version: z.string(),
  items: z.array(VOFCSchema),
});
export type VOFCCollection = z.infer<typeof VOFCCollectionSchema>;
