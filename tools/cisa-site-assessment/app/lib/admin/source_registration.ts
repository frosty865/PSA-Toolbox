/**
 * Source Registration Utility
 * 
 * Registers sources from module-curated OFCs into source_registry (CORPUS).
 * Handles deduplication by canonical_url or source_key.
 */

import { getCorpusPool } from "@/app/lib/db/corpus_client";
import { normalizeKey } from "@/app/lib/sourceRegistry/schema";
import { getPublisherFromSources } from "@/app/lib/sourceRegistry/publisherNormalizer";

/**
 * Normalize URL for duplicate detection
 * Removes trailing slashes, www prefix, and normalizes protocol
 */
function normalizeUrlForDeduplication(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove www prefix
    if (urlObj.hostname.startsWith('www.')) {
      urlObj.hostname = urlObj.hostname.substring(4);
    }
    // Remove trailing slash from pathname
    urlObj.pathname = urlObj.pathname.replace(/\/$/, '');
    // Normalize to https (for comparison purposes)
    urlObj.protocol = 'https:';
    return urlObj.toString();
  } catch {
    return url.trim().toLowerCase();
  }
}

export type SourceRegistrationResult = {
  source_key: string;
  was_new: boolean;
};

/**
 * Generate a source_key from a URL or reference text.
 * Falls back to a hash-based key if URL parsing fails.
 */
function generateSourceKey(urlOrReference: string): string {
  try {
    // Try to parse as URL
    const url = new URL(urlOrReference);
    const hostname = url.hostname.replace(/^www\./, "");
    const pathParts = url.pathname
      .split("/")
      .filter((p) => p && !p.includes("."))
      .slice(-2); // Last 2 meaningful path segments
    
    // Extract filename if present
    const filename = url.pathname.split("/").pop()?.replace(/\.[^.]+$/, "") || "";
    
    // Build key from hostname + path/filename
    const parts = [hostname.split(".")[0], ...pathParts];
    if (filename && !pathParts.includes(filename)) {
      parts.push(filename);
    }
    
    // Normalize and create key
    const baseKey = parts
      .filter(Boolean)
      .join("_")
      .replace(/[^A-Z0-9_]/gi, "_")
      .replace(/_+/g, "_")
      .toUpperCase();
    
    // Ensure it starts with a letter and meets length requirements
    let key = baseKey.startsWith("_") ? `SRC${baseKey}` : baseKey;
    if (key.length < 6) {
      key = `${key}_REF`;
    }
    if (key.length > 64) {
      key = key.substring(0, 64);
    }
    
    return normalizeKey(key);
  } catch {
    // Not a URL, use reference text
    const normalized = normalizeKey(urlOrReference);
    if (normalized.length < 6) {
      return `SRC_${normalized}_REF`;
    }
    if (normalized.length > 64) {
      return normalized.substring(0, 64);
    }
    return normalized;
  }
}

/**
 * Extract publisher from URL or reference text.
 * Uses the publisher normalizer for consistent naming.
 */
function extractPublisher(urlOrReference: string, providedPublisher?: string | null): string {
  // Try to get publisher from multiple sources
  const publisher = getPublisherFromSources(providedPublisher, urlOrReference, null);
  
  if (publisher) {
    return publisher;
  }
  
  // Fallback: try to extract from URL domain
  try {
    const url = new URL(urlOrReference);
    const hostname = url.hostname.replace(/^www\./, "");
    const domainParts = hostname.split(".");
    
    if (domainParts.length >= 2) {
      const org = domainParts[domainParts.length - 2];
      const normalized = getPublisherFromSources(null, urlOrReference, null);
      if (normalized) {
        return normalized;
      }
      // Fallback capitalization
      return org.charAt(0).toUpperCase() + org.slice(1).toLowerCase();
    }
    return hostname.split(".")[0].charAt(0).toUpperCase() + 
           hostname.split(".")[0].slice(1).toLowerCase();
  } catch {
    // Extract from reference text (e.g., "Publisher - Title")
    const parts = urlOrReference.split(" - ");
    if (parts.length > 1) {
      const extracted = parts[0].trim();
      const normalized = getPublisherFromSources(extracted, null, null);
      return normalized || extracted;
    }
    // Don't return "Unknown Publisher" - return empty string so caller can handle
    return "";
  }
}

/**
 * Determine source type from URL or reference.
 */
function determineSourceType(urlOrReference: string): "pdf" | "web" | "doc" {
  try {
    const url = new URL(urlOrReference);
    const path = url.pathname.toLowerCase();
    if (path.endsWith(".pdf")) return "pdf";
    if (path.endsWith(".doc") || path.endsWith(".docx")) return "doc";
    return "web";
  } catch {
    // Check reference text
    const lower = urlOrReference.toLowerCase();
    if (lower.includes(".pdf")) return "pdf";
    if (lower.includes(".doc")) return "doc";
    return "web";
  }
}

/**
 * Register a source in source_registry if it doesn't already exist.
 * Checks by canonical_url first, then by source_key, then by publisher+title.
 * 
 * @param urlOrReference Source URL or reference text
 * @param sourceLabel Optional label/description
 * @param providedPublisher Optional publisher name (takes priority over URL extraction)
 * @returns source_key and whether it was newly created
 */
export async function registerSourceIfNew(
  urlOrReference: string,
  sourceLabel?: string | null,
  providedPublisher?: string | null
): Promise<SourceRegistrationResult> {
  const pool = getCorpusPool();
  const trimmedUrl = (urlOrReference || "").trim();
  
  if (!trimmedUrl) {
    throw new Error("URL or reference is required");
  }
  
  // Normalize URL for duplicate checking (remove trailing slashes, www, etc.)
  const normalizedUrl = normalizeUrlForDeduplication(trimmedUrl);
  
  // Check if source already exists by canonical_url (exact match)
  const existingByUrl = await pool.query(
    `SELECT source_key FROM public.source_registry WHERE canonical_url = $1`,
    [trimmedUrl]
  );
  
  if (existingByUrl.rows.length > 0) {
    return {
      source_key: existingByUrl.rows[0].source_key,
      was_new: false,
    };
  }
  
  // Check by normalized URL (handles www vs non-www, trailing slash variations)
  if (normalizedUrl !== trimmedUrl) {
    const existingByNormalizedUrl = await pool.query(
      `SELECT source_key FROM public.source_registry 
       WHERE canonical_url = $1 OR canonical_url = $2`,
      [normalizedUrl, trimmedUrl]
    );
    
    if (existingByNormalizedUrl.rows.length > 0) {
      return {
        source_key: existingByNormalizedUrl.rows[0].source_key,
        was_new: false,
      };
    }
  }
  
  // Generate source_key
  const sourceKey = generateSourceKey(trimmedUrl);
  
  // Check if source_key already exists
  const existingByKey = await pool.query(
    `SELECT source_key FROM public.source_registry WHERE source_key = $1`,
    [sourceKey]
  );
  
  if (existingByKey.rows.length > 0) {
    return {
      source_key: existingByKey.rows[0].source_key,
      was_new: false,
    };
  }
  
  // Extract metadata
  const publisher = extractPublisher(trimmedUrl, providedPublisher);
  const sourceType = determineSourceType(trimmedUrl);
  const title = sourceLabel || trimmedUrl;
  
  // Additional duplicate check: publisher + title combination
  if (publisher && title) {
    const existingByPublisherTitle = await pool.query(
      `SELECT source_key FROM public.source_registry 
       WHERE publisher = $1 AND title = $2`,
      [publisher, title]
    );
    
    if (existingByPublisherTitle.rows.length > 0) {
      return {
        source_key: existingByPublisherTitle.rows[0].source_key,
        was_new: false,
      };
    }
  }
  
  // Don't insert if publisher is empty (should be provided explicitly)
  if (!publisher || publisher.trim() === "") {
    throw new Error(`Publisher is required. Could not extract publisher from: ${trimmedUrl}`);
  }
  
  // Insert new source (tier 3 = external/tertiary source)
  // For module-curated OFCs, these are typically external references
  const insertResult = await pool.query(
    `
    INSERT INTO public.source_registry (
      source_key,
      publisher,
      tier,
      title,
      source_type,
      canonical_url,
      notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (source_key) DO NOTHING
    RETURNING source_key
    `,
    [
      sourceKey,
      publisher.substring(0, 120), // Truncate to max length
      3, // Tier 3: External/tertiary sources
      title.substring(0, 200), // Truncate to max length
      sourceType,
      trimmedUrl,
      `Auto-registered from module-curated OFC import`,
    ]
  );
  
  // Check if insert actually happened (ON CONFLICT DO NOTHING returns no rows if conflict)
  if (insertResult.rows.length === 0) {
    // Conflict occurred, source already exists - fetch the existing source_key
    const existing = await pool.query(
      `SELECT source_key FROM public.source_registry WHERE source_key = $1`,
      [sourceKey]
    );
    if (existing.rows.length > 0) {
      return {
        source_key: existing.rows[0].source_key,
        was_new: false,
      };
    }
    // Fallback: return the generated key even if insert failed
    return {
      source_key: sourceKey,
      was_new: false,
    };
  }
  
  return {
    source_key: insertResult.rows[0].source_key,
    was_new: true,
  };
}

/**
 * Register multiple sources, returning a map of URL -> source_key.
 */
export async function registerSources(
  sources: Array<{ url: string; label?: string | null }>
): Promise<Map<string, string>> {
  const urlToKey = new Map<string, string>();
  
  // Deduplicate sources by URL or label (for reference-only sources)
  const uniqueSources = new Map<string, { url: string; label: string | null }>();
  for (const src of sources) {
    const url = (src.url || "").trim();
    const label = (src.label || "").trim();
    
    // Use URL as key if present, otherwise use label
    const key = url || label;
    if (key && !uniqueSources.has(key)) {
      uniqueSources.set(key, { url, label: label || null });
    }
  }
  
  // Register each unique source
  for (const [key, { url, label }] of uniqueSources) {
    try {
      // For reference-only sources (empty URL), use label as the reference
      const urlOrReference = url || label || key;
      if (!urlOrReference) continue;
      
      const result = await registerSourceIfNew(urlOrReference, label);
      urlToKey.set(key, result.source_key);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[Source Registration] Failed to register source ${key}:`, msg);
      // Continue with other sources even if one fails
    }
  }
  
  return urlToKey;
}
