/**
 * Release gate: run template check, engine tests, web tests, and export smoke in order.
 * Fail fast on first failure. Run from repo root: pnpm release:gate
 */
import { spawnSync } from 'child_process';
import path from 'path';

const root = path.resolve(process.cwd());

function run(name: string, command: string, args: string[], cwd: string = root): boolean {
  console.log(`\n--- ${name} ---`);
  const r = spawnSync(command, args, { cwd, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`\nRelease gate failed at: ${name}`);
    process.exit(r.status ?? 1);
  }
  return true;
}

console.log('Release gate (fail fast)');

run('template:check', 'pnpm', ['template:check']);
run('dependency contract', 'pnpm', ['--filter', 'web', 'run', 'validate:dependency-contract']);
run('dependency parity', 'pnpm', ['run', 'validate:deps']);
run('engine test', 'pnpm', ['--filter', 'engine', 'test']);
run('web test', 'pnpm', ['--filter', 'web', 'test']);
run('export smoke', 'pnpm', ['--filter', 'web', 'run', 'exportSmoke']);

console.log('\n--- All gates passed ---');
