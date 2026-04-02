#!/usr/bin/env node
/**
 * Test All Routes Locally
 * 
 * Tests all routes that are linked in navigation
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

const ROUTES_TO_TEST = [
  // Main navigation
  '/',
  '/assessments',
  '/ofcs',
  '/admin',
  
  // Taxonomy dropdown
  '/coverage',
  '/sectors',
  '/disciplines',
  '/reference/question-focus',
  
  // Admin pages (from registry)
  '/admin/doctrine/validation',
  '/admin/doctrine/freeze',
  '/admin/data/coverage',
  '/admin/data/coverage-dashboard',
  '/admin/data/gap-analysis',
  '/admin/data/canonical-content',
  '/admin/data/candidates',
  '/admin/data/library-ingestion',
  '/admin/coverage', // Newly added
  '/admin/analysis/assessments',
  '/admin/review-statements',
  '/admin/analysis/gap-detection',
];

function testRoute(route) {
  return new Promise((resolve) => {
    const url = `${BASE_URL}${route}`;
    const startTime = Date.now();
    
    http.get(url, (res) => {
      const statusCode = res.statusCode;
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const hasError = data.includes('Error:') || data.includes('error') || data.includes('404');
        const isWorking = statusCode === 200 && !hasError;
        
        resolve({
          route,
          statusCode,
          duration,
          working: isWorking,
          hasError
        });
      });
    }).on('error', (err) => {
      resolve({
        route,
        statusCode: 0,
        duration: 0,
        working: false,
        error: err.message
      });
    });
  });
}

async function testAllRoutes() {
  console.log('\n=== TESTING ALL ROUTES LOCALLY ===\n');
  console.log(`Testing ${ROUTES_TO_TEST.length} routes...\n`);
  
  const results = [];
  
  for (const route of ROUTES_TO_TEST) {
    const result = await testRoute(route);
    results.push(result);
    
    if (result.working) {
      console.log(`✅ ${route} - ${result.statusCode} (${result.duration}ms)`);
    } else if (result.statusCode === 0) {
      console.log(`❌ ${route} - Connection error: ${result.error}`);
    } else {
      console.log(`⚠️  ${route} - ${result.statusCode} ${result.hasError ? '(has errors)' : ''}`);
    }
  }
  
  console.log('\n=== SUMMARY ===');
  const working = results.filter(r => r.working).length;
  const broken = results.filter(r => !r.working && r.statusCode > 0).length;
  const failed = results.filter(r => r.statusCode === 0).length;
  
  console.log(`✅ Working: ${working}`);
  console.log(`⚠️  Broken: ${broken}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (broken > 0 || failed > 0) {
    console.log('\n⚠️  BROKEN ROUTES:');
    results.filter(r => !r.working).forEach(r => {
      console.log(`  - ${r.route} (${r.statusCode || 'Connection error'})`);
    });
  }
  
  return results;
}

testAllRoutes().catch(console.error);

