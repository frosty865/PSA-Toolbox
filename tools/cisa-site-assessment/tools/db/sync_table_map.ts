#!/usr/bin/env tsx
/**
 * Sync db_table_map.json with db_ownership.json.
 * 
 * Usage:
 *   npx tsx tools/db/sync_table_map.ts
 */

import * as fs from 'fs';
import * as path from 'path';

import ownershipConfig from '../../config/db_ownership.json';
import tableMapConfig from '../../config/db_table_map.json';

function main() {
  try {
    console.log("🔄 Syncing db_table_map.json with db_ownership.json...\n");
    
    // Convert ownership config to table_map format
    const tables: Array<{ schema: string; table: string; pool: string }> = [];
    
    for (const [fullTableName, owner] of Object.entries(ownershipConfig.owners)) {
      const [schema, table] = fullTableName.split('.');
      tables.push({
        schema,
        table,
        pool: owner
      });
    }
    
    // Sort by pool, then by table name
    tables.sort((a, b) => {
      if (a.pool !== b.pool) {
        return a.pool.localeCompare(b.pool);
      }
      return a.table.localeCompare(b.table);
    });
    
    const updatedTableMap = {
      meta: {
        version: new Date().toISOString().split('T')[0],
        notes: [
          "This is the single source of truth for which pool owns which table.",
          "Startup guards and diagnostics rely on this mapping.",
          `Synced with db_ownership.json on ${new Date().toISOString()}`
        ]
      },
      tables
    };
    
    const configPath = path.join(process.cwd(), 'config', 'db_table_map.json');
    fs.writeFileSync(configPath, JSON.stringify(updatedTableMap, null, 2));
    
    console.log(`✅ Synced ${tables.length} tables to db_table_map.json`);
    console.log(`   Config saved to: ${configPath}`);
    console.log(`\n   CORPUS tables: ${tables.filter(t => t.pool === 'CORPUS').length}`);
    console.log(`   RUNTIME tables: ${tables.filter(t => t.pool === 'RUNTIME').length}`);
    
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

main();
