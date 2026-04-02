/**
 * Subtype Help Lookup Module
 * 
 * Provides runtime access to subtype help content from taxonomy/discipline_subtypes.json.
 * Help content is derived from taxonomy, not stored in baseline_spines_runtime.
 * 
 * Uses in-memory caching to avoid reparsing JSON on every request.
 */

import * as fs from 'fs';
import * as path from 'path';

export type SubtypeHelp = {
  overview?: string | null;
  indicators_of_risk?: string[];
  common_failures?: string[];
  mitigation_guidance?: string[];
  standards_references?: string[];
  psa_notes?: string | null;
};

interface SubtypeEntry {
  subtype_code: string;
  name: string;
  discipline_code: string;
  help?: SubtypeHelp;
}

interface TaxonomyData {
  subtypes?: SubtypeEntry[];
}

// In-memory cache
let taxonomyCache: Map<string, { name: string; discipline_code: string; help: SubtypeHelp | null }> | null = null;
let cacheLoadError: Error | null = null;

function loadTaxonomy(): Map<string, { name: string; discipline_code: string; help: SubtypeHelp | null }> {
  // Return cached data if available
  if (taxonomyCache !== null) {
    return taxonomyCache;
  }

  // If previous load failed, return empty map
  if (cacheLoadError !== null) {
    console.warn('[subtypeHelp] Using empty cache due to previous load error:', cacheLoadError.message);
    return new Map();
  }

  const taxonomyPath = path.join(process.cwd(), 'taxonomy', 'discipline_subtypes.json');
  
  try {
    if (!fs.existsSync(taxonomyPath)) {
      throw new Error(`Taxonomy file not found: ${taxonomyPath}`);
    }
    
    const taxonomyData: TaxonomyData = JSON.parse(fs.readFileSync(taxonomyPath, 'utf-8'));
    const map = new Map<string, { name: string; discipline_code: string; help: SubtypeHelp | null }>();
    
    if (taxonomyData.subtypes && Array.isArray(taxonomyData.subtypes)) {
      for (const subtype of taxonomyData.subtypes) {
        if (subtype.subtype_code && subtype.name) {
          map.set(subtype.subtype_code, {
            name: subtype.name,
            discipline_code: subtype.discipline_code || '',
            help: subtype.help || null
          });
        }
      }
    }
    
    taxonomyCache = map;
    console.log(`[subtypeHelp] Loaded ${map.size} subtypes from taxonomy`);
    return map;
  } catch (error) {
    cacheLoadError = error instanceof Error ? error : new Error(String(error));
    console.error('[subtypeHelp] Failed to load taxonomy:', cacheLoadError.message);
    // Return empty map on error
    return new Map();
  }
}

/**
 * Get help content for a subtype by subtype_code.
 * Returns null if subtype not found or has no help content.
 */
export function getSubtypeHelp(subtype_code: string | null | undefined): SubtypeHelp | null {
  if (!subtype_code) {
    return null;
  }
  
  const taxonomy = loadTaxonomy();
  const entry = taxonomy.get(subtype_code);
  return entry?.help || null;
}

/**
 * Get subtype name by subtype_code.
 * Returns null if subtype not found.
 */
export function getSubtypeName(subtype_code: string | null | undefined): string | null {
  if (!subtype_code) {
    return null;
  }
  
  const taxonomy = loadTaxonomy();
  const entry = taxonomy.get(subtype_code);
  return entry?.name || null;
}

/**
 * Get full subtype info (name, discipline_code, help) by subtype_code.
 * Returns null if subtype not found.
 */
export function getSubtypeInfo(subtype_code: string | null | undefined): {
  name: string;
  discipline_code: string;
  help: SubtypeHelp | null;
} | null {
  if (!subtype_code) {
    return null;
  }
  
  const taxonomy = loadTaxonomy();
  const entry = taxonomy.get(subtype_code);
  return entry || null;
}

/**
 * Clear the in-memory cache (useful for testing or reloading taxonomy).
 */
export function clearCache(): void {
  taxonomyCache = null;
  cacheLoadError = null;
}
