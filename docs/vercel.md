# Deploy PSA Toolbox web app on Vercel

The Next.js app is **`tools/dependency-analysis/apps/web`** (that is where `next.config.js` lives). Vercel must use that path as the **project Root Directory** so the framework is detected as Next.js and the deployment wires serverless routes correctly. Using the parent folder (`tools/dependency-analysis` only) has no `next.config.js` at that level and can produce **`404 NOT_FOUND`** on the live site.

## One-time project settings

1. Open the Vercel project → **Settings** → **General**.
2. Set **Root Directory** to: **`tools/dependency-analysis/apps/web`**
3. Save. Redeploy (clear build cache if the previous root was wrong).

Optional: enable **Include files outside the root directory in the Build Step** if a future change needs files above `apps/web` in the serverless bundle (the Git clone still contains the full repo for the build step).

## Modular Site Assessment (proxied at `/cisa-site-assessment/`)

The toolbox app **reverse-proxies** the Modular Site Assessment UI. On your laptop, the default upstream is local PSA on port **3001**. **On Vercel there is no localhost**, so you must configure production:

1. Deploy **`tools/cisa-site-assessment`** as a **separate** Vercel project (or any HTTPS host with `basePath` `/cisa-site-assessment`).
2. On **this** (toolbox / IDA) Vercel project → **Settings → Environment Variables**, add:
   - **`PSA_SITE_ASSESSMENT_ORIGIN`** = the PSA deployment **origin** only, e.g. `https://your-psa.vercel.app` (no trailing slash).
3. Redeploy the toolbox app.

Without `PSA_SITE_ASSESSMENT_ORIGIN`, requests to `/cisa-site-assessment/` on Vercel return **503** with setup instructions.

## What the repo contains

- **`tools/dependency-analysis/apps/web/vercel.json`** — `installCommand` and `buildCommand` run from the workspace root (`cd ..` → `tools/dependency-analysis`) so pnpm installs all workspace packages; **`outputDirectory` is omitted** so Vercel’s Next.js builder uses `apps/web/.next` normally.
- **`apps/web/next.config.js`** — when **`VERCEL`** is set, **`outputFileTracingRoot`** (and Turbopack **`root`**) use the **Git repository root** so traced paths stay under `tools/dependency-analysis/…`. If tracing used only the workspace folder, Vercel could map routes to `<repo>/apps/web` and fail at runtime with missing `next/dist/compiled/next-server/...`.
- No **`vercel.json`** at the Git repository root — avoids mixed root/subpath output bugs.

Local preview of the same install/build:

```bash
cd tools/dependency-analysis
npx --yes pnpm@9.15.0 install --frozen-lockfile
VERCEL=1 pnpm run build:web
```
