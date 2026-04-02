#!/usr/bin/env tsx
/**
 * Workspace Cleanup Script
 * 
 * Organizes deprecated scripts/code into archive, standardizes repo layout,
 * and generates cleanup reports.
 * 
 * Usage:
 *   npm run workspace:cleanup:dry   # dry-run; root/archive from PSA_SYSTEM_ROOT or default
 *   npm run workspace:cleanup:apply  # apply
 *   npx tsx tools/workspace_cleanup.ts [--root /path] [--archive /path] [--dry-run | --apply]
 * On Windows, default root is D:\PSA_System if PSA_SYSTEM_ROOT is unset; on Unix, default is parent of cwd (run from psa_rebuild).
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface FileInfo {
  path: string;
  size: number;
  ext: string;
  basename: string;
  relativePath: string;
}

interface RepoStats {
  name: string;
  filesByExt: Record<string, number>;
  totalFiles: number;
  totalSize: number;
  largestFiles: FileInfo[];
}

interface MoveCandidate {
  source: string;
  destination: string;
  reason: string;
}

interface CleanupContext {
  root: string;
  archive: string;
  cleanupDir: string;
  dryRun: boolean;
  timestamp: string;
}

// Parse command line arguments
function parseArgs(): { root: string; archive: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  // Use PSA_SYSTEM_ROOT or default: repo root (parent of psa_rebuild when run from psa_rebuild)
  const defaultRoot =
    process.platform === "win32" ? "D:\\PSA_System" : path.resolve(process.cwd(), "..");
  const psaSystemRoot = process.env.PSA_SYSTEM_ROOT || defaultRoot;
  let root = psaSystemRoot;
  let archive = "";
  let dryRun = true;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root" && i + 1 < args.length) {
      root = args[i + 1];
      i++;
    } else if (args[i] === "--archive" && i + 1 < args.length) {
      archive = args[i + 1];
      i++;
    } else if (args[i] === "--apply") {
      dryRun = false;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  if (!archive) {
    archive = path.join(root, "archive");
  }
  return { root, archive, dryRun };
}

// Get all files recursively
function getAllFiles(dir: string, baseDir: string = dir): FileInfo[] {
  const files: FileInfo[] = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);
      
      // Skip node_modules, .git, archive, venv, and other common ignore patterns
      if (entry.name === 'node_modules' || 
          entry.name === '.git' || 
          entry.name === 'archive' ||
          entry.name === '.next' ||
          entry.name === 'dist' ||
          entry.name === 'build' ||
          entry.name === 'venv' ||
          entry.name === '__pycache__' ||
          entry.name === '.venv' ||
          entry.name === 'env' ||
          entry.name === '.env' ||
          entry.name.startsWith('.')) {
        continue;
      }
      
      // Skip if parent directory is venv or node_modules
      if (dir.includes('\\venv\\') || 
          dir.includes('/venv/') ||
          dir.includes('\\node_modules\\') ||
          dir.includes('/node_modules/') ||
          dir.includes('\\__pycache__\\') ||
          dir.includes('/__pycache__/') ||
          dir.includes('\\site-packages\\') ||
          dir.includes('/site-packages/')) {
        continue;
      }
      
      if (entry.isDirectory()) {
        files.push(...getAllFiles(fullPath, baseDir));
      } else if (entry.isFile()) {
        try {
          const stats = fs.statSync(fullPath);
          const ext = path.extname(entry.name).toLowerCase();
          files.push({
            path: fullPath,
            size: stats.size,
            ext: ext || '(no ext)',
            basename: entry.name,
            relativePath: relativePath
          });
        } catch (err) {
          // Skip files we can't stat
        }
      }
    }
  } catch (err) {
    // Skip directories we can't read
  }
  
  return files;
}

// Check if a file is referenced in package.json
function isReferencedInPackageJson(filePath: string, repoRoot: string): boolean {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }
  
  try {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);
    const scripts = packageJson.scripts || {};
    
    const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
    const basename = path.basename(filePath);
    
    // Check if referenced in any script
    for (const script of Object.values(scripts)) {
      if (typeof script === 'string' && (
        script.includes(relativePath) ||
        script.includes(basename) ||
        script.includes(path.basename(filePath, path.extname(filePath)))
      )) {
        return true;
      }
    }
    
    return false;
  } catch (err) {
    return false;
  }
}

// Check if a file is imported anywhere
function isImported(filePath: string, repoRoot: string, allFiles: FileInfo[]): boolean {
  const basename = path.basename(filePath);
  const nameWithoutExt = path.basename(filePath, path.extname(filePath));
  const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
  
  // Check TypeScript/JavaScript files for imports
  const codeFiles = allFiles.filter(f => 
    ['.ts', '.tsx', '.js', '.jsx'].includes(f.ext) &&
    f.path !== filePath
  );
  
  for (const codeFile of codeFiles) {
    try {
      const content = fs.readFileSync(codeFile.path, 'utf-8');
      if (content.includes(relativePath) ||
          content.includes(`'${basename}'`) ||
          content.includes(`"${basename}"`) ||
          content.includes(`'${nameWithoutExt}'`) ||
          content.includes(`"${nameWithoutExt}"`)) {
        return true;
      }
    } catch (err) {
      // Skip files we can't read
    }
  }
  
  return false;
}

// Check if path matches deprecated patterns
function matchesDeprecatedPattern(filePath: string): boolean {
  const normalized = filePath.toLowerCase().replace(/\\/g, '/');
  const basename = path.basename(filePath).toLowerCase();
  const dirname = path.dirname(normalized);
  
  // Skip migration files - they're historical records even if they mention "legacy"
  if (normalized.includes('/migrations/') || normalized.includes('\\migrations\\')) {
    return false;
  }
  
  // Skip if it's a documentation file about deprecation (might be important)
  if (basename.startsWith('deprecated_') || basename.startsWith('legacy_')) {
    // But allow if it's in a deprecated folder
    if (!dirname.includes('deprecated') && !dirname.includes('legacy')) {
      return false;
    }
  }
  
  // Check if entire directory path contains deprecated patterns (strong signal)
  // Use word boundaries to avoid false positives like "GOLD" matching "old"
  const deprecatedDirPatterns = [
    /\/deprecated\//i,
    /\\deprecated\\/i,
    /\/legacy\//i,
    /\\legacy\\/i,
    /\/_old\b/i,  // _old as a word boundary
    /\\_old\b/i,
    /\bold_\//i,  // old_ as a word boundary
    /\bold_\\/i,
    /\/scratch\//i,
    /\\scratch\\/i,
    /\/experiments\//i,
    /\\experiments\\/i,
    /\/backup\//i,
    /\\backup\\/i,
    /\/psatool_old\//i,  // Specific known deprecated folder
    /\\psatool_old\\/i
  ];
  
  for (const pattern of deprecatedDirPatterns) {
    if (pattern.test(normalized)) {
      return true;
    }
  }
  
  // Check basename for strong deprecated signals
  // Use word boundaries to avoid false positives
  const deprecatedFilePatterns = [
    /^deprecated/i,
    /^legacy/i,
    /_old\b/i,      // _old as word boundary (not matching "GOLD")
    /\bold_/i,      // old_ as word boundary
    /\.bak$/i,
    /\.old$/i,
    /\.tmp$/i,
    /scratch/i,
    /^tmp_/i,
    /^temp_/i,
    /psatool_old/i  // Specific known deprecated pattern
  ];
  
  for (const pattern of deprecatedFilePatterns) {
    if (pattern.test(basename)) {
      return true;
    }
  }
  
  return false;
}

// Identify move candidates
function identifyCandidates(
  files: FileInfo[],
  root: string,
  repos: string[]
): MoveCandidate[] {
  const candidates: MoveCandidate[] = [];
  const repoRoots = repos.map(r => path.join(root, r));
  
  for (const file of files) {
    const filePath = file.path;
    const relativePath = file.relativePath;
    
    // Skip if already in archive
    if (filePath.includes('archive')) {
      continue;
    }
    
    // Check if matches deprecated patterns
    if (matchesDeprecatedPattern(filePath)) {
      const repo = repoRoots.find(r => filePath.startsWith(r + path.sep) || filePath.startsWith(r));
      const repoName = repo ? path.basename(repo) : 'root';
      const repoRelativePath = repo ? path.relative(repo, filePath) : relativePath;
      
      candidates.push({
        source: filePath,
        destination: path.join(root, 'archive', 'CLEANUP_TEMP', repoName, repoRelativePath),
        reason: 'Matches deprecated pattern'
      });
      continue;
    }
    
    // Check if it's an orphan script (not referenced)
    const ext = path.extname(filePath).toLowerCase();
    if (['.py', '.ts', '.js'].includes(ext)) {
      const repo = repoRoots.find(r => filePath.startsWith(r + path.sep) || filePath.startsWith(r));
      
      if (repo) {
        const isInPackageJson = isReferencedInPackageJson(filePath, repo);
        // For now, skip import checking as it's expensive - we'll do pattern-based first
        if (!isInPackageJson && matchesDeprecatedPattern(filePath)) {
          const repoName = path.basename(repo);
          const repoRelativePath = path.relative(repo, filePath);
          
          candidates.push({
            source: filePath,
            destination: path.join(root, 'archive', 'CLEANUP_TEMP', repoName, repoRelativePath),
            reason: 'Orphan script (not in package.json)'
          });
        }
      }
    }
  }
  
  return candidates;
}

// Generate inventory report
function generateInventory(
  files: FileInfo[],
  repos: string[],
  root: string,
  outputPath: string
): void {
  const repoStats: Record<string, RepoStats> = {};
  
  // Initialize repo stats
  for (const repo of repos) {
    repoStats[repo] = {
      name: repo,
      filesByExt: {},
      totalFiles: 0,
      totalSize: 0,
      largestFiles: []
    };
  }
  repoStats['root'] = {
    name: 'root',
    filesByExt: {},
    totalFiles: 0,
    totalSize: 0,
    largestFiles: []
  };
  
  // Categorize files
  for (const file of files) {
    const repo = repos.find(r => file.path.startsWith(path.join(root, r) + path.sep));
    const repoName = repo || 'root';
    const stats = repoStats[repoName];
    
    stats.totalFiles++;
    stats.totalSize += file.size;
    stats.filesByExt[file.ext] = (stats.filesByExt[file.ext] || 0) + 1;
    stats.largestFiles.push(file);
  }
  
  // Sort largest files
  for (const repo of Object.keys(repoStats)) {
    repoStats[repo].largestFiles.sort((a, b) => b.size - a.size);
    repoStats[repo].largestFiles = repoStats[repo].largestFiles.slice(0, 50);
  }
  
  // Find duplicates
  const basenameMap: Record<string, FileInfo[]> = {};
  for (const file of files) {
    if (!basenameMap[file.basename]) {
      basenameMap[file.basename] = [];
    }
    basenameMap[file.basename].push(file);
  }
  const duplicates = Object.entries(basenameMap)
    .filter(([_, files]) => files.length > 1)
    .map(([basename, files]) => ({ basename, files, count: files.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);
  
  // Generate markdown report
  let report = `# Workspace Inventory Report\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  
  report += `## Summary\n\n`;
  report += `Total files scanned: ${files.length}\n\n`;
  
  report += `## Repo-by-Repo Statistics\n\n`;
  for (const repo of ['root', ...repos]) {
    const stats = repoStats[repo];
    report += `### ${stats.name}\n\n`;
    report += `- Total files: ${stats.totalFiles}\n`;
    report += `- Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB\n\n`;
    
    report += `#### Files by Extension\n\n`;
    const extEntries = Object.entries(stats.filesByExt)
      .sort((a, b) => b[1] - a[1]);
    for (const [ext, count] of extEntries.slice(0, 20)) {
      report += `- ${ext}: ${count}\n`;
    }
    report += `\n`;
    
    report += `#### Top 20 Largest Files\n\n`;
    for (const file of stats.largestFiles.slice(0, 20)) {
      report += `- ${file.relativePath} (${(file.size / 1024).toFixed(2)} KB)\n`;
    }
    report += `\n`;
  }
  
  report += `## Suspected Duplicates\n\n`;
  for (const dup of duplicates) {
    report += `### ${dup.basename} (${dup.count} occurrences)\n\n`;
    for (const file of dup.files) {
      report += `- ${file.relativePath}\n`;
    }
    report += `\n`;
  }
  
  fs.writeFileSync(outputPath, report, 'utf-8');
  console.log(`✓ Inventory report written to: ${outputPath}`);
}

// Generate moved map
function generateMovedMap(
  candidates: MoveCandidate[],
  outputPath: string,
  dryRun: boolean
): void {
  let report = `# Moved Files Map\n\n`;
  report += `Generated: ${new Date().toISOString()}\n`;
  report += `Mode: ${dryRun ? 'DRY-RUN' : 'APPLIED'}\n\n`;
  report += `Total files to move: ${candidates.length}\n\n`;
  
  report += `## Moves\n\n`;
  for (const candidate of candidates) {
    report += `### ${path.basename(candidate.source)}\n\n`;
    report += `- **Source**: \`${candidate.source}\`\n`;
    report += `- **Destination**: \`${candidate.destination}\`\n`;
    report += `- **Reason**: ${candidate.reason}\n\n`;
  }
  
  fs.writeFileSync(outputPath, report, 'utf-8');
  console.log(`✓ Moved map written to: ${outputPath}`);
}

// Move files to archive
function moveFiles(candidates: MoveCandidate[], dryRun: boolean): void {
  console.log(`\n${dryRun ? 'DRY-RUN: Would move' : 'Moving'} ${candidates.length} files...\n`);
  
  for (const candidate of candidates) {
    const destDir = path.dirname(candidate.destination);
    
    if (!dryRun) {
      try {
        // Ensure destination directory exists
        fs.mkdirSync(destDir, { recursive: true });
        
        // Move file
        fs.renameSync(candidate.source, candidate.destination);
        console.log(`✓ Moved: ${path.basename(candidate.source)}`);
      } catch (err: any) {
        console.error(`✗ Failed to move ${candidate.source}: ${err.message}`);
      }
    } else {
      console.log(`[DRY-RUN] Would move: ${candidate.source} -> ${candidate.destination}`);
    }
  }
}

// Main execution
function main() {
  const { root, archive, dryRun } = parseArgs();
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const timestamp = `${year}${month}${day}_${hour}${minute}`;
  const cleanupDir = path.join(archive, `CLEANUP_${timestamp}`);
  
  console.log(`\n=== Workspace Cleanup ===\n`);
  console.log(`Root: ${root}`);
  console.log(`Archive: ${archive}`);
  console.log(`Cleanup Dir: ${cleanupDir}`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'APPLY'}\n`);
  
  // Ensure cleanup directory exists (always, for reports)
  fs.mkdirSync(cleanupDir, { recursive: true });
  
  // Identify repos
  const repos: string[] = [];
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && 
          entry.name !== 'archive' && 
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules') {
        repos.push(entry.name);
      }
    }
  } catch (err) {
    console.error(`Failed to read root directory: ${err}`);
    process.exit(1);
  }
  
  console.log(`Found repos: ${repos.join(', ')}\n`);
  
  // Scan all files
  console.log('Scanning files...');
  const allFiles = getAllFiles(root);
  console.log(`Found ${allFiles.length} files\n`);
  
  // Generate inventory
  const inventoryPath = path.join(cleanupDir, 'INVENTORY.md');
  // Always create directory for reports, even in dry-run
  fs.mkdirSync(path.dirname(inventoryPath), { recursive: true });
  generateInventory(allFiles, repos, root, inventoryPath);
  
  // Identify candidates
  console.log('Identifying deprecated candidates...');
  const candidates = identifyCandidates(allFiles, root, repos);
  console.log(`Found ${candidates.length} candidates\n`);
  
  // Update destination paths with actual cleanup dir
  for (const candidate of candidates) {
    candidate.destination = candidate.destination.replace('CLEANUP_TEMP', path.basename(cleanupDir));
  }
  
  // Generate moved map
  const movedMapPath = path.join(cleanupDir, 'MOVED_MAP.md');
  // Always create directory for reports, even in dry-run
  fs.mkdirSync(path.dirname(movedMapPath), { recursive: true });
  generateMovedMap(candidates, movedMapPath, dryRun);
  
  // Move files
  if (candidates.length > 0) {
    moveFiles(candidates, dryRun);
  }
  
  // Generate test report template
  const testReportPath = path.join(cleanupDir, 'TEST_REPORT.md');
  // Always create directory for reports, even in dry-run
  fs.mkdirSync(path.dirname(testReportPath), { recursive: true });
  const testReport = `# Post-Cleanup Test Report\n\nGenerated: ${new Date().toISOString()}\n\n## Test Results\n\n### psa_rebuild\n\n- [ ] npm ci\n- [ ] npm run build\n- [ ] npm run dev (started)\n- [ ] API: GET /api/reference/baseline-questions\n- [ ] API: GET /api/runtime/assessments/<id>/questions\n- [ ] UI: Admin questions view loads\n- [ ] UI: Assessment shows gate questions\n\n### Database Verification\n\n- [ ] baseline_spines_runtime: count active\n- [ ] baseline_spines_runtime: count by discipline\n- [ ] overlay_spines_runtime: counts (if exists)\n\n## Restores Performed\n\n(If any files were restored from archive, list them here)\n\n`;
  fs.writeFileSync(testReportPath, testReport, 'utf-8');
  console.log(`✓ Test report template written to: ${testReportPath}`);
  
  console.log(`\n=== Cleanup Complete ===\n`);
  if (dryRun) {
    console.log(`This was a DRY-RUN. Use --apply to execute moves.`);
  }
}

main();
