#!/usr/bin/env tsx
/**
 * Test script for promoting an OFC candidate
 * 
 * Usage:
 *   tsx tools/dev/test_promote_candidate.ts <candidate_id>
 * 
 * Example:
 *   tsx tools/dev/test_promote_candidate.ts 123e4567-e89b-12d3-a456-426614174000
 */

const CANDIDATE_ID = process.argv[2];

if (!CANDIDATE_ID) {
  console.error('Usage: tsx tools/dev/test_promote_candidate.ts <candidate_id>');
  process.exit(1);
}

const API_URL = process.env.API_URL || 'http://localhost:3000';
const ENDPOINT = `${API_URL}/api/admin/ofcs/candidates/${CANDIDATE_ID}`;

async function testPromote() {
  console.log(`[TEST] Testing PATCH ${ENDPOINT}`);
  console.log(`[TEST] Candidate ID: ${CANDIDATE_ID}`);
  console.log(`[TEST] Payload:`, JSON.stringify({
    status: 'PROMOTED',
    reviewed_by: 'ADMIN'
  }, null, 2));
  console.log('');

  try {
    const response = await fetch(ENDPOINT, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'PROMOTED',
        reviewed_by: 'ADMIN'
      })
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
    console.log(`[RESULT] Response:`, JSON.stringify(data, null, 2));
    console.log('');

    if (response.ok) {
      if (data.ok === true || data.success === true) {
        console.log(`[SUCCESS] Candidate promoted successfully`);
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

testPromote();
