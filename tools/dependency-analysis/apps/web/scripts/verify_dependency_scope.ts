/**
 * Run IT/CO dependency scope guard. Exit 1 on failure.
 * Usage: pnpm run verify:dependency-scope (from repo root)
 */
import { verifyDependencyScope } from '@/app/lib/guards/verify_dependency_scope';

const result = verifyDependencyScope();

if (result.errors.length > 0) {
  console.error('Dependency scope check FAILED:\n');
  result.errors.forEach((e) => console.error(e + '\n'));
  process.exit(1);
}
console.log('Dependency scope check passed.');
process.exit(0);
