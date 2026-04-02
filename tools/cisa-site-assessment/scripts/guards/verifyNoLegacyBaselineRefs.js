#!/usr/bin/env node
/**
 * Legacy Baseline Reference Guard
 * 
 * Fails build if legacy baseline sources are referenced in code.
 * This enforces the cutover to baseline_spines_runtime (DB) via Next.js API route (consolidated).
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(process.argv[2] || process.cwd());

// Patterns that indicate legacy baseline usage (case-insensitive)
const FORBIDDEN_PATTERNS = [
  {
    pattern: /baseline_questions_registry/i,
    description: "baseline_questions_registry (file-based registry)"
  },
  {
    pattern: /baseline.*registry.*\.json/i,
    description: "baseline registry JSON files"
  },
  {
    pattern: /legacy_baseline/i,
    description: "legacy_baseline references"
  },
  {
    pattern: /baseline.*fixtures/i,
    description: "baseline fixtures"
  },
  {
    pattern: /required_elements_healthcare/i,
    description: "required_elements_healthcare (legacy fixture)"
  },
  {
    pattern: /assessment_detail_healthcare/i,
    description: "assessment_detail_healthcare (legacy fixture)"
  },
  {
    pattern: /analytics\/runtime\/baseline/i,
    description: "analytics/runtime/baseline file paths"
  },
  {
    pattern: /baselineTransform/i,
    description: "baselineTransform (transform layer removed - use canon_id directly)"
  },
  {
    pattern: /transformSpineToElement/i,
    description: "transformSpineToElement (transform function removed - use BaselineSpine directly)"
  },
];

// Files/directories to exclude from scanning
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.next/,
  /\.git/,
  /package-lock\.json/,
  /yarn\.lock/,
  /pnpm-lock\.yaml/,
  /\.log$/,
  // Exclude this guard script itself
  /verifyNoLegacyBaselineRefs\.js/,
  // Exclude documentation files (they may reference legacy for historical context)
  /\.md$/,
  // Exclude archive directories
  /archive\//,
  // Exclude broken/archived code
  /app_broken/,
  // Exclude psa_engine doctrine files (source data, not runtime code)
  /psa_engine/,
  // Exclude analytics reports (data files, not code)
  /analytics\/reports/,
  // Exclude test fixtures that may intentionally test legacy behavior
  /__tests__/,
  /test.*fixtures/,
];

// File extensions to scan (exclude .json - data files, not code)
const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

function shouldExclude(filePath) {
  const relPath = path.relative(ROOT, filePath);
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(relPath));
}

function shouldScan(filePath) {
  if (shouldExclude(filePath)) {
    return false;
  }
  const ext = path.extname(filePath);
  return SCAN_EXTENSIONS.includes(ext);
}

function walk(dir, out = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(dir, ent.name);
      
      if (ent.isDirectory()) {
        if (!shouldExclude(fullPath)) {
          walk(fullPath, out);
        }
      } else if (ent.isFile() && shouldScan(fullPath)) {
        out.push(fullPath);
      }
    }
  } catch (err) {
    // Ignore permission errors, etc.
    if (err.code !== 'EACCES' && err.code !== 'ENOENT') {
      console.warn(`Warning: Could not read ${dir}: ${err.message}`);
    }
  }
  return out;
}

function scanFile(filePath) {
  const hits = [];
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const { pattern, description } of FORBIDDEN_PATTERNS) {
      if (pattern.test(content)) {
        // Find line numbers for better error messages
        const lines = content.split('\n');
        const matchingLines = [];
        lines.forEach((line, idx) => {
          if (pattern.test(line)) {
            matchingLines.push({ line: idx + 1, content: line.trim().substring(0, 100) });
          }
        });
        hits.push({
          file: filePath,
          pattern: description,
          lines: matchingLines,
        });
      }
    }
  } catch (err) {
    if (err.code !== 'EACCES') {
      console.warn(`Warning: Could not read ${filePath}: ${err.message}`);
    }
  }
  return hits;
}

// Main execution
console.log(`[GUARD] Scanning for legacy baseline references in: ${ROOT}`);
console.log(`[GUARD] Excluding: node_modules, .next, .git, *.md, archive/, test fixtures\n`);

const files = walk(ROOT);
console.log(`[GUARD] Scanned ${files.length} files\n`);

let allHits = [];
for (const file of files) {
  const hits = scanFile(file);
  allHits.push(...hits);
}

if (allHits.length > 0) {
  console.error(`[FAIL] Legacy baseline references detected (${allHits.length} violations):\n`);
  
  // Group by file for cleaner output
  const byFile = new Map();
  for (const hit of allHits) {
    if (!byFile.has(hit.file)) {
      byFile.set(hit.file, []);
    }
    byFile.get(hit.file).push(hit);
  }
  
  let shown = 0;
  const MAX_SHOWN = 50;
  for (const [file, hits] of byFile.entries()) {
    if (shown >= MAX_SHOWN) {
      console.error(`\n... and ${allHits.length - shown} more violations (truncated)`);
      break;
    }
    
    const relPath = path.relative(ROOT, file);
    console.error(`  ${relPath}:`);
    for (const hit of hits) {
      console.error(`    - ${hit.pattern}`);
      if (hit.lines && hit.lines.length > 0) {
        for (const { line, content } of hit.lines.slice(0, 3)) {
          console.error(`      Line ${line}: ${content}`);
        }
        if (hit.lines.length > 3) {
          console.error(`      ... and ${hit.lines.length - 3} more lines`);
        }
      }
      shown++;
      if (shown >= MAX_SHOWN) break;
    }
    if (shown >= MAX_SHOWN) break;
  }
  
  console.error(`\n[FAIL] Build blocked: Remove legacy baseline references and use baselineLoader.ts instead.`);
  console.error(`[INFO] See: app/lib/baselineLoader.ts for the new API-based approach.`);
  process.exit(1);
}

console.log(`[OK] No legacy baseline references detected.`);
console.log(`[OK] All baseline data is sourced from baseline_spines_runtime (DB) via Next.js API route (consolidated).`);
