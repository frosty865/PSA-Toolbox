# Deploy PSA Toolbox web app on Vercel

The Next.js app lives under **`tools/dependency-analysis`**. Vercel must use that folder as the **project root** for the deployment. Building from the Git repository root breaks path resolution (`.next` / `routes-manifest.json`).

## One-time project settings

1. Open the Vercel project → **Settings** → **General**.
2. Set **Root Directory** to: **`tools/dependency-analysis`**
3. Save. Redeploy.

Optional: enable **Include files outside the root directory in the Build Step** if you later need the build to read paths above that folder (most builds only need this workspace).

## What the repo contains

- **`tools/dependency-analysis/vercel.json`** — `installCommand`, `buildCommand`, and `outputDirectory` relative to that root (`apps/web/.next`).
- No **`vercel.json`** at the repository root — avoids mixed root/subpath output bugs.

Local preview of the same install/build:

```bash
cd tools/dependency-analysis
npx --yes pnpm@9.15.0 install --frozen-lockfile
VERCEL=1 pnpm run build:web
```
