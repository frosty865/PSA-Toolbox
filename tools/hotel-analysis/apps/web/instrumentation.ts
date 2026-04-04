/**
 * Run purge on server start (no retention).
 * Skip during next build to avoid EPERM/scandir errors on Windows when os.tmpdir() contains locked dirs (e.g. pytest).
 * Uses process.env (Edge-safe) instead of process.argv.
 */
export async function register() {
  const isBuild = process.env.npm_lifecycle_event === 'build';
  if (process.env.NEXT_RUNTIME === 'nodejs' && !isBuild) {
    const { purgeAll, getRepoRoot } = await import('./app/lib/purge/purgeAll');
    await purgeAll(getRepoRoot()).catch(() => {});
  }
}
