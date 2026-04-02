import { z } from 'zod';
import { VALID_PROFILE_STATUSES } from '@/app/lib/expansion/validation';

const profileStatusSchema = z.enum(VALID_PROFILE_STATUSES);

export const expansionProfileUpsertSchema = z.object({
  profile_id: z.string().trim().min(1, 'profile_id is required and must be a string'),
  sector: z.string().trim().min(1, 'sector is required and must be a string'),
  subsector: z.string().trim().min(1, 'subsector is required and must be a string'),
  version: z.int().positive('version must be a positive integer'),
  effective_date: z.string().trim().min(1, 'effective_date is required and must be a date string'),
  status: profileStatusSchema,
  description: z.string().optional().nullable(),
});

export type ExpansionProfileUpsertInput = z.infer<typeof expansionProfileUpsertSchema>;

export function parseExpansionProfileUpsert(body: unknown): ExpansionProfileUpsertInput {
  return expansionProfileUpsertSchema.parse(body);
}
