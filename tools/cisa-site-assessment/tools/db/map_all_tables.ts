#!/usr/bin/env tsx
/**
 * Map all tables to ownership config.
 * 
 * Usage:
 *   npx tsx tools/db/map_all_tables.ts
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

import { getCorpusPool } from '../../app/lib/db/corpus_client';
import { getRuntimePool } from '../../app/lib/db/runtime_client';
import ownershipConfig from '../../config/db_ownership.json';

async function getAllTables(pool: any, schema: string = 'public'): Promise<string[]> {
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = $1 AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `, [schema]);
  
  return result.rows.map((r: any) => r.table_name);
}

// Determine ownership based on table name patterns and location
function determineOwnership(tableName: string, inCorpus: boolean, inRuntime: boolean): 'CORPUS' | 'RUNTIME' | null {
  // Already in ownership config
  if (ownershipConfig.owners[`public.${tableName}`]) {
    return ownershipConfig.owners[`public.${tableName}`] as 'CORPUS' | 'RUNTIME';
  }
  
  // If only in one database, that's the owner
  if (inCorpus && !inRuntime) return 'CORPUS';
  if (inRuntime && !inCorpus) return 'RUNTIME';
  
  // Pattern-based determination
  const corpusPatterns = [
    /^corpus_/,
    /^source_registry/,
    /^document_chunks/,
    /^ingestion_/,
    /^ofc_candidate/,
    /^module_standard/,
    /^module_chunk_links/,
    /^module_source_documents/,
    /^ofc_question_links/,
    /^question_candidate/,
  ];
  
  const runtimePatterns = [
    /^assessment/,
    /^module_/,
    /^ofc_/,
    /^baseline_/,
    /^expansion_/,
    /^discipline/,
    /^canonical_/,
    /^sector/,
    /^subsector/,
    /^facilities/,
    /^system_/,
    /^audit_/,
    /^tech_/,
    /^coverage_/,
    /^overlay_/,
    /^normalized_/,
  ];
  
  for (const pattern of corpusPatterns) {
    if (pattern.test(tableName)) return 'CORPUS';
  }
  
  for (const pattern of runtimePatterns) {
    if (pattern.test(tableName)) return 'RUNTIME';
  }
  
  // Default: use location
  if (inCorpus) return 'CORPUS';
  if (inRuntime) return 'RUNTIME';
  
  return null;
}

async function main() {
  try {
    console.log("🗺️  Mapping all tables to ownership config...\n");
    
    const corpusPool = getCorpusPool();
    const runtimePool = getRuntimePool();
    
    const corpusTables = await getAllTables(corpusPool);
    const runtimeTables = await getAllTables(runtimePool);
    const allTables = new Set([...corpusTables, ...runtimeTables]);
    
    const ownedTables = new Set(
      Object.keys(ownershipConfig.owners).map(k => k.split('.')[1])
    );
    
    const unmapped = Array.from(allTables).filter(t => !ownedTables.has(t));
    
    console.log(`Found ${unmapped.length} unmapped tables\n`);
    
    const newOwners: Record<string, 'CORPUS' | 'RUNTIME'> = {};
    const needsReview: string[] = [];
    
    for (const table of unmapped) {
      const inCorpus = corpusTables.includes(table);
      const inRuntime = runtimeTables.includes(table);
      const owner = determineOwnership(table, inCorpus, inRuntime);
      
      if (owner) {
        newOwners[`public.${table}`] = owner;
        console.log(`  ✓ ${table} → ${owner}`);
      } else {
        needsReview.push(table);
        console.log(`  ⚠️  ${table} → NEEDS REVIEW (in CORPUS: ${inCorpus}, in RUNTIME: ${inRuntime})`);
      }
    }
    
    if (needsReview.length > 0) {
      console.log(`\n⚠️  ${needsReview.length} tables need manual review:`);
      needsReview.forEach(t => console.log(`     - ${t}`));
    }
    
    // Update ownership config
    const updatedOwners = {
      ...ownershipConfig.owners,
      ...newOwners
    };
    
    // Sort alphabetically
    const sortedOwners: Record<string, string> = {};
    Object.keys(updatedOwners).sort().forEach(key => {
      sortedOwners[key] = updatedOwners[key];
    });
    
    const updatedConfig = {
      ...ownershipConfig,
      owners: sortedOwners,
      meta: {
        ...ownershipConfig.meta,
        version: new Date().toISOString().split('T')[0],
        last_updated: new Date().toISOString(),
        notes: [
          ...ownershipConfig.meta.notes,
          `Auto-mapped ${Object.keys(newOwners).length} tables on ${new Date().toISOString()}`
        ]
      }
    };
    
    const configPath = path.join(process.cwd(), 'config', 'db_ownership.json');
    fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
    
    console.log(`\n✅ Updated ownership config with ${Object.keys(newOwners).length} new tables`);
    console.log(`   Config saved to: ${configPath}`);
    
    if (needsReview.length > 0) {
      console.log(`\n⚠️  Please manually review ${needsReview.length} tables`);
    }
    
    await corpusPool.end();
    await runtimePool.end();
    
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

main();
