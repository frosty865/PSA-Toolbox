import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExpansionProfileUpsert } from '@/app/lib/admin/expansionProfiles';

test('parseExpansionProfileUpsert accepts a valid expansion profile payload', () => {
  const parsed = parseExpansionProfileUpsert({
    profile_id: 'power-generation-v1',
    sector: 'energy',
    subsector: 'generation',
    version: 1,
    effective_date: '2026-03-21',
    status: 'ACTIVE',
    description: 'Baseline expansion profile',
  });

  assert.equal(parsed.profile_id, 'power-generation-v1');
  assert.equal(parsed.status, 'ACTIVE');
  assert.equal(parsed.version, 1);
});

test('parseExpansionProfileUpsert rejects invalid payloads', () => {
  assert.throws(
    () =>
      parseExpansionProfileUpsert({
        profile_id: '',
        sector: 'energy',
        subsector: 'generation',
        version: 0,
        effective_date: '',
        status: 'BROKEN',
      }),
    /version must be a positive integer|Invalid option|profile_id is required/
  );
});
