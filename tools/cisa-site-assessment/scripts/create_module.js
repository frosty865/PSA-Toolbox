#!/usr/bin/env node
/**
 * Automated Module Creation Script
 * 
 * Creates a module from a JSON file or command-line arguments.
 * 
 * Usage:
 *   node scripts/create_module.js --file path/to/module.json
 *   node scripts/create_module.js --code MODULE_X --title "Title" --description "Description"
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function createModuleFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  const jsonContent = fs.readFileSync(filePath, 'utf8');
  const payload = JSON.parse(jsonContent);

  console.log('📦 Creating and importing module from file...\n');
  console.log(`   Module Code: ${payload.module_code}`);
  console.log(`   Title: ${payload.title}`);
  console.log(`   Questions: ${payload.module_questions?.length || 0}`);
  console.log(`   OFCs: ${payload.module_ofcs?.length || 0}`);
  console.log(`   Risk Drivers: ${payload.risk_drivers?.length || 0}\n`);

  try {
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

    console.log('✅ Module created and imported successfully!\n');
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
    console.error('❌ Error:', error.message);
    console.error('\n💡 Make sure the Next.js dev server is running:');
    console.error('   npm run dev');
    process.exit(1);
  }
}

async function createModuleMetadata(code, title, description) {
  console.log('📦 Creating module metadata...\n');
  console.log(`   Module Code: ${code}`);
  console.log(`   Title: ${title}`);
  if (description) {
    console.log(`   Description: ${description}`);
  }
  console.log();

  try {
    const response = await fetch(`${API_URL}/api/admin/modules/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        module_code: code,
        title: title,
        description: description || null
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Creation failed!\n');
      console.error(`   Error: ${data.error || 'Unknown error'}`);
      process.exit(1);
    }

    console.log('✅ Module created successfully!\n');
    console.log('📊 Module Info:');
    console.log(`   Module Code: ${data.module_code}`);
    console.log(`   Title: ${data.module_name}`);
    console.log(`   Status: ${data.status}`);
    console.log(`\n🔗 View module details at: ${API_URL}/admin/modules/${data.module_code}`);
    console.log(`\n💡 Next step: Import module content using:`);
    console.log(`   node scripts/import_module_ev_charging.js`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n💡 Make sure the Next.js dev server is running:');
    console.error('   npm run dev');
    process.exit(1);
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage:');
    console.error('  node scripts/create_module.js --file <path-to-module.json>');
    console.error('  node scripts/create_module.js --code MODULE_X --title "Title" [--description "Description"]');
    process.exit(1);
  }

  let filePath = null;
  let code = null;
  let title = null;
  let description = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && i + 1 < args.length) {
      filePath = args[i + 1];
      i++;
    } else if (args[i] === '--code' && i + 1 < args.length) {
      code = args[i + 1];
      i++;
    } else if (args[i] === '--title' && i + 1 < args.length) {
      title = args[i + 1];
      i++;
    } else if (args[i] === '--description' && i + 1 < args.length) {
      description = args[i + 1];
      i++;
    }
  }

  if (filePath) {
    createModuleFromFile(filePath).catch(console.error);
  } else if (code && title) {
    createModuleMetadata(code, title, description).catch(console.error);
  } else {
    console.error('❌ Invalid arguments. Use --file <path> or --code <code> --title <title>');
    process.exit(1);
  }
}

main();
