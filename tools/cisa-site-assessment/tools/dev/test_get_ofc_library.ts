#!/usr/bin/env tsx
/**
 * Test script for GET /api/runtime/ofc-library
 * 
 * Usage:
 *   tsx tools/dev/test_get_ofc_library.ts [status]
 * 
 * Examples:
 *   tsx tools/dev/test_get_ofc_library.ts ACTIVE
 *   tsx tools/dev/test_get_ofc_library.ts RETIRED
 *   tsx tools/dev/test_get_ofc_library.ts BOGUS (expect 422)
 */

const STATUS = process.argv[2] || 'ACTIVE';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const ENDPOINT = `${API_URL}/api/runtime/ofc-library${STATUS ? `?status=${STATUS}` : ''}`;

async function testGetOfcLibrary() {
  console.log(`[TEST] Testing GET ${ENDPOINT}`);
  console.log(`[TEST] Status filter: ${STATUS || 'none (defaults to ACTIVE)'}`);
  console.log('');

  try {
    const response = await fetch(ENDPOINT, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });

    const status = response.status;
    const statusText = response.statusText;
    
    let data: any;
    try {
      data = await response.json();
    } catch (parseError) {
      const text = await response.text();
      console.error(`[ERROR] Failed to parse JSON response:`);
      console.error(`[ERROR] Status: ${status} ${statusText}`);
      console.error(`[ERROR] Body: ${text}`);
      process.exit(1);
    }

    console.log(`[RESULT] Status: ${status} ${statusText}`);
    console.log(`[RESULT] Response keys:`, Object.keys(data));
    
    // Handle both standardized and legacy formats
    let ofcs: any[] = [];
    if (data.ok === true && Array.isArray(data.ofcs)) {
      ofcs = data.ofcs;
      console.log(`[RESULT] Format: standardized ({ ok, requestId, ofcs })`);
    } else if (Array.isArray(data)) {
      ofcs = data;
      console.log(`[RESULT] Format: legacy (array)`);
    } else if (data.ofcs && Array.isArray(data.ofcs)) {
      ofcs = data.ofcs;
      console.log(`[RESULT] Format: legacy ({ ofcs })`);
    }
    
    if (data.requestId) {
      console.log(`[RESULT] Request ID: ${data.requestId}`);
    }
    
    console.log(`[RESULT] OFC count: ${ofcs.length}`);
    
    if (ofcs.length > 0) {
      console.log(`[RESULT] First OFC sample:`, JSON.stringify({
        ofc_id: ofcs[0].ofc_id,
        status: ofcs[0].status,
        scope: ofcs[0].scope,
        link_type: ofcs[0].link_type,
        link_key: ofcs[0].link_key,
        citation_count: ofcs[0].citation_count
      }, null, 2));
    }
    
    console.log('');

    if (response.ok) {
      if (data.ok === true || Array.isArray(data) || data.ofcs) {
        console.log(`[SUCCESS] Retrieved ${ofcs.length} OFC(s) successfully`);
        if (data.requestId) {
          console.log(`[INFO] Request ID: ${data.requestId}`);
        }
        process.exit(0);
      } else {
        console.error(`[ERROR] Response indicates failure despite ${status} status`);
        process.exit(1);
      }
    } else {
      console.error(`[ERROR] Request failed with status ${status}`);
      if (data.error) {
        console.error(`[ERROR] Code: ${data.error.code || 'UNKNOWN'}`);
        console.error(`[ERROR] Message: ${data.error.message || 'No message'}`);
        if (data.error.details) {
          console.error(`[ERROR] Details:`, JSON.stringify(data.error.details, null, 2));
        }
      }
      if (data.requestId) {
        console.error(`[INFO] Request ID: ${data.requestId}`);
      }
      process.exit(1);
    }
  } catch (err) {
    console.error(`[FATAL] Network or other error:`, err);
    if (err instanceof Error) {
      console.error(`[FATAL] Message: ${err.message}`);
      console.error(`[FATAL] Stack:`, err.stack);
    }
    process.exit(1);
  }
}

// Run single test with provided status
testGetOfcLibrary();
