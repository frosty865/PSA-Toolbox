#!/usr/bin/env npx tsx
/**
 * Legacy module generation CLI.
 *
 * The deployed site assessment tool no longer runs the Python-backed module
 * generation pipeline. Use the admin wizard or offline chunk extractor flow
 * instead.
 */

function main(): number {
  console.error(
    [
      "Legacy module generation CLI is retired in the deployed tool.",
      "Use the admin wizard or offline chunk extractor workflow instead.",
    ].join(" ")
  );
  return 1;
}

process.exitCode = main();
