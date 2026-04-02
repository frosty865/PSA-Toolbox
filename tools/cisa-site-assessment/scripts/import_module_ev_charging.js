require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const IMPORT_FILE = path.join(__dirname, '..', 'analytics', 'extracted', 'module_ev_charging_import.json');
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function importModule() {
  console.log('📦 Importing EV Charging Module...\n');
  
  if (!fs.existsSync(IMPORT_FILE)) {
    console.error(`❌ Import file not found: ${IMPORT_FILE}`);
    console.error('   Run: node scripts/build_module_ev_charging.js');
    process.exit(1);
  }

  const jsonContent = fs.readFileSync(IMPORT_FILE, 'utf8');
  const payload = JSON.parse(jsonContent);

  console.log(`📄 Module: ${payload.module_code}`);
  console.log(`   Questions: ${payload.module_questions?.length || 0}`);
  console.log(`   OFCs: ${payload.module_ofcs?.length || 0}`);
  console.log(`   Risk Drivers: ${payload.risk_drivers?.length || 0}\n`);

  try {
    console.log(`🌐 Sending import request to ${API_URL}/api/admin/modules/import...`);
    
    const response = await fetch(`${API_URL}/api/admin/modules/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: jsonContent,
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.ok) {
      console.error('❌ Import failed!\n');
      if (data.error) {
        console.error(`   Error: ${data.error}`);
      }
      if (data.linter_errors && data.linter_errors.length > 0) {
        console.error('\n   Linter Errors:');
        data.linter_errors.forEach((err, idx) => {
          console.error(`   ${idx + 1}. ${err}`);
        });
      }
      process.exit(1);
    }
    
    console.log('✅ Import successful!\n');
    console.log('📊 Results:');
    console.log(`   Module Code: ${data.result.module_code}`);
    console.log(`   Batch ID: ${data.result.batch_id}`);
    console.log(`   Module Questions Imported: ${data.result.module_questions_imported || 0}`);
    console.log(`   Module OFCs Imported: ${data.result.module_ofcs_imported || 0}`);
    console.log(`   Risk Drivers Imported: ${data.result.risk_drivers_imported || 0}`);
    console.log(`   Sources Imported: ${data.result.sources_imported || 0}`);
    console.log(`   Sources Registered: ${data.result.sources_registered || 0}`);
    if (data.result.sources_skipped !== undefined && data.result.sources_skipped > 0) {
      console.log(`   Sources Skipped (duplicates): ${data.result.sources_skipped}`);
    }
    
    console.log(`\n🔗 View module details at: ${API_URL}/admin/modules/${payload.module_code}`);
    
  } catch (error) {
    console.error('❌ Import error:', error.message);
    console.error('\n💡 Make sure the Next.js dev server is running:');
    console.error('   npm run dev');
    process.exit(1);
  }
}

importModule().catch(console.error);
