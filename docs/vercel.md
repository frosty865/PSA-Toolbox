# Deploy PSA Toolbox web app on Vercel

The Next.js app is **`tools/dependency-analysis/apps/web`** (that is where `next.config.js` lives). Vercel must use that path as the **project Root Directory** so the framework is detected as Next.js and the deployment wires serverless routes correctly. Using the parent folder (`tools/dependency-analysis` only) has no `next.config.js` at that level and can produce **`404 NOT_FOUND`** on the live site.

## One-time project settings

1. Open the Vercel project → **Settings** → **General**.
2. Set **Root Directory** to: **`tools/dependency-analysis/apps/web`**
3. Save. Redeploy (clear build cache if the previous root was wrong).

Optional: enable **Include files outside the root directory in the Build Step** if a future change needs files above `apps/web` in the serverless bundle (the Git clone still contains the full repo for the build step).

## What the repo contains

- **`tools/dependency-analysis/apps/web/vercel.json`** — `installCommand` and `buildCommand` run from the workspace root (`cd ..` → `tools/dependency-analysis`) so pnpm installs all workspace packages; **`outputDirectory` is omitted** so Vercel’s Next.js builder uses `apps/web/.next` normally.
- No **`vercel.json`** at the Git repository root — avoids mixed root/subpath output bugs.

Local preview of the same install/build:

```bash
cd tools/dependency-analysis
npx --yes pnpm@9.15.0 install --frozen-lockfile
VERCEL=1 pnpm run build:web
```
