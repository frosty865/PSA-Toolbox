#!/usr/bin/env npx ts-node
/**
 * Seed dependency_vofc_local.json with minimal approved rows.
 * Run from asset-dependency-tool: pnpm exec ts-node scripts/seed_dependency_vofc.ts
 */
import path from 'path';
import fs from 'fs/promises';

const REPO_ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(REPO_ROOT, 'data', 'dependency_vofc_local.json');

const SEED_ROWS = [
  {
    id: 'dep-ep-001',
    condition_code: 'EP_SINGLE_FEED',
    infrastructure: 'ENERGY',
    vulnerability_text: 'Electric service may rely on a single feed or limited diversity.',
    ofc_1: 'Evaluate the feasibility of establishing additional electric service connections with geographic separation.',
    source_type: 'VOFC_XLS',
    source_reference: 'VOFC_ENERGY_001',
    approved: true,
    version: 'dep_v1',
  },
  {
    id: 'dep-ep-002',
    condition_code: 'EP_NO_BACKUP_POWER',
    infrastructure: 'ENERGY',
    vulnerability_text: 'Backup power capability may be absent or insufficient for critical operations.',
    ofc_1: 'Evaluate the need for backup or alternate power capability to support critical operations during extended electric service outages.',
    source_type: 'VOFC_XLS',
    source_reference: 'VOFC_ENERGY_002',
    approved: true,
    version: 'dep_v1',
  },
  {
    id: 'dep-com-001',
    condition_code: 'COM_SHARED_ENTRY',
    infrastructure: 'COMMUNICATIONS',
    vulnerability_text: 'Communications paths may share facility entry points with other utilities.',
    ofc_1: 'Evaluate path diversity and facility entry separation for communications services.',
    source_type: 'VOFC_XLS',
    source_reference: 'VOFC_COM_001',
    approved: true,
    version: 'dep_v1',
  },
  {
    id: 'dep-it-001',
    condition_code: 'IT_NO_REDUNDANT_CARRIER',
    infrastructure: 'INFORMATION_TRANSPORT',
    vulnerability_text: 'IT services may rely on a single carrier or path with no redundant options.',
    ofc_1: 'Evaluate carrier diversity and alternate path options for externally hosted or managed digital services.',
    source_type: 'VOFC_XLS',
    source_reference: 'VOFC_IT_001',
    approved: true,
    version: 'dep_v1',
  },
  {
    id: 'dep-w-001',
    condition_code: 'W_SINGLE_CONN',
    infrastructure: 'WATER',
    vulnerability_text: 'Water service may rely on a single connection with no alternate source.',
    ofc_1: 'Evaluate alternate water sources or connections for critical operations.',
    source_type: 'VOFC_XLS',
    source_reference: 'VOFC_WATER_001',
    approved: true,
    version: 'dep_v1',
  },
  {
    id: 'dep-ww-001',
    condition_code: 'WW_SINGLE_CONN',
    infrastructure: 'WASTEWATER',
    vulnerability_text: 'Wastewater conveyance may rely on a single connection with limited redundancy.',
    ofc_1: 'Evaluate alternate conveyance options for wastewater during service disruption.',
    source_type: 'VOFC_XLS',
    source_reference: 'VOFC_WW_001',
    approved: true,
    version: 'dep_v1',
  },
];

async function main() {
  const dir = path.dirname(DATA_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(SEED_ROWS, null, 2), 'utf-8');
  console.log(`Seeded ${SEED_ROWS.length} rows to ${DATA_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
