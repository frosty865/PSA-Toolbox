# Host V3 (standalone product)

This folder is the **Host V3 product workspace** inside PSA Toolbox: assets, documentation, and future shared modules that belong to Host V3 **as its own product line**, separate from dependency-assessment internals.

## Web UI (unified system)

The **web surface** for Host V3 is **not** a second dev server. It is served by the **same Next.js app** as the rest of the toolbox:

- **URL:** [`/host-v3/`](../../dependency-analysis/apps/web/app/host-v3/) (e.g. `http://localhost:3000/host-v3/` when you run `pnpm dev` from `tools/dependency-analysis`).
- **One process:** `pnpm dev` in `tools/dependency-analysis` runs the unified app (landing `/`, Host V3 `/host-v3/`, dependency analysis `/assessment/…`).

Registering Host V3 in [`../../tools-manifest.json`](../../tools-manifest.json) uses **`entryPath": "/host-v3/"`** so the toolbox landing and launcher stay consistent.

## Source repository (optional)

If Host V3 also has its **own Git remote**, you can still clone or submodule extra content **into this directory** (or a subfolder) and import from the Next route as you grow the product.

## Legacy note

An earlier **Vite-on-:3001** scaffold was removed in favor of this unified model.
