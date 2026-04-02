#!/usr/bin/env tsx
/**
 * Diagnose Missing Module Source Files
 * 
 * Checks for module_sources records where storage_relpath points to files that don't exist.
 */

import * as dotenv from 'dotenv';
import { getRuntimePool } from '../app/lib/db/runtime_client';
import { existsSync } from 'fs';
import * as path from 'path';

// Resolve module path without importing server-only module
function resolveModulePath(storageRelpath: string): string {
  const MODULE_SOURCES_ROOT = process.env.MODULE_SOURCES_ROOT || 'storage/module_sources';
  const root = path.isAbsolute(MODULE_SOURCES_ROOT) 
    ? MODULE_SOURCES_ROOT 
    : path.resolve(MODULE_SOURCES_ROOT);
  return path.resolve(root, storageRelpath);
}

dotenv.config({ path: '.env.local' });

async function main() {
  const pool = getRuntimePool();

  try {
    // Find MODULE_UPLOAD sources with storage_relpath
    // Also check for paths pointing to psa-workspace (legacy)
    const result = await pool.query(`
      SELECT 
        id,
        module_code,
        source_label,
        source_url,
        storage_relpath,
        file_path,
        fetch_status,
        created_at
      FROM public.module_sources
      WHERE source_type = 'MODULE_UPLOAD'
        AND storage_relpath IS NOT NULL
        AND (
          storage_relpath NOT LIKE 'raw/%'
          OR storage_relpath LIKE '%downloads%research%'
          OR storage_relpath LIKE '%psa-workspace%'
          OR file_path LIKE '%psa-workspace%'
        )
      ORDER BY module_code, created_at DESC
    `);

    console.log(`[INFO] Found ${result.rows.length} MODULE_UPLOAD sources with storage_relpath\n`);

    let missingCount = 0;
    const missing: Array<{ id: string; module_code: string; source_label: string; storage_relpath: string; file_path: string | null }> = [];

    for (const row of result.rows) {
      try {
        const absPath = resolveModulePath(row.storage_relpath);
        if (!existsSync(absPath)) {
          missingCount++;
          missing.push({
            id: row.id,
            module_code: row.module_code,
            source_label: row.source_label,
            storage_relpath: row.storage_relpath,
            file_path: row.file_path,
          });
        }
      } catch (error) {
        // resolveModulePath might throw if path escapes root
        missingCount++;
        missing.push({
          id: row.id,
          module_code: row.module_code,
          source_label: row.source_label,
          storage_relpath: row.storage_relpath,
          file_path: row.file_path,
        });
      }
    }

    if (missing.length > 0) {
      console.log(`[WARN] Found ${missing.length} sources with invalid/missing files:\n`);
      
      // Separate by issue type
      const psaWorkspacePaths = missing.filter(m => 
        m.storage_relpath?.includes('psa-workspace') || m.file_path?.includes('psa-workspace')
      );
      const downloadsResearchPaths = missing.filter(m => 
        m.storage_relpath?.includes('downloads') && m.storage_relpath?.includes('research')
      );
      const otherInvalid = missing.filter(m => 
        !psaWorkspacePaths.includes(m) && !downloadsResearchPaths.includes(m)
      );
      
      if (psaWorkspacePaths.length > 0) {
        console.log(`\n[ISSUE] ${psaWorkspacePaths.length} paths pointing to psa-workspace (legacy):`);
        for (const m of psaWorkspacePaths.slice(0, 5)) {
          console.log(`  Module: ${m.module_code}`);
          console.log(`  Label: ${m.source_label}`);
          console.log(`  storage_relpath: ${m.storage_relpath}`);
          console.log(`  file_path: ${m.file_path || '(null)'}`);
          console.log(`  ID: ${m.id}\n`);
        }
        if (psaWorkspacePaths.length > 5) {
          console.log(`  ... and ${psaWorkspacePaths.length - 5} more\n`);
        }
      }
      
      if (downloadsResearchPaths.length > 0) {
        console.log(`\n[ISSUE] ${downloadsResearchPaths.length} paths pointing to downloads/research:`);
        for (const m of downloadsResearchPaths.slice(0, 5)) {
          console.log(`  Module: ${m.module_code}`);
          console.log(`  Label: ${m.source_label}`);
          console.log(`  storage_relpath: ${m.storage_relpath}`);
          console.log(`  file_path: ${m.file_path || '(null)'}`);
          console.log(`  ID: ${m.id}\n`);
        }
        if (downloadsResearchPaths.length > 5) {
          console.log(`  ... and ${downloadsResearchPaths.length - 5} more\n`);
        }
      }
      
      if (otherInvalid.length > 0) {
        console.log(`\n[ISSUE] ${otherInvalid.length} other invalid paths:`);
        for (const m of otherInvalid.slice(0, 5)) {
          console.log(`  Module: ${m.module_code}`);
          console.log(`  Label: ${m.source_label}`);
          console.log(`  storage_relpath: ${m.storage_relpath}`);
          console.log(`  file_path: ${m.file_path || '(null)'}`);
          console.log(`  ID: ${m.id}\n`);
        }
        if (otherInvalid.length > 5) {
          console.log(`  ... and ${otherInvalid.length - 5} more\n`);
        }
      }
    } else {
      console.log('[OK] All files exist\n');
    }

    // Check for the specific file from the error
    const evParkingHtml = result.rows.find((r: any) => 
      r.module_code === 'MODULE_EV_PARKING' && 
      r.storage_relpath?.includes('html')
    );
    
    if (evParkingHtml) {
      console.log('\n[INFO] EV_PARKING HTML file record:');
      console.log(`  ID: ${evParkingHtml.id}`);
      console.log(`  storage_relpath: ${evParkingHtml.storage_relpath}`);
      console.log(`  file_path: ${evParkingHtml.file_path || '(null)'}`);
      try {
        const absPath = resolveModulePath(evParkingHtml.storage_relpath);
        console.log(`  Resolved path: ${absPath}`);
        console.log(`  File exists: ${existsSync(absPath)}`);
      } catch (error) {
        console.log(`  Error resolving path: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

  } catch (error) {
    console.error('[ERROR] Diagnosis failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
