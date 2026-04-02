#!/usr/bin/env node
/**
 * Test Pages Functionally
 * 
 * Actually tests pages by checking for:
 * - Real runtime errors in HTML
 * - Missing API endpoints
 * - Broken imports
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

// Pages that should work
const WORKING_PAGES = [
  '/',
  '/assessments',
  '/ofcs',
  '/admin',
  '/coverage',
  '/sectors',
  '/disciplines',
  '/reference/question-focus',
  '/admin/doctrine/validation',
  '/admin/doctrine/freeze',
  '/admin/data/coverage',
  '/admin/data/coverage-dashboard',
  '/admin/data/gap-analysis',
  '/admin/data/canonical-content',
  '/admin/data/candidates',
  '/admin/data/library-ingestion',
  '/admin/coverage',
  '/admin/analysis/assessments',
  '/admin/review-statements',
  '/admin/analysis/gap-detection',
];

function fetchPage(route) {
  return new Promise((resolve) => {
    const url = `${BASE_URL}${route}`;
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          route,
          statusCode: res.statusCode,
          html: data,
          size: data.length
        });
      });
    }).on('error', (err) => {
      resolve({
        route,
        statusCode: 0,
        error: err.message,
        html: ''
      });
    });
  });
}

function checkForErrors(html) {
  const errors = [];
  
  // Check for Next.js error pages
  if (html.includes('404: This page could not be found')) {
    errors.push('404 Not Found');
  }
  if (html.includes('500: Internal Server Error')) {
    errors.push('500 Server Error');
  }
  if (html.includes('Application error: a client-side exception has occurred')) {
    errors.push('Client-side exception');
  }
  if (html.includes('Error:') && html.includes('at ') && html.includes('ErrorBoundary')) {
    errors.push('Runtime error detected');
  }
  
  // Check for broken API calls (common patterns)
  if (html.includes('Failed to fetch') || html.includes('NetworkError') || html.includes('ECONNREFUSED')) {
    errors.push('API connection error');
  }
  
  return errors;
}

async function testAllPages() {
  console.log('\n=== FUNCTIONAL PAGE TESTING ===\n');
  console.log(`Testing ${WORKING_PAGES.length} pages...\n`);
  
  const results = [];
  
  for (const route of WORKING_PAGES) {
    const result = await fetchPage(route);
    const errors = checkForErrors(result.html);
    const isWorking = result.statusCode === 200 && errors.length === 0;
    
    results.push({
      ...result,
      errors,
      working: isWorking
    });
    
    if (isWorking) {
      console.log(`✅ ${route} - Working (${result.size} bytes)`);
    } else if (result.statusCode === 0) {
      console.log(`❌ ${route} - Connection failed: ${result.error}`);
    } else if (result.statusCode !== 200) {
      console.log(`❌ ${route} - HTTP ${result.statusCode}`);
    } else {
      console.log(`⚠️  ${route} - Has errors: ${errors.join(', ')}`);
    }
  }
  
  console.log('\n=== SUMMARY ===');
  const working = results.filter(r => r.working).length;
  const broken = results.filter(r => !r.working).length;
  
  console.log(`✅ Working: ${working}`);
  console.log(`❌ Broken: ${broken}`);
  
  if (broken > 0) {
    console.log('\n❌ BROKEN PAGES:');
    results.filter(r => !r.working).forEach(r => {
      console.log(`  - ${r.route} (${r.statusCode || 'Connection error'}) ${r.errors.length > 0 ? '- ' + r.errors.join(', ') : ''}`);
    });
  }
  
  return results;
}

testAllPages().catch(console.error);

