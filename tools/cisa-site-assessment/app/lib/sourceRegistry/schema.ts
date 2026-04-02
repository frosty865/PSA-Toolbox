import { z } from "zod";
import { normalizePublisherName, isUnacceptablePublisher } from "./publisherNormalizer";

/**
 * Deterministic normalizers
 */
export function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function normalizeKey(raw: string): string {
  // collapse whitespace, remove spaces entirely, then uppercase
  const collapsed = collapseWhitespace(raw);
  const noSpaces = collapsed.replace(/ /g, "");
  const uppercased = noSpaces.toUpperCase();
  
  // Truncate to max 50 characters to keep source keys manageable
  // Keep at least 6 chars (minimum requirement), but prefer shorter
  if (uppercased.length > 50) {
    // Try to truncate at a word boundary (underscore or dash)
    const truncated = uppercased.substring(0, 50);
    const lastUnderscore = truncated.lastIndexOf('_');
    const lastDash = truncated.lastIndexOf('-');
    const lastBoundary = Math.max(lastUnderscore, lastDash);
    
    if (lastBoundary > 30) {
      // Use boundary if it's not too short
      return truncated.substring(0, lastBoundary);
    }
    return truncated;
  }
  
  return uppercased;
}

export function normalizeText(raw: string): string {
  return collapseWhitespace(raw);
}

export function normalizeOptionalText(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length ? t : null;
}

const AuthorityTierEnum = z.enum([
  "BASELINE_AUTHORITY",
  "SECTOR_AUTHORITY",
  "SUBSECTOR_AUTHORITY",
]);

const StatusEnum = z.enum(["ACTIVE", "INACTIVE"]);

/**
 * Banned substring guard (case-insensitive)
 */
export function assertNoBannedSubstrings(fields: Record<string, string | null | undefined>) {
  const banned = ["safe", "legacy"];
  for (const [k, v] of Object.entries(fields)) {
    if (!v) continue;
    const lower = v.toLowerCase();
    for (const b of banned) {
      if (lower.includes(b)) {
        throw new Error(`Field '${k}' contains banned substring '${b}'.`);
      }
    }
  }
}

/**
 * Zod field validators
 */
const SourceKey = z
  .string()
  .transform((v) => normalizeKey(v))
  .refine((v) => v.length >= 6, "source_key must be at least 6 characters after normalization")
  .refine((v) => v.length <= 50, "source_key must be at most 50 characters (prefer shorter keys)")
  .refine((v) => /^[A-Z][A-Z0-9_]*$/.test(v), "source_key must match: starts with a letter, then A-Z, 0-9, underscore only");

const Publisher = z
  .string()
  .min(2, "publisher must be at least 2 characters")
  .max(120, "publisher must be at most 120 characters")
  .transform((v) => {
    // Normalize publisher name using the publisher normalizer
    const normalized = normalizePublisherName(v);
    return normalized || normalizeText(v);
  })
  .refine((v) => !isUnacceptablePublisher(v), "publisher cannot be Unknown, Local File, Module Source, or Unspecified");

/** Display label when title is missing (do not store; use null). */
export const DISPLAY_MISSING_TITLE = "—";

/** Unacceptable document title values (case-insensitive); must not be stored. Keep parsing until a real value is found. */
const UNACCEPTABLE_TITLES = new Set([
  "untitled",
  "document",
  "unknown",
  "unnamed",
  "(no title)",
  "no title",
  "counting", // section label, not a document title
]);

export function isUnacceptableTitle(title: string | null | undefined): boolean {
  if (title == null) return false;
  let key = title.trim().toLowerCase();
  // "counting -" / "title —" → normalize trailing dash
  if (key.endsWith(" -")) key = key.slice(0, -2).trim();
  if (key.endsWith("- ")) key = key.slice(0, -2).trim();
  if (key.endsWith(" —")) key = key.slice(0, -2).trim();
  if (key.endsWith("— ")) key = key.slice(0, -2).trim();
  if (key === "-" || key === "—" || key === "") return true;
  return key.length > 0 && UNACCEPTABLE_TITLES.has(key);
}

const Title = z
  .string()
  .min(4, "title must be at least 4 characters")
  .max(200, "title must be at most 200 characters")
  .transform((v) => normalizeText(v))
  .refine((v) => !isUnacceptableTitle(v), "title cannot be Untitled, Document, Unknown, Unnamed, counting, or (no title)");

const Description = z
  .string()
  .max(2000, "description must be at most 2000 characters")
  .transform((v) => v.trim())
  .nullable()
  .optional();

const Notes = z
  .string()
  .max(2000, "notes must be at most 2000 characters")
  .transform((v) => v.trim())
  .nullable()
  .optional();

const Year = z
  .number()
  .int("year must be an integer")
  .min(1900, "year must be >= 1900")
  .max(2100, "year must be <= 2100")
  .nullable()
  .optional();

const Url = z
  .string()
  .url("url must be a valid URL")
  .transform((v) => v.trim())
  .nullable()
  .optional();

export const SourceRegistryCreateSchema = z
  .object({
    source_key: SourceKey,
    publisher: Publisher,
    title: Title,
    authority_tier: AuthorityTierEnum,
    status: StatusEnum,
    description: Description,
    year: Year,
    url: Url,
    notes: Notes,
  })
  .strict()
  .superRefine((obj, ctx) => {
    try {
      assertNoBannedSubstrings({
        source_key: obj.source_key,
        publisher: obj.publisher,
        title: obj.title,
        description: obj.description ?? null,
        notes: obj.notes ?? null,
      });
    } catch (e: unknown) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: e instanceof Error ? e.message : "Payload contains banned substrings",
      });
    }
  });

const ScopeTagsArray = z
  .array(z.string().min(1))
  .optional();

export const SourceRegistryUpdateSchema = z
  .object({
    // source_key is intentionally omitted from update
    publisher: Publisher.optional(),
    title: Title.optional(),
    authority_tier: AuthorityTierEnum.optional(),
    status: StatusEnum.optional(),
    description: Description,
    year: Year,
    url: Url,
    notes: Notes,
    /** Only discipline, subtype, module, sector, or subsector (validated at API layer). */
    scope_tags: ScopeTagsArray,
    /** When true, store scope_tags as { display: [...], tags: { library: 'technology' } } for Technology Library ingestion. */
    is_technology_library: z.boolean().optional(),
  })
  .strict()
  .superRefine((obj, ctx) => {
    try {
      assertNoBannedSubstrings({
        publisher: obj.publisher ?? null,
        title: obj.title ?? null,
        description: obj.description ?? null,
        notes: obj.notes ?? null,
        // source_key cannot be present because of .strict() + omitted field
      });
    } catch (e: unknown) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: e instanceof Error ? e.message : "Payload contains banned substrings",
      });
    }
  });

export type SourceRegistryCreateInput = z.infer<typeof SourceRegistryCreateSchema>;
export type SourceRegistryUpdateInput = z.infer<typeof SourceRegistryUpdateSchema>;

export function formatZodIssues(err: z.ZodError) {
  return err.issues.map((i) => ({
    path: i.path.join(".") || "(root)",
    message: i.message,
  }));
}

export type ValidationErrorWithIssues = Error & { issues: Array<{ path: string; message: string }> };

export function validateAndNormalizeCreate(payload: unknown): SourceRegistryCreateInput {
  const parsed = SourceRegistryCreateSchema.safeParse(payload);
  if (!parsed.success) {
    const e = new Error("VALIDATION_ERROR") as ValidationErrorWithIssues;
    e.issues = formatZodIssues(parsed.error);
    throw e;
  }
  // Normalize nullable optionals to null consistently
  return {
    ...parsed.data,
    description: normalizeOptionalText(parsed.data.description) ?? undefined,
    notes: normalizeOptionalText(parsed.data.notes) ?? undefined,
    url: normalizeOptionalText(parsed.data.url) ?? undefined,
    year: parsed.data.year ?? null,
  };
}

export function validateAndNormalizeUpdate(payload: unknown): SourceRegistryUpdateInput {
  const parsed = SourceRegistryUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    const e = new Error("VALIDATION_ERROR") as ValidationErrorWithIssues;
    e.issues = formatZodIssues(parsed.error);
    throw e;
  }
  const out: SourceRegistryUpdateInput = { ...parsed.data };
  if ("description" in out && out.description !== undefined) out.description = normalizeOptionalText(out.description) ?? undefined;
  if ("notes" in out && out.notes !== undefined) out.notes = normalizeOptionalText(out.notes) ?? undefined;
  if ("url" in out && out.url !== undefined) out.url = normalizeOptionalText(out.url) ?? undefined;
  if ("year" in out && out.year !== undefined) out.year = out.year ?? null;
  return out;
}

/**
 * Map API schema to DB schema
 * The DB uses: tier (1,2,3), source_type, publication_date, canonical_url, etc.
 * We map authority_tier -> tier, status -> stored in notes (since DB doesn't have status column)
 * source_type is determined from input: URL -> 'web', otherwise default to 'doc'
 */
export function mapCreateToDb(input: SourceRegistryCreateInput): {
  source_key: string;
  publisher: string;
  tier: number;
  title: string;
  publication_date: string | null;
  source_type: string;
  canonical_url: string | null;
  notes: string | null;
} {
  // Map authority_tier enum to tier number
  const tierMap: Record<string, number> = {
    BASELINE_AUTHORITY: 1,
    SECTOR_AUTHORITY: 2,
    SUBSECTOR_AUTHORITY: 3,
  };

  // Determine source_type from input: if URL is provided, it's 'web', otherwise 'doc'
  // (PDF files are handled separately in upload endpoint)
  const source_type = input.url ? 'web' : 'doc';

  // Extract year from input.year and format as publication_date
  const publication_date = input.year ? `${input.year}-01-01` : null;

  // Combine description, notes, and status
  const notesParts: string[] = [];
  if (input.description) {
    notesParts.push(`Description: ${input.description}`);
  }
  if (input.notes) {
    notesParts.push(input.notes);
  }
  // Store status in notes since DB doesn't have status column
  if (input.status) {
    notesParts.push(`Status: ${input.status}`);
  }
  const notes = notesParts.length > 0 ? notesParts.join('\n\n') : null;

  return {
    source_key: input.source_key,
    publisher: input.publisher,
    tier: tierMap[input.authority_tier],
    title: input.title,
    publication_date,
    source_type,
    canonical_url: input.url ?? null,
    notes,
  };
}

type MapUpdateToDbResult = Partial<{
  publisher: string;
  tier: number;
  title: string;
  publication_date: string | null;
  source_type: string;
  canonical_url: string | null;
  notes: string | null;
  scope_tags: string[] | import('@/app/lib/sourceRegistry/scope_tags').ScopeTag[];
  is_technology_library: boolean;
}>;

export function mapUpdateToDb(input: SourceRegistryUpdateInput): MapUpdateToDbResult {
  const result: MapUpdateToDbResult = {};

  if (input.publisher !== undefined) result.publisher = input.publisher;
  if (input.title !== undefined) result.title = input.title;

  if (input.authority_tier !== undefined) {
    const tierMap: Record<string, number> = {
      BASELINE_AUTHORITY: 1,
      SECTOR_AUTHORITY: 2,
      SUBSECTOR_AUTHORITY: 3,
    };
    result.tier = tierMap[input.authority_tier];
  }

  // Update source_type based on URL: if URL is provided/changed, set to 'web'
  // Note: We don't change source_type to 'doc' if URL is removed, to preserve existing 'pdf' sources
  if (input.url !== undefined && input.url) {
    result.source_type = 'web';
  }

  if (input.year !== undefined) {
    result.publication_date = input.year ? `${input.year}-01-01` : null;
  }

  if (input.url !== undefined) result.canonical_url = input.url ?? null;
  
  // Handle notes, description, and status together
  // Status is stored in notes since DB doesn't have status column
  if (input.notes !== undefined || input.description !== undefined || input.status !== undefined) {
    const notesParts: string[] = [];
    if (input.description !== undefined && input.description) {
      notesParts.push(`Description: ${input.description}`);
    }
    if (input.notes !== undefined && input.notes) {
      notesParts.push(input.notes);
    }
    if (input.status !== undefined) {
      notesParts.push(`Status: ${input.status}`);
    }
    result.notes = notesParts.length > 0 ? notesParts.join('\n\n') : null;
  }

  if (input.scope_tags !== undefined) {
    const raw = input.scope_tags;
    if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object' && raw[0] !== null && 'type' in (raw[0] as object) && 'code' in (raw[0] as object)) {
      result.scope_tags = raw as unknown as import('@/app/lib/sourceRegistry/scope_tags').ScopeTag[];
    } else {
      result.scope_tags = Array.isArray(raw) ? raw.filter((t): t is string => typeof t === 'string' && t.trim().length > 0) : [];
    }
  }

  if (input.is_technology_library !== undefined) {
    result.is_technology_library = !!input.is_technology_library;
  }

  return result;
}

/**
 * Extract status from notes field (since DB doesn't have status column)
 * Returns 'ACTIVE' if found, otherwise 'INACTIVE' as default
 */
export function extractStatusFromNotes(notes: string | null): 'ACTIVE' | 'INACTIVE' {
  if (!notes) return 'INACTIVE';
  const statusMatch = notes.match(/Status:\s*(ACTIVE|INACTIVE)/i);
  return statusMatch ? (statusMatch[1].toUpperCase() as 'ACTIVE' | 'INACTIVE') : 'INACTIVE';
}

/**
 * Extract description from notes field
 * Notes format: "Description: ...\n\nNotes...\n\nStatus: ..."
 */
export function extractDescriptionFromNotes(notes: string | null): string | null {
  if (!notes) return null;
  // Match "Description: " followed by content until next section (double newline or Status:)
  const descMatch = notes.match(/Description:\s*((?:[^\n]|\n(?!\n|Status:))+)/);
  if (descMatch) {
    return descMatch[1].trim();
  }
  return null;
}
