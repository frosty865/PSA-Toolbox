#!/usr/bin/env node
/**
 * Build Guard: Verify No Direct OFC Extraction
 * 
 * PURPOSE
 * Fail build if any script attempts to violate PSA OFC Doctrine v1:
 * - Insert OFCs directly from document text
 * - Persist mined OFCs without mapping to solution pattern
 * 
 * PROHIBITED PATTERNS
 * 1. INSERT INTO ofc_candidate_queue ... VALUES (..., document_text, ...)
 * 2. INSERT INTO ofc_candidate_queue ... SELECT ... FROM document_chunks ...
 * 3. INSERT INTO ofc_candidate_queue ... VALUES (..., chunk_text, ...)
 * 4. Any direct text extraction without solution pattern mapping
 * 
 * ALLOWED PATTERNS
 * - INSERT with explicit ofc_text authored by analyst
 * - INSERT with ofc_origin = 'MODULE' (module research)
 * - UPDATE operations (editing existing OFCs)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROHIBITED_PATTERNS = [
  // Pattern 1: Direct INSERT from document_chunks
  {
    pattern: /INSERT\s+INTO\s+.*ofc_candidate_queue.*SELECT.*FROM.*document_chunks/gi,
    description: 'Direct INSERT from document_chunks table'
  },
  // Pattern 2: INSERT with chunk_text or document text columns
  {
    pattern: /INSERT\s+INTO\s+.*ofc_candidate_queue.*VALUES.*chunk_text/gi,
    description: 'INSERT using chunk_text column'
  },
  {
    pattern: /INSERT\s+INTO\s+.*ofc_candidate_queue.*VALUES.*document_text/gi,
    description: 'INSERT using document_text column'
  },
  // Pattern 3: Direct text extraction without solution pattern
  {
    pattern: /INSERT\s+INTO\s+.*ofc_candidate_queue.*snippet_text.*SELECT.*chunk_text/gi,
    description: 'Direct snippet_text from chunk_text'
  },
  // Pattern 4: Mining scripts that persist without solution mapping
  {
    pattern: /INSERT\s+INTO\s+.*ofc_candidate_queue.*\([^)]*snippet_text[^)]*\).*VALUES.*\([^)]*text[^)]*\)/gi,
    description: 'INSERT snippet_text from raw text variable'
  }
];

const ALLOWED_PATTERNS = [
  // Module OFCs are allowed (explicit creation)
  /ofc_origin\s*=\s*['"]MODULE['"]/gi,
  // UPDATE operations are allowed
  /UPDATE\s+.*ofc_candidate_queue/gi,
  // Explicit ofc_text authored by analyst
  /ofc_text\s*[:=]/gi
];

function findPythonFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Skip node_modules, .git, etc.
    if (entry.name.startsWith('.') || entry.name === 'node_modules') {
      continue;
    }
    
    if (entry.isDirectory()) {
      files.push(...findPythonFiles(fullPath));
    } else if (entry.name.endsWith('.py')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const violations = [];
  
  // Check for prohibited patterns
  for (const { pattern, description } of PROHIBITED_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      // Check if any match is in an allowed context
      let isAllowed = false;
      for (const allowedPattern of ALLOWED_PATTERNS) {
        if (allowedPattern.test(content)) {
          isAllowed = true;
          break;
        }
      }
      
      if (!isAllowed) {
        violations.push({
          file: filePath,
          pattern: description,
          matches: matches.length
        });
      }
    }
  }
  
  return violations;
}

function main() {
  console.log('🔍 Verifying no direct OFC extraction (PSA OFC Doctrine v1)...\n');
  
  const projectRoot = path.resolve(__dirname, '../..');
  const pythonFiles = findPythonFiles(projectRoot);
  
  // Focus on corpus tools and migration scripts
  const relevantFiles = pythonFiles.filter(file => 
    file.includes('tools/corpus') || 
    file.includes('migrations') ||
    file.includes('tools/corpus')
  );
  
  console.log(`📁 Scanning ${relevantFiles.length} Python files...\n`);
  
  const allViolations = [];
  
  for (const file of relevantFiles) {
    const violations = checkFile(file);
    if (violations.length > 0) {
      allViolations.push(...violations);
    }
  }
  
  if (allViolations.length > 0) {
    console.error('❌ BUILD FAILED: Direct OFC extraction violations detected\n');
    console.error('PSA OFC Doctrine v1 prohibits direct extraction from documents.\n');
    
    for (const violation of allViolations) {
      console.error(`  📄 ${violation.file}`);
      console.error(`     Pattern: ${violation.pattern}`);
      console.error(`     Matches: ${violation.matches}\n`);
    }
    
    console.error('REMEDIATION:');
    console.error('  - OFCs must be authored as solution patterns');
    console.error('  - Documents provide evidence, not OFC text');
    console.error('  - Use Module Data Management for MODULE OFCs');
    console.error('  - See docs/doctrine/PSA_OFC_DOCTRINE_V1.md\n');
    
    process.exit(1);
  }
  
  console.log('✅ No direct OFC extraction violations found');
  console.log('✅ Build guard passed\n');
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { checkFile, findPythonFiles };
