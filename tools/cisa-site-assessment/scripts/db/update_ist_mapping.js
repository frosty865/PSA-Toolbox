#!/usr/bin/env node
/**
 * Update IST Sheet to Taxonomy Mapping
 * Queries database for discipline UUIDs and updates the mapping file.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { loadEnvLocal } = require('../lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('../lib/pg_tls');

loadEnvLocal(path.join(__dirname, '../..'));

function similarity(a, b) {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  const editDistance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
  if (longer.length === 0) return 1.0;
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

function findBestMatch(sheetName, disciplines) {
  let bestMatch = null;
  let bestScore = 0.0;

  for (const disc of disciplines) {
    const discName = disc.name;
    // Try exact match first
    if (sheetName.toLowerCase() === discName.toLowerCase()) {
      return { match: disc, score: 1.0 };
    }

    // Try partial match
    if (sheetName.toLowerCase().includes(discName.toLowerCase()) || 
        discName.toLowerCase().includes(sheetName.toLowerCase())) {
      const score = similarity(sheetName, discName);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = disc;
      }
    }
  }

  // If no good match, try fuzzy matching
  if (bestScore < 0.6) {
    for (const disc of disciplines) {
      const score = similarity(sheetName, disc.name);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = disc;
      }
    }
  }

  return { match: bestMatch, score: bestScore };
}

async function main() {
  const scriptDir = __dirname;
  const mappingPath = path.join(scriptDir, 'ist_sheet_to_taxonomy_map.json');

  console.log('='.repeat(80));
  console.log('Update IST Sheet to Taxonomy Mapping');
  console.log('='.repeat(80));
  console.log();

  // Load existing mapping
  if (!fs.existsSync(mappingPath)) {
    console.error(`ERROR: Mapping file not found: ${mappingPath}`);
    process.exit(1);
  }

  const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));

  // Get sheet names (exclude comment keys)
  const sheetNames = Object.keys(mapping).filter(k => !k.startsWith('_'));
  console.log(`Found ${sheetNames.length} sheet names to map:`);
  for (const name of sheetNames) {
    console.log(`  - ${name}`);
  }

  // Connect to database
  console.log('\nConnecting to database...');
  let pool;
  try {
    let connectionString = process.env.DATABASE_URL;

    if (!connectionString && process.env.DATABASE_USER && process.env.DATABASE_PASSWORD) {
      const host = process.env.DATABASE_HOST || 'localhost';
      const port = process.env.DATABASE_PORT || '5432';
      const dbname = process.env.DATABASE_NAME || 'postgres';
      const encodedPassword = encodeURIComponent(process.env.DATABASE_PASSWORD);
      connectionString = `postgresql://${process.env.DATABASE_USER}:${encodedPassword}@${host}:${port}/${dbname}`;
    }

    if (!connectionString) {
      throw new Error('DATABASE_URL or DATABASE_USER/DATABASE_PASSWORD must be set');
    }

    const normalizedUrl = ensureNodePgTls(connectionString) ?? connectionString;
    pool = new Pool(
      applyNodeTls({
        connectionString: normalizedUrl,
        ssl: { rejectUnauthorized: false },
      })
    );

    console.log('✓ Connected');
  } catch (error) {
    console.error(`ERROR: Failed to connect to database: ${error.message}`);
    process.exit(1);
  }

  try {
    // Query disciplines
    const result = await pool.query(`
      SELECT id, name, code, category
      FROM disciplines
      WHERE is_active = true
      ORDER BY name
    `);

    const disciplines = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      code: row.code,
      category: row.category
    }));

    console.log(`\nFound ${disciplines.length} active disciplines in database`);

    // Match sheet names to disciplines
    console.log('\nMatching sheet names to disciplines...');
    let updatedCount = 0;
    const unmatched = [];

    for (const sheetName of sheetNames) {
      const { match, score } = findBestMatch(sheetName, disciplines);

      if (match && score >= 0.5) {
        mapping[sheetName].discipline_id = match.id;
        console.log(`  ✓ ${sheetName} → ${match.name} (score: ${score.toFixed(2)})`);
        console.log(`    UUID: ${match.id}`);
        updatedCount++;
      } else {
        unmatched.push(sheetName);
        console.log(`  ✗ ${sheetName} → No good match found (best score: ${score.toFixed(2)})`);
      }
    }

    // Handle unmatched
    if (unmatched.length > 0) {
      console.log(`\n⚠ ${unmatched.length} sheet name(s) could not be automatically matched:`);
      for (const name of unmatched) {
        console.log(`  - ${name}`);
      }
      console.log('\nAvailable disciplines:');
      for (const disc of disciplines) {
        console.log(`  - ${disc.name} (code: ${disc.code}, category: ${disc.category})`);
      }
      console.log('\nPlease manually update these in the mapping file.');
    }

    // Save updated mapping
    console.log(`\nSaving updated mapping to ${mappingPath}`);
    fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2) + '\n', 'utf-8');

    console.log(`\n✓ Updated ${updatedCount}/${sheetNames.length} mappings`);
    if (unmatched.length > 0) {
      console.log(`⚠ ${unmatched.length} require manual update`);
    }
    console.log('='.repeat(80));
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

