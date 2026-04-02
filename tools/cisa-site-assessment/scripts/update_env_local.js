#!/usr/bin/env node
/**
 * Update .env.local with new RUNTIME and CORPUS variables
 * 
 * Usage:
 *   node scripts/update_env_local.js [corpus_anon_key] [corpus_service_role_key]
 * 
 * Or set environment variables:
 *   CORPUS_ANON_KEY=... CORPUS_SERVICE_ROLE_KEY=... node scripts/update_env_local.js
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');

if (!fs.existsSync(envPath)) {
  console.error('Error: .env.local not found');
  process.exit(1);
}

// Read current .env.local
const currentEnv = fs.readFileSync(envPath, 'utf8');

// Extract existing RUNTIME values
const runtimeUrl = currentEnv.match(/SUPABASE_URL=(.+)/)?.[1]?.trim() || 
                   currentEnv.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim() ||
                   'https://wivohgbuuwxoyfyzntsd.supabase.co';

const runtimeAnonKey = currentEnv.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim() ||
                       currentEnv.match(/SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim() ||
                       '';

const runtimeServiceKey = currentEnv.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim() || '';

// Get CORPUS keys from command line args or env vars
const corpusAnonKey = process.argv[2] || process.env.CORPUS_ANON_KEY || '';
const corpusServiceKey = process.argv[3] || process.env.CORPUS_SERVICE_ROLE_KEY || '';
const corpusDbPassword = process.argv[4] || process.env.CORPUS_DB_PASSWORD || '';

if (!corpusAnonKey || !corpusServiceKey) {
  console.error('Error: CORPUS anon key and service role key required');
  console.error('');
  console.error('Usage:');
  console.error('  node scripts/update_env_local.js [corpus_anon_key] [corpus_service_role_key] [corpus_db_password]');
  console.error('');
  console.error('Or set environment variables:');
  console.error('  CORPUS_ANON_KEY=... CORPUS_SERVICE_ROLE_KEY=... CORPUS_DB_PASSWORD=... node scripts/update_env_local.js');
  console.error('');
  console.error('Note: corpus_db_password is optional but recommended for direct PostgreSQL connections.');
  process.exit(1);
}

// Build new .env.local content
let newEnv = currentEnv;

// Remove quotes if present
const cleanValue = (val) => val.replace(/^["']|["']$/g, '');

// Add RUNTIME variables (if not already present)
if (!newEnv.includes('SUPABASE_RUNTIME_URL')) {
  newEnv += '\n\n# ============================================================================\n';
  newEnv += '# RUNTIME Project (wivohgbuuwxoyfyzntsd)\n';
  newEnv += '# ============================================================================\n';
  newEnv += `SUPABASE_RUNTIME_URL="${cleanValue(runtimeUrl)}"\n`;
  newEnv += `SUPABASE_RUNTIME_ANON_KEY="${cleanValue(runtimeAnonKey)}"\n`;
  newEnv += `SUPABASE_RUNTIME_SERVICE_ROLE_KEY="${cleanValue(runtimeServiceKey)}"\n`;
}

// Add CORPUS variables (if not already present)
if (!newEnv.includes('SUPABASE_CORPUS_URL')) {
  newEnv += '\n# ============================================================================\n';
  newEnv += '# CORPUS Project (yylslokiaovdythzrbgt)\n';
  newEnv += '# ============================================================================\n';
  newEnv += 'SUPABASE_CORPUS_URL="https://yylslokiaovdythzrbgt.supabase.co"\n';
  newEnv += `SUPABASE_CORPUS_ANON_KEY="${cleanValue(corpusAnonKey)}"\n`;
  newEnv += `SUPABASE_CORPUS_SERVICE_ROLE_KEY="${cleanValue(corpusServiceKey)}"\n`;
  if (corpusDbPassword) {
    newEnv += `SUPABASE_CORPUS_DB_PASSWORD="${cleanValue(corpusDbPassword)}"\n`;
  }
} else {
  // Update existing CORPUS variables
  newEnv = newEnv.replace(
    /SUPABASE_CORPUS_ANON_KEY=.*/,
    `SUPABASE_CORPUS_ANON_KEY="${cleanValue(corpusAnonKey)}"`
  );
  newEnv = newEnv.replace(
    /SUPABASE_CORPUS_SERVICE_ROLE_KEY=.*/,
    `SUPABASE_CORPUS_SERVICE_ROLE_KEY="${cleanValue(corpusServiceKey)}"`
  );
}

// Write updated .env.local
fs.writeFileSync(envPath, newEnv, 'utf8');

console.log('✅ Updated .env.local with new RUNTIME and CORPUS variables');
console.log('');
console.log('Added/Updated:');
console.log('  - SUPABASE_RUNTIME_URL');
console.log('  - SUPABASE_RUNTIME_ANON_KEY');
console.log('  - SUPABASE_RUNTIME_SERVICE_ROLE_KEY');
console.log('  - SUPABASE_CORPUS_URL');
console.log('  - SUPABASE_CORPUS_ANON_KEY');
console.log('  - SUPABASE_CORPUS_SERVICE_ROLE_KEY');
console.log('');
console.log('Legacy variables (DATABASE_URL, SUPABASE_URL, etc.) are preserved.');
console.log('Restart your dev server for changes to take effect.');

