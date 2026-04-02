#!/usr/bin/env tsx
/**
 * Verify EV_PARKING Standard Migration
 * 
 * Checks that the EV_PARKING standard was updated to vv1.1
 */

import * as dotenv from 'dotenv';
import { getCorpusPool } from '../app/lib/db/corpus_client';

dotenv.config({ path: '.env.local' });

async function main() {
  const pool = getCorpusPool();

  try {
    // Check version
    const versionResult = await pool.query(
      `SELECT version, updated_at FROM public.module_standards WHERE standard_key = 'EV_PARKING'`
    );
    
    if (versionResult.rows.length === 0) {
      console.log('[ERROR] EV_PARKING standard not found');
      process.exit(1);
    }

    const version = versionResult.rows[0].version;
    const updatedAt = versionResult.rows[0].updated_at;

    console.log(`[INFO] Standard version: ${version}`);
    console.log(`[INFO] Updated at: ${updatedAt}`);

    if (version !== 'v1.1') {
      console.log(`[WARN] Expected version v1.1, got ${version}`);
    } else {
      console.log('[OK] Version is correct (v1.1)');
    }

    // Check sample criteria
    const criteriaResult = await pool.query(
      `SELECT criterion_key, question_text 
       FROM public.module_standard_criteria 
       WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
       ORDER BY order_index 
       LIMIT 3`
    );

    console.log('\n[INFO] Sample criteria:');
    for (const row of criteriaResult.rows) {
      const preview = row.question_text.length > 80 
        ? row.question_text.substring(0, 80) + '...'
        : row.question_text;
      console.log(`  ${row.criterion_key}: ${preview}`);
    }

    // Check for forbidden terms in all criteria
    const allCriteria = await pool.query(
      `SELECT criterion_key, question_text 
       FROM public.module_standard_criteria 
       WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')`
    );

    const forbiddenTerms = ['code', 'compliance', 'sprinkler', 'manufacturer', 'nfpa', 'ul', 'nec'];
    let foundForbidden = false;

    for (const row of allCriteria.rows) {
      const text = row.question_text.toLowerCase();
      for (const term of forbiddenTerms) {
        if (text.includes(term)) {
          console.log(`\n[WARN] Found forbidden term "${term}" in ${row.criterion_key}: ${row.question_text.substring(0, 100)}`);
          foundForbidden = true;
        }
      }
    }

    if (!foundForbidden) {
      console.log('\n[OK] No forbidden terms found in criteria');
    }

    // Check OFCs
    const ofcResult = await pool.query(
      `SELECT template_key, ofc_text_template 
       FROM public.module_standard_criterion_ofc_templates 
       WHERE criterion_id IN (
         SELECT id FROM public.module_standard_criteria 
         WHERE standard_id = (SELECT id FROM public.module_standards WHERE standard_key = 'EV_PARKING')
       )
       ORDER BY order_index 
       LIMIT 3`
    );

    console.log('\n[INFO] Sample OFCs:');
    for (const row of ofcResult.rows) {
      const preview = row.ofc_text_template.length > 80 
        ? row.ofc_text_template.substring(0, 80) + '...'
        : row.ofc_text_template;
      console.log(`  ${row.template_key}: ${preview}`);
    }

    console.log('\n[OK] Migration verification complete');

  } catch (error) {
    console.error('[ERROR] Verification failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
