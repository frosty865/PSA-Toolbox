#!/usr/bin/env node
/**
 * Guard: Verify Database Ownership Matches Reality
 * 
 * Ensures that tables exist in the databases specified by config/db_ownership.json
 * and that foreign key constraints are co-located (cannot span databases).
 * 
 * Usage:
 *   node scripts/guards/verifyDbOwnershipMatchesReality.js
 */

const { spawnSync } = require('child_process');
const path = require('path');

function main() {
  console.log('[GUARD] Verifying database ownership matches reality...\n');
  
  try {
    const scriptPath = path.resolve(__dirname, '../../tools/db/verify_db_ownership.ts');
    
    // Run the verification script without shell interpolation so spaces in the repo path are safe.
    const result = spawnSync(process.execPath, ['--import', 'tsx', scriptPath], {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../..'),
      shell: false,
    });

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`verify_db_ownership.ts exited with status ${result.status ?? 'unknown'}`);
    }
    
    console.log('\n✓ Database ownership verification passed.\n');
    process.exit(0);
    
  } catch (error) {
    console.error('\n✗ Database ownership verification failed.');
    console.error('Fix ownership mismatches before proceeding.\n');
    process.exit(1);
  }
}

main();
