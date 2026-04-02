#!/usr/bin/env node
/**
 * Guard: Verify No Module Table Access in Corpus Miners
 * 
 * Scans tools/corpus/ and tools/run_* for forbidden strings that indicate
 * module table access in corpus miners.
 * 
 * Usage:
 *   node scripts/guards/verifyNoModuleTableAccessInCorpusMiners.js
 */

const fs = require('fs');
const path = require('path');

const FORBIDDEN_PATTERNS = [
    'module_',
    'modules_',
    'module_documents',
    'module_chunks',
    'ofc_module',
    'module_ofc',
    'module_research',
    'MODULE_'
];

const SCAN_DIRS = [
    'tools/corpus',
    'tools/run_mine_ofc_v3.py',
    'tools/corpus/mine_ofc_candidates_v3.py'
];

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const violations = [];
    
    FORBIDDEN_PATTERNS.forEach(pattern => {
        const regex = new RegExp(pattern, 'gi');
        const matches = content.match(regex);
        
        if (matches) {
            const lines = content.split('\n');
            lines.forEach((line, index) => {
                if (regex.test(line)) {
                    violations.push({
                        pattern,
                        line: index + 1,
                        content: line.trim()
                    });
                }
            });
        }
    });
    
    return violations;
}

function scanDirectory(dirPath) {
    const violations = [];
    
    if (!fs.existsSync(dirPath)) {
        return violations;
    }
    
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
            violations.push(...scanDirectory(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.py') || entry.name.endsWith('.js'))) {
            const fileViolations = scanFile(fullPath);
            if (fileViolations.length > 0) {
                violations.push({
                    file: fullPath,
                    violations: fileViolations
                });
            }
        }
    }
    
    return violations;
}

function main() {
    console.log('[GUARD] Scanning corpus miners for module table access...\n');
    
    const allViolations = [];
    
    // Scan directories
    SCAN_DIRS.forEach(dir => {
        const fullPath = path.resolve(dir);
        
        if (fs.existsSync(fullPath)) {
            if (fs.statSync(fullPath).isDirectory()) {
                const violations = scanDirectory(fullPath);
                allViolations.push(...violations);
            } else if (fs.statSync(fullPath).isFile()) {
                const violations = scanFile(fullPath);
                if (violations.length > 0) {
                    allViolations.push({
                        file: fullPath,
                        violations
                    });
                }
            }
        }
    });
    
    if (allViolations.length === 0) {
        console.log('✓ No violations found. Corpus miners are clean.\n');
        process.exit(0);
    }
    
    console.error('✗ VIOLATIONS FOUND:\n');
    
    allViolations.forEach(({ file, violations }) => {
        console.error(`File: ${file}`);
        violations.forEach(({ pattern, line, content }) => {
            console.error(`  Line ${line}: Found forbidden pattern "${pattern}"`);
            console.error(`    ${content}`);
        });
        console.error('');
    });
    
    console.error('ERROR: Corpus miners must not access module tables.');
    console.error('Remove module table references and ensure hard separation.\n');
    process.exit(1);
}

main();
