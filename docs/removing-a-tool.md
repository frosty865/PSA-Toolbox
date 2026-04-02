# Removing or deprecating a tool

The monorepo stays healthy if you treat the **manifest** and **pnpm workspace** as the source of truth and keep the Next shell **manifest-driven**.

## Checklist

1. **`tools-manifest.json`** — Remove the tool’s entry (or never add deprecated tools). Run `pnpm sync:manifest` at the repo root, then commit `tools/dependency-analysis/apps/web/data/tools-manifest.json` when it changes.
2. **`tools/dependency-analysis/pnpm-workspace.yaml`** — If the tool was listed here (e.g. `../cisa-site-assessment`), **remove that line**. A missing folder with a workspace entry will break `pnpm install`.
3. **Next.js shell** — Landing links and `/t/[toolId]` use `tools-manifest.json` only; no per-tool IDs are hardcoded on the home page anymore.
4. **Optional cleanup** — Remove `next.config.js` rewrites or `public/` assets that existed only for that tool (otherwise you may get 404s for old URLs, not build failures).
5. **Verify** — From repo root: `pnpm verify:tools` (confirms manifest paths and workspace entries exist on disk).

## What stays stable

- **`tools/dependency-analysis/`** (the Next app) does not import other tools’ source as packages except via the workspace member above; removing a tool folder does not break TypeScript in the shell **if** the workspace line and manifest entry are removed.
