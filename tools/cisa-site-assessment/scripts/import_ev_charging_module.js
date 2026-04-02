#!/usr/bin/env node
/**
 * Import EV Charging Module
 * 
 * Imports the EV Charging module with baseline_references instead of baseline questions.
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

async function importModule() {
  // Use v2 format (module_questions and module_ofcs)
  const jsonPath = path.join(__dirname, '..', 'analytics', 'extracted', 'module_ev_charging_import_v2.json');
  
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Import file not found: ${jsonPath}`);
    process.exit(1);
  }
  
  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
  const payload = JSON.parse(jsonContent);
  
  console.log('\n=== Importing EV Charging Module ===\n');
  console.log(`Module Code: ${payload.module_code}`);
  console.log(`Title: ${payload.title}`);
  console.log(`Module Questions: ${payload.module_questions?.length || 0}`);
  console.log(`Module OFCs: ${payload.module_ofcs?.length || 0}\n`);
  
  try {
    const response = await fetch('http://localhost:3000/api/admin/modules/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: jsonContent,
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.ok) {
      console.error('❌ Import failed:', data.error || 'Unknown error');
      process.exit(1);
    }
    
    console.log('✅ Import successful!\n');
    console.log('Results:');
    console.log(`  Module Code: ${data.result.module_code}`);
    console.log(`  Module Questions Imported: ${data.result.module_questions_imported || 0}`);
    console.log(`  Module OFCs Imported: ${data.result.module_ofcs_imported || 0}`);
    console.log(`  Sources Imported: ${data.result.sources_imported || 0}`);
    console.log(`  Sources Registered: ${data.result.sources_registered || 0}`);
    if (data.result.sources_skipped !== undefined && data.result.sources_skipped > 0) {
      console.log(`  Sources Skipped (duplicates): ${data.result.sources_skipped}`);
    }
    console.log('\n✅ Module imported successfully!');
    console.log(`\nView module details at: http://localhost:3000/admin/modules/${payload.module_code}`);
    
  } catch (error) {
    console.error('❌ Import error:', error.message);
    console.error('\nMake sure the Next.js dev server is running on http://localhost:3000');
    process.exit(1);
  }
}

importModule().catch(console.error);
