#!/usr/bin/env node
/**
 * Legacy Intent UI Guard
 * 
 * Fails build if legacy intent UI blocks are reintroduced in components.
 * Legacy intent blocks (Intent, What counts as YES, etc.) are REMOVED from the product path.
 * 
 * Only Reference Implementation and Subtype Overview are allowed.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(process.argv[2] || process.cwd());

// Patterns that indicate legacy intent UI rendering (case-insensitive)
const FORBIDDEN_PATTERNS = [
  {
    pattern: /What counts as YES/i,
    description: "What counts as YES (legacy intent block)"
  },
  {
    pattern: /What does NOT count/i,
    description: "What does NOT count (legacy intent block)"
  },
  {
    pattern: /Typical evidence/i,
    description: "Typical evidence (legacy intent block)"
  },
  {
    pattern: /Field tip/i,
    description: "Field tip (legacy intent block)"
  },
  {
    pattern: /Meaning not yet derived/i,
    description: "Meaning not yet derived (legacy intent placeholder)"
  },
];

// Legacy intent prop names that should not be used in IntentPanel
const FORBIDDEN_PROPS = [
  {
    pattern: /what_counts_as_yes/i,
    description: "what_counts_as_yes prop (legacy intent field)"
  },
  {
    pattern: /what_does_not_count/i,
    description: "what_does_not_count prop (legacy intent field)"
  },
  {
    pattern: /typical_evidence/i,
    description: "typical_evidence prop (legacy intent field)"
  },
  {
    pattern: /field_tip/i,
    description: "field_tip prop (legacy intent field)"
  },
];

// Directories to search (UI components only)
const SEARCH_DIRS = [
  path.join(ROOT, "app", "components"),
  path.join(ROOT, "app", "assessments"),
  path.join(ROOT, "app", "admin"),
];

// File extensions to check
const FILE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

function shouldCheckFile(filePath) {
  const ext = path.extname(filePath);
  if (!FILE_EXTENSIONS.includes(ext)) {
    return false;
  }
  
  // Skip node_modules, .next, etc.
  if (filePath.includes("node_modules") || filePath.includes(".next")) {
    return false;
  }
  
  return true;
}

function findFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    return fileList;
  }
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findFiles(filePath, fileList);
    } else if (shouldCheckFile(filePath)) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const errors = [];
  
  // Check for forbidden UI strings
  for (const { pattern, description } of FORBIDDEN_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        // Skip if it's in a comment explaining why it's removed
        const trimmed = lines[i].trim();
        if (
          trimmed.startsWith("//") ||
          trimmed.startsWith("/*") ||
          trimmed.startsWith("*") ||
          trimmed.startsWith("/**") ||
          trimmed.includes("REMOVED") ||
          trimmed.includes("legacy intent") ||
          trimmed.includes("Legacy intent")
        ) {
          continue;
        }
        errors.push({
          file: filePath,
          line: i + 1,
          description: `Found ${description}`,
          content: lines[i].trim(),
        });
      }
    }
  }
  
  // Check for forbidden props in IntentPanel specifically
  if (filePath.includes("IntentPanel")) {
    for (const { pattern, description } of FORBIDDEN_PROPS) {
      if (pattern.test(content)) {
        // Skip if it's in a comment or type definition (for backward compatibility)
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i])) {
            // Allow in comments, type definitions, or interface definitions (for backward compat)
            if (
              lines[i].trim().startsWith("//") ||
              lines[i].trim().startsWith("/*") ||
              lines[i].includes("interface") ||
              lines[i].includes("type ") ||
              lines[i].includes("export type")
            ) {
              continue;
            }
            // If it's actually being used/rendered, that's an error
            if (lines[i].includes("intent.") || lines[i].includes("props.") || lines[i].includes("{")) {
              errors.push({
                file: filePath,
                line: i + 1,
                description: `Found ${description} usage in IntentPanel`,
                content: lines[i].trim(),
              });
            }
          }
        }
      }
    }
  }
  
  return errors;
}

function main() {
  console.log("[verifyNoLegacyIntentUI] Scanning for legacy intent UI blocks...\n");
  
  const allFiles = [];
  for (const dir of SEARCH_DIRS) {
    const files = findFiles(dir);
    allFiles.push(...files);
  }
  
  console.log(`[verifyNoLegacyIntentUI] Checking ${allFiles.length} files...\n`);
  
  const allErrors = [];
  for (const file of allFiles) {
    const errors = checkFile(file);
    if (errors.length > 0) {
      allErrors.push(...errors);
    }
  }
  
  if (allErrors.length > 0) {
    console.error("[verifyNoLegacyIntentUI] ❌ FAILED: Legacy intent UI blocks found!\n");
    console.error("Legacy intent blocks are REMOVED from the product path.");
    console.error("Only Reference Implementation and Subtype Overview are allowed.\n");
    
    for (const error of allErrors) {
      console.error(`  ${error.file}:${error.line}`);
      console.error(`    ${error.description}`);
      console.error(`    ${error.content}\n`);
    }
    
    console.error("\n[verifyNoLegacyIntentUI] Build failed. Remove legacy intent UI blocks.");
    process.exit(1);
  }
  
  console.log("[verifyNoLegacyIntentUI] ✅ PASSED: No legacy intent UI blocks found.\n");
  process.exit(0);
}

main();
