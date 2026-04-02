# Removing or deprecating a tool

Optional tools under **`tools/<id>/`** are **not** pnpm workspace members of `tools/dependency-analysis`. Deleting a tool folder does not break `pnpm install` or `pnpm run build:web` there—only **`tools-manifest.json`** (and synced `apps/web/data/tools-manifest.json`) need to stay accurate for the landing UI.

## Checklist

1. **`tools-manifest.json`** — Remove the tool’s entry. Run `pnpm sync:manifest` at the repo root, then commit `tools/dependency-analysis/apps/web/data/tools-manifest.json` when it changes.
2. **Next.js shell** — Landing and `/t/[toolId]` are manifest-driven only.
3. **Optional cleanup** — Remove `next.config.js` rewrites or `public/` assets that existed only for that tool if you want old URLs gone (404s, not build failures).
4. **Verify** — From repo root: `pnpm verify:tools` (manifest paths on disk).

## What stays stable

- **`tools/dependency-analysis/`** installs and builds **only** its own `apps/*` and `packages/*`. Other tools are separate checkouts; dev may start them side by side (see `scripts/dev.js`) if their folders exist.
