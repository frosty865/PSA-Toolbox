import { z } from "zod";

const facilitySchema = z
  .object({
    facility_name: z.string().min(1).optional(),
    address_line1: z.string().optional(),
    address_line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postal_code: z.string().optional(),
    latitude: z.union([z.string(), z.number()]).nullable().optional(),
    longitude: z.union([z.string(), z.number()]).nullable().optional(),
    poc_name: z.string().optional(),
    poc_email: z.string().optional(),
    poc_phone: z.string().optional(),
  })
  .passthrough();

const templateSchema = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().optional(),
    description: z.unknown().optional(),
  })
  .passthrough();

export const createAssessmentBodySchema = z
  .object({
    assessment_name: z.string().optional(),
    sector_code: z.string().optional(),
    subsector_code: z.string().optional(),
    facility: facilitySchema.optional(),
    subsector_details: z.unknown().optional(),
    modules: z.array(z.string()).optional(),
    name: z.string().optional(),
    sector_id: z.string().nullable().optional(),
    subsector_id: z.string().nullable().optional(),
    qa_flag: z.boolean().optional(),
    template_id: z.string().optional(),
    template: templateSchema.optional(),
  })
  .passthrough();

export type CreateAssessmentBody = z.infer<typeof createAssessmentBodySchema>;

