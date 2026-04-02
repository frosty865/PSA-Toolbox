#!/usr/bin/env node
/**
 * Update all API routes to use explicit database clients
 * 
 * Replaces:
 * - import { getPool } from '@/app/lib/db' -> getRuntimePool() for runtime routes
 * - const pool = getPool() -> const pool = getRuntimePool()
 */

const fs = require('fs');
const path = require('path');

const RUNTIME_PATHS = [
  'app/api/runtime',
  'app/api/ofc',
  'app/api/assessment'
];

const CORPUS_PATHS = [
  'app/api/runtime/ofc-candidates',
  'app/api/runtime/question-coverage'
];

function updateFile(filePath, useCorpus = false) {
  const content = fs.readFileSync(filePath, 'utf8');
  let updated = content;
  let changed = false;

  const clientName = useCorpus ? 'getCorpusPool' : 'getRuntimePool';
  const clientPath = useCorpus 
    ? '@/app/lib/db/corpus_client'
    : '@/app/lib/db/runtime_client';

  // Update import
  if (content.includes("from '@/app/lib/db'") || content.includes("from '../../../lib/db'") || content.includes("from '../../lib/db'")) {
    updated = updated.replace(
      /import\s+{\s*getPool\s*}\s+from\s+['"]@\/app\/lib\/db['"]/g,
      `import { ${clientName} } from '${clientPath}'`
    );
    updated = updated.replace(
      /import\s+{\s*getPool\s*}\s+from\s+['"]\.\.\/\.\.\/\.\.\/lib\/db['"]/g,
      `import { ${clientName} } from '${clientPath}'`
    );
    updated = updated.replace(
      /import\s+{\s*getPool\s*}\s+from\s+['"]\.\.\/\.\.\/lib\/db['"]/g,
      `import { ${clientName} } from '${clientPath}'`
    );
    changed = true;
  }

  // Update usage
  if (content.includes('getPool()')) {
    updated = updated.replace(/getPool\(\)/g, `${clientName}()`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`✓ Updated: ${filePath}`);
    return true;
  }
  return false;
}

function findTsFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Find all API files
const apiDir = path.join(process.cwd(), 'app', 'api');
const allFiles = findTsFiles(apiDir);

let updatedCount = 0;

for (const file of allFiles) {
  const relativePath = path.relative(process.cwd(), file);
  
  // Check if it's a corpus route
  const isCorpus = CORPUS_PATHS.some(cp => relativePath.includes(cp));
  
  // Check if it's a runtime route (default)
  const isRuntime = RUNTIME_PATHS.some(rp => relativePath.includes(rp)) || !isCorpus;
  
  if (isRuntime || isCorpus) {
    if (updateFile(file, isCorpus)) {
      updatedCount++;
    }
  }
}

console.log(`\n✅ Updated ${updatedCount} files`);

