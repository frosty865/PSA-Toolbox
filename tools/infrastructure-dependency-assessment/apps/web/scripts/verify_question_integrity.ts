/**
 * Run question integrity guard. Exit 1 on failure.
 * Usage: pnpm run verify:question-integrity (from repo root)
 */
import { verifyQuestionIntegrity } from '@/app/lib/guards/verify_question_integrity';

const result = verifyQuestionIntegrity({
  requireStructuredHelp: false,
  failOnUndefinedTerms: false,
});

if (result.errors.length > 0) {
  console.error('Question integrity check FAILED:');
  result.errors.forEach((e) => console.error('  -', e));
  process.exit(1);
}
console.log('Question integrity check passed.');
process.exit(0);
