#!/usr/bin/env node
/**
 * Test Module API response directly
 */

const http = require('http');

async function testModuleAPI() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/module-ofcs/list',
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

async function main() {
  console.log('='.repeat(80));
  console.log('Testing Module API Response');
  console.log('='.repeat(80));
  console.log('');
  console.log('⚠️  Note: This requires the Next.js dev server to be running on port 3000');
  console.log('');
  
  try {
    const result = await testModuleAPI();
    console.log(`Status: ${result.status}`);
    console.log(`Success: ${result.data.success}`);
    console.log(`Candidates returned: ${result.data.ofcs?.length || 0}`);
    
    if (result.data.ofcs && result.data.ofcs.length > 0) {
      console.log('\n⚠️  WARNING: API returned candidates:');
      result.data.ofcs.slice(0, 5).forEach((ofc, idx) => {
        console.log(`\n   ${idx + 1}. ID: ${ofc.id}`);
        console.log(`      Title: ${ofc.title || '(no title)'}`);
        console.log(`      Status: ${ofc.status}`);
      });
    } else {
      console.log('\n✅ API correctly returns 0 candidates');
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Could not connect to server. Is Next.js dev server running?');
      console.log('   Start it with: npm run dev');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

main().catch(console.error);
