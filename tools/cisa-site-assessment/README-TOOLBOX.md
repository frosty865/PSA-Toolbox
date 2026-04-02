# CISA Site Assessment — PSA Toolbox integration

This directory is a **full copy** of PSA Rebuild (CISA Site Assessment UI), integrated with the PSA Toolbox dev workflow.

## How it runs with the toolbox

1. From **`tools/dependency-analysis`**, run **`pnpm install`** (IDA workspace only). From **`tools/cisa-site-assessment`**, run **`pnpm install`** for this app (it is not a workspace member of IDA—optional tool).
2. Run **`pnpm dev`** from `tools/dependency-analysis` (starts both IDA and PSA; do not use only `pnpm --filter web dev` if you need the proxy). That starts:
   - **IDA / unified app** on **http://localhost:3000**
   - **This Next app** on **http://127.0.0.1:3001** (`next dev --hostname 127.0.0.1` so the :3000 proxy can reach IPv4 loopback) with `basePath` **`/cisa-site-assessment`**
3. Open the Site Assessment at **http://localhost:3000/cisa-site-assessment/** — traffic is **forwarded** by **`apps/web/app/cisa-site-assessment/[[...slug]]/route.ts`** (Node route handler, not middleware), so requests avoid Next **proxy/middleware** adapter issues in dev.

Optional: **`PSA_SITE_ASSESSMENT_ORIGIN`** (default `http://127.0.0.1:3001`) if PSA listens elsewhere.

Set **`PSA_TOOLBOX_SKIP_SITE_ASSESSMENT=1`** if you only want the IDA server (no PSA / DB).

## Environment and data

- Copy **`.env.local`** from your PSA System deployment if needed (`RUNTIME_DATABASE_URL`, `CORPUS_DATABASE_URL`, `PSA_SYSTEM_ROOT`, etc.). See `.env.example` in this folder.
- Runtime data and logs may still resolve via **`PSA_SYSTEM_ROOT`** (default in upstream docs: `D:\PSA_System`). Point that at your system root, or adjust paths in `.env.local`.

## Production

Building PSA Rebuild from this tree is **not** part of `pnpm run build` in `dependency-analysis` (that build is IDA-only). To build Site Assessment separately, run **`npm run build`** here after satisfying guard scripts and databases, or use your existing PSA deployment pipeline.

## Upstream

Original development layout: `D:\PSA_System\psa_rebuild`. Refresh this copy with robocopy when you need to sync.
