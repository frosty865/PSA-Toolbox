import test from 'node:test';
import assert from 'node:assert/strict';
import { parseServerToolBody, resolveServerToolConfig, runScopeFilterDiagnostic, WATCHER_COMMANDS } from '@/app/lib/admin/serverTools';

test('parseServerToolBody defaults params to an empty object', () => {
  const parsed = parseServerToolBody({
    toolId: 'db-audit',
    command: 'db:audit',
  });

  assert.deepEqual(parsed, {
    toolId: 'db-audit',
    command: 'db:audit',
    params: {},
  });
});

test('resolveServerToolConfig builds parameterized commands', () => {
  const config = resolveServerToolConfig('D:\\PSA_System\\psa_rebuild', 'db:debug-ingestion', {
    moduleCode: 'GEN-1',
  });

  assert.ok(config);
  assert.match(config.script, /debug_module_ingestion\.ts$/);
  assert.deepEqual(config.args, ['GEN-1']);
});

test('WATCHER_COMMANDS contains the long-running admin tasks', () => {
  assert.equal(WATCHER_COMMANDS.has('module:watch'), true);
  assert.equal(WATCHER_COMMANDS.has('db:audit'), false);
});

test('runScopeFilterDiagnostic returns a readable diagnostic summary', () => {
  const output = runScopeFilterDiagnostic('high-level coordination and response planning');

  assert.match(output, /PSA Scope Filter Result/);
  assert.match(output, /containsDeepNetworkCyber:/);
});
