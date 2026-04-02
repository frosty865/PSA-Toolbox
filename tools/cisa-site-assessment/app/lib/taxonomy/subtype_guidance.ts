/**
 * Subtype Guidance Lookup Module
 * 
 * Provides runtime access to subtype guidance content from taxonomy/discipline_subtypes.json.
 * Guidance content is derived from taxonomy, not stored in baseline_spines_runtime.
 * 
 * Uses in-memory caching to avoid reparsing JSON on every request.
 */

import * as fs from 'fs';
import * as path from 'path';

export type SubtypeGuidance = {
  overview?: string;
  indicators_of_risk?: string[];
  common_failures?: string[];
  mitigation_guidance?: string[];
  standards_references?: string[];
  psa_notes?: string;
};

interface SubtypeEntry {
  subtype_code: string;
  name: string;
  discipline_code: string;
  discipline_name?: string;
  guidance?: SubtypeGuidance;
}

interface TaxonomyData {
  subtypes?: SubtypeEntry[];
}

// In-memory cache
let taxonomyCache: Map<string, { 
  name: string; 
  discipline_code: string; 
  discipline_name?: string;
  guidance: SubtypeGuidance | null 
}> | null = null;
let cacheLoadError: Error | null = null;
let cacheFileMtime: number | null = null;

function loadTaxonomy(): Map<string, { 
  name: string; 
  discipline_code: string; 
  discipline_name?: string;
  guidance: SubtypeGuidance | null 
}> {
  const taxonomyPath = path.join(process.cwd(), 'taxonomy', 'discipline_subtypes.json');
  
  // Check if file has been modified since last cache load
  let shouldReload = true;
  try {
    if (fs.existsSync(taxonomyPath)) {
      const stats = fs.statSync(taxonomyPath);
      const currentMtime = stats.mtimeMs;
      
      // If cache exists and file hasn't changed, return cached data
      if (taxonomyCache !== null && cacheFileMtime !== null && cacheFileMtime === currentMtime) {
        return taxonomyCache;
      }
      
      // File changed or cache doesn't exist - update mtime for next check
      cacheFileMtime = currentMtime;
      shouldReload = true;
    }
  } catch (statError) {
    // If stat fails, proceed to load/reload anyway
    console.warn('[subtype_guidance] Could not check file modification time:', statError instanceof Error ? statError.message : statError);
    shouldReload = true;
  }
  
  // If we determined we should reload, clear the cache
  if (shouldReload) {
    taxonomyCache = null;
    cacheLoadError = null;
  }

  // If previous load failed, return empty map
  if (cacheLoadError !== null) {
    console.warn('[subtype_guidance] Using empty cache due to previous load error:', cacheLoadError.message);
    return new Map();
  }
  
  try {
    if (!fs.existsSync(taxonomyPath)) {
      throw new Error(`Taxonomy file not found: ${taxonomyPath}`);
    }
    
    const taxonomyData: TaxonomyData = JSON.parse(fs.readFileSync(taxonomyPath, 'utf-8'));
    const map = new Map<string, { 
      name: string; 
      discipline_code: string; 
      discipline_name?: string;
      guidance: SubtypeGuidance | null 
    }>();
    
    if (taxonomyData.subtypes && Array.isArray(taxonomyData.subtypes)) {
      for (const subtype of taxonomyData.subtypes) {
        if (subtype.subtype_code && subtype.name) {
          map.set(subtype.subtype_code, {
            name: subtype.name,
            discipline_code: subtype.discipline_code || '',
            discipline_name: subtype.discipline_name,
            guidance: subtype.guidance || null
          });
        }
      }
    }
    
    taxonomyCache = map;
    console.log(`[subtype_guidance] Loaded ${map.size} subtypes from taxonomy`);
    return map;
  } catch (error) {
    cacheLoadError = error instanceof Error ? error : new Error(String(error));
    console.error('[subtype_guidance] Failed to load taxonomy:', cacheLoadError.message);
    // Return empty map on error
    return new Map();
  }
}

/**
 * Get guidance content for a subtype by subtype_code.
 * Returns null if subtype not found or has no guidance content.
 */
export function getSubtypeGuidance(subtype_code: string | null | undefined): SubtypeGuidance | null {
  if (!subtype_code) {
    return null;
  }
  
  const taxonomy = loadTaxonomy();
  const entry = taxonomy.get(subtype_code);
  
  // Debug: Log first few lookups
  if (taxonomy.size > 0 && (subtype_code.includes('ACS_') || subtype_code.includes('COM_'))) {
    console.log(`[getSubtypeGuidance] Looking up ${subtype_code}:`, {
      found: !!entry,
      hasGuidance: !!entry?.guidance,
      hasOverview: !!entry?.guidance?.overview,
      taxonomySize: taxonomy.size
    });
  }
  
  return entry?.guidance || null;
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
 * Get full subtype info (name, discipline_code, discipline_name, guidance) by subtype_code.
 * Returns null if subtype not found.
 */
export function getSubtypeInfo(subtype_code: string | null | undefined): {
  name: string;
  discipline_code: string;
  discipline_name?: string;
  guidance: SubtypeGuidance | null;
} | null {
  if (!subtype_code) {
    return null;
  }
  
  const taxonomy = loadTaxonomy();
  const entry = taxonomy.get(subtype_code);
  return entry || null;
}

/**
 * Get discipline name by discipline_code.
 * Looks up any subtype with the given discipline_code and returns its discipline_name.
 * Returns null if no subtype found for the discipline_code.
 */
export function getDisciplineName(discipline_code: string | null | undefined): string | null {
  if (!discipline_code) {
    return null;
  }
  
  const taxonomy = loadTaxonomy();
  // Find any subtype with this discipline_code (all subtypes in a discipline share the same discipline_name)
  for (const entry of taxonomy.values()) {
    if (entry.discipline_code === discipline_code) {
      return entry.discipline_name || null;
    }
  }
  
  return null;
}

/**
 * Get subtype guidance by discipline_subtype_id (UUID) from database.
 * 
 * DB-BACKED: Queries public.discipline_subtypes table directly.
 * Returns only Overview and References for baseline UI (no risk/failure/mitigation blocks).
 * 
 * This is the authoritative source for subtype overview when discipline_subtype_id is present.
 * Used as fallback when Reference Implementation is not available.
 * 
 * @param disciplineSubtypeId - UUID of the discipline subtype
 * @returns Overview and References, or null if not found
 */
export async function getSubtypeGuidanceById(disciplineSubtypeId: string): Promise<{ overview: string; references?: string[] } | null> {
  if (!disciplineSubtypeId || !disciplineSubtypeId.trim()) {
    return null;
  }

  try {
    // Dynamic import to avoid server-side issues in client components
    const { getRuntimePool } = await import('../db/runtime_client');
    const pool = getRuntimePool();
    
    // Query database directly - this is the authoritative source
    const result = await pool.query(`
      SELECT overview, standards_references
      FROM public.discipline_subtypes
      WHERE id = $1 AND is_active = true
      LIMIT 1
    `, [disciplineSubtypeId.trim()]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      overview: row.overview || '',
      references: Array.isArray(row.standards_references) ? row.standards_references : []
    };
  } catch (error) {
    console.error('[getSubtypeGuidanceById] Error querying database:', error);
    return null;
  }
}

/**
 * Clear the in-memory cache (useful for testing or reloading taxonomy).
 */
export function clearCache(): void {
  taxonomyCache = null;
  cacheLoadError = null;
  cacheFileMtime = null;
}
