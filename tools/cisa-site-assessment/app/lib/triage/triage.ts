import fs from "node:fs";
import path from "node:path";
import { createHash } from "crypto";

export interface TriageDecision {
  kind: 'SECTOR' | 'SUBSECTOR' | 'MODULE' | 'UNKNOWN';
  sector?: string;
  subsector?: string;
  moduleCode?: string;
  rule?: string;
}

export interface TriageItem {
  absolutePath: string;
  destinationPath: string;
  sha256: string;
  decision: TriageDecision;
}

function cleanPathSegment(segment: string): string {
  // Keep triage destinations inside the configured roots by stripping separators.
  return segment.trim().replace(/[\\/]+/g, "_");
}

function buildDestPath(root: string, ...segments: string[]): string {
  let out = root;
  for (const raw of segments) {
    const seg = cleanPathSegment(raw);
    if (!seg) continue;
    out = `${out}${path.sep}${seg}`;
  }
  return path.normalize(out);
}

/**
 * Scan for files in a directory recursively, respecting ignore patterns
 */
export function scanForFiles(
  root: string,
  ignoreFolders: string[],
  allowedExts: string[]
): string[] {
  const results: string[] = [];
  
  if (!fs.existsSync(root)) {
    return results;
  }
  
  function walk(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip ignored folders
        if (entry.isDirectory()) {
          const shouldIgnore = ignoreFolders.some(ignore => 
            entry.name.toLowerCase() === ignore.toLowerCase() ||
            fullPath.toLowerCase().includes(ignore.toLowerCase())
          );
          if (!shouldIgnore) {
            walk(fullPath);
          }
          continue;
        }
        
        // Check extension
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (allowedExts.includes(ext)) {
            results.push(fullPath);
          }
        }
      }
    } catch (err) {
      // Skip directories we can't read
      console.warn(`[Triage] Cannot read directory ${dir}:`, err);
    }
  }
  
  walk(root);
  return results;
}

/**
 * Canonical sector normalization map
 * CRITICAL: nuclear_reactors,_materials,_and_waste MUST normalize to nuclear_reactors_materials_and_waste
 */
const CANONICAL_SECTOR_MAP: Record<string, string> = {
  "nuclear_reactors,_materials,_and_waste": "nuclear_reactors_materials_and_waste",
  "nuclear_reactors_materials_and_waste": "nuclear_reactors_materials_and_waste",
  "Nuclear_Reactors,_Materials,_and_Waste": "nuclear_reactors_materials_and_waste",
  "Nuclear_Reactors_Materials_and_Waste": "nuclear_reactors_materials_and_waste",
};

function canonicalSector(s: string): string {
  const raw = (s || "").trim();
  const key = raw.toLowerCase();
  if (CANONICAL_SECTOR_MAP[key]) return CANONICAL_SECTOR_MAP[key];
  return raw;
}

/**
 * Compute SHA256 hash of a file
 */
function sha256File(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Triage one file: determine destination and compute hash
 */
export function triageOne(params: {
  libraryRoot: string;
  incomingRoot: string;
  defaults: { sector?: string; subsector?: string | null; module?: string | null };
  moduleFolder: string;
  absPath: string;
}): TriageItem {
  const { libraryRoot, incomingRoot: _incomingRoot, defaults, moduleFolder, absPath } = params;
  void _incomingRoot;
  
  // Compute hash
  const sha256 = sha256File(absPath);
  
  // For now, use default triage logic (can be enhanced later)
  // TODO: Add actual triage decision logic based on file content/metadata
  const decision: TriageDecision = {
    kind: 'SECTOR',
    sector: defaults.sector || 'general',
    rule: 'default_triage',
  };
  
  // Apply canonical sector normalization
  if (decision.sector) {
    decision.sector = canonicalSector(decision.sector);
  }
  
  // Build destination path
  let destinationPath: string;
  const filename = cleanPathSegment(path.basename(absPath));
  
  if (decision.kind === 'MODULE' && decision.moduleCode) {
    destinationPath = buildDestPath(
      libraryRoot,
      moduleFolder,
      decision.moduleCode,
      filename
    );
  } else if (decision.kind === 'SECTOR') {
    const sector = decision.sector?.trim() || 'general';
    if (decision.subsector) {
      destinationPath = buildDestPath(libraryRoot, sector, decision.subsector, filename);
    } else {
      destinationPath = buildDestPath(libraryRoot, sector, filename);
    }
  } else {
    // Unknown - move to general
    destinationPath = buildDestPath(libraryRoot, 'general', filename);
  }
  
  return {
    absolutePath: absPath,
    destinationPath,
    sha256,
    decision,
  };
}

/**
 * Safely move a file, creating parent directories if needed
 */
export function safeMove(source: string, dest: string): void {
  // Ensure destination directory exists
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // Move file
  fs.renameSync(source, dest);
}
